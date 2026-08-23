import "server-only";

import { escapeIlikePattern, sanitizeForOrFilter } from "@/lib/search/normalize";
import { createClient } from "@/lib/supabase/server";
import type {
  OrderItemRow,
  OrderRow,
  OrderStatusHistoryRow,
  PaymentRefundItemRow,
  PaymentRefundRow,
  PaymentRow,
  ShippingGroupItemRow,
  ShippingGroupRow,
  ShippingGroupStatusEnum,
  ShippingTypeEnum,
} from "@/types/database";
import type { AdminOrderDetail, AdminOrderListItem, AdminOrderListResult, AdminReconciliationWarning } from "@/types/admin";
import { isStalePendingRefund, STALE_REFUND_PENDING_THRESHOLD_MINUTES } from "@/lib/payments/reconciliation";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/orders] ${context} failed:`, error.message);
  throw new Error("주문 데이터를 처리하지 못했습니다.");
}

export type AdminOrderFilters = {
  q?: string;
  marketCode?: string;
  paymentStatus?: string;
  orderStatus?: string;
  /** STEP 25 — filters by ANY shipping group on the order matching this status/type (a mixed order can match on one group without every group matching). */
  shippingStatus?: string;
  shippingType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type OrderListRow = OrderRow & {
  profiles: { display_name: string; email: string } | null;
  order_items: { id: string }[];
  shipping_groups: { destination_country: AdminOrderListItem["marketCode"]; status: ShippingGroupStatusEnum; shipping_type: ShippingTypeEnum }[];
};

/**
 * STEP 25 spec section 5 — order_number/guest_email/guest_phone are columns
 * on `orders` itself, so a single `.or()` ilike works; a member's display
 * name/email live on the JOINED `profiles` table, which PostgREST's
 * embedded-resource OR filters handle awkwardly for a one-to-one relation
 * used this way. Resolving matching profile ids in a separate query first
 * (and folding them into the SAME `.or()` as a `user_id.in.(...)` clause)
 * keeps the actual order query a single, ordinary, easy-to-reason-about
 * filter instead of a fragile embedded-OR expression.
 */
async function resolveMatchingUserIds(supabase: Awaited<ReturnType<typeof createClient>>, pattern: string): Promise<string[]> {
  const { data, error } = await supabase.from("profiles").select("id").or(`display_name.ilike.${pattern},email.ilike.${pattern}`).limit(100);
  if (error) fail("resolveMatchingUserIds", error);
  return ((data ?? []) as unknown as { id: string }[]).map((row) => row.id);
}

/** STEP 25 — resolves shippingStatus/shippingType filters to the set of order ids that have at least one matching shipping group, via a direct query rather than a fragile embedded-resource inner-join filter that could also silently narrow the nested shipping_groups array used elsewhere in the mapping. */
async function resolveOrderIdsByShippingFilter(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shippingStatus?: string,
  shippingType?: string
): Promise<string[]> {
  let query = supabase.from("shipping_groups").select("order_id");
  if (shippingStatus) query = query.eq("status", shippingStatus);
  if (shippingType) query = query.eq("shipping_type", shippingType);
  const { data, error } = await query;
  if (error) fail("resolveOrderIdsByShippingFilter", error);
  return [...new Set(((data ?? []) as unknown as { order_id: string }[]).map((row) => row.order_id))];
}

export async function listAdminOrders(filters: AdminOrderFilters = {}): Promise<AdminOrderListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let shippingOrderIds: string[] | null = null;
  if (filters.shippingStatus || filters.shippingType) {
    shippingOrderIds = await resolveOrderIdsByShippingFilter(supabase, filters.shippingStatus, filters.shippingType);
    if (shippingOrderIds.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
  }

  let query = supabase
    .from("orders")
    .select("*, profiles(display_name, email), order_items(id), shipping_groups(destination_country, status, shipping_type)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (filters.q) {
    const pattern = `%${escapeIlikePattern(sanitizeForOrFilter(filters.q))}%`;
    const matchedUserIds = await resolveMatchingUserIds(supabase, pattern);
    const orParts = [`order_number.ilike.${pattern}`, `guest_email.ilike.${pattern}`, `guest_phone.ilike.${pattern}`];
    if (matchedUserIds.length > 0) orParts.push(`user_id.in.(${matchedUserIds.join(",")})`);
    query = query.or(orParts.join(","));
  }
  if (filters.marketCode) query = query.eq("market_code", filters.marketCode);
  if (filters.paymentStatus) query = query.eq("payment_status", filters.paymentStatus);
  if (filters.orderStatus) query = query.eq("order_status", filters.orderStatus);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);
  if (shippingOrderIds) query = query.in("id", shippingOrderIds);

  const { data, error, count } = await query.range(from, to);
  if (error) fail("listAdminOrders", error);

  const items = ((data ?? []) as unknown as OrderListRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    isGuest: row.user_id === null,
    customerName: row.profiles?.display_name ?? "비회원",
    customerEmail: row.profiles?.email ?? row.guest_email ?? "-",
    marketCode: row.market_code,
    currencyCode: row.currency_code,
    destinationCountries: [...new Set(row.shipping_groups.map((group) => group.destination_country))],
    itemCount: row.order_items.length,
    totalAmount: row.total_amount,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    shippingStatuses: [...new Set(row.shipping_groups.map((group) => group.status))],
    shippingTypes: [...new Set(row.shipping_groups.map((group) => group.shipping_type))],
  }));

  return { items, total: count ?? items.length, page, pageSize };
}

type OrderDetailRow = OrderRow & {
  profiles: { display_name: string; email: string } | null;
  order_items: OrderItemRow[];
  shipping_groups: (ShippingGroupRow & { shipping_group_items: ShippingGroupItemRow[] })[];
  payments: PaymentRow[];
  payment_refunds: (PaymentRefundRow & { payment_refund_items: PaymentRefundItemRow[] })[];
};

/** Personal customs code is masked at the repository boundary — see components/admin/orders/OrderDetailView.tsx for the "show full value" control. */
function maskCustomsCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return value;
  return `${value.slice(0, 1)}${"*".repeat(value.length - 3)}${value.slice(-2)}`;
}

/**
 * STEP 25 spec section 34/35 — a payment that ends up FAILED with a
 * failure_code from STEP 23/24's fail-closed checks (STOCK_CHANGED,
 * PAYMENT_AMOUNT_MISMATCH, PAYMENT_CURRENCY_MISMATCH) AND still carries a
 * provider_payment_id is a strong LOCAL signal that the provider likely
 * reported success while our own system rejected it — exactly the
 * "provider PAID / local action required" case, computable from data
 * already on hand without a live provider lookup (every real adapter's
 * getPaymentStatus is still NOT_CONFIGURED — see lib/payments/providers/
 * stubFactory.ts). Reuses lib/payments/reconciliation.ts's own issue
 * vocabulary rather than inventing a parallel one.
 */
/**
 * STEP 26 spec section 24/25 — extended with the refund-flow issues: a
 * refund stuck in PENDING past the same staleness threshold STEP 24 uses for
 * payments (admin_finalize_refund never completed — the provider may have
 * already refunded the money), and a refund that ended FAILED specifically
 * because admin_finalize_refund rejected an amount/currency mismatch (money
 * may have moved at the provider even though our own record stayed
 * unfinished/FAILED — the same "provider vs local" ambiguity STEP 24 already
 * accepts for payments, now extended to refunds).
 */
function detectReconciliationWarnings(payments: PaymentRow[], refunds: PaymentRefundRow[]): AdminReconciliationWarning[] {
  const warnings: AdminReconciliationWarning[] = [];
  for (const payment of payments) {
    if (payment.status !== "FAILED" || !payment.provider_payment_id) continue;
    if (payment.failure_code === "STOCK_CHANGED") {
      warnings.push({ issue: "PROVIDER_PAID_LOCAL_STOCK_FAILURE", paymentId: payment.id });
    } else if (payment.failure_code === "PAYMENT_AMOUNT_MISMATCH") {
      warnings.push({ issue: "AMOUNT_MISMATCH", paymentId: payment.id });
    } else if (payment.failure_code === "PAYMENT_CURRENCY_MISMATCH") {
      warnings.push({ issue: "CURRENCY_MISMATCH", paymentId: payment.id });
    }
  }
  for (const refund of refunds) {
    if (refund.status === "PENDING" && isStalePendingRefund(refund.status, refund.created_at, new Date(), STALE_REFUND_PENDING_THRESHOLD_MINUTES)) {
      warnings.push({ issue: "PROVIDER_REFUNDED_LOCAL_PENDING", paymentId: refund.payment_id });
    } else if (refund.status === "FAILED" && (refund.failure_code === "REFUND_AMOUNT_MISMATCH" || refund.failure_code === "REFUND_CURRENCY_MISMATCH")) {
      warnings.push({ issue: "REFUND_AMOUNT_MISMATCH", paymentId: refund.payment_id });
    }
  }
  return warnings;
}

export async function getAdminOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, profiles(display_name, email), order_items(*), shipping_groups(*, shipping_group_items(*)), payments(*), payment_refunds(*, payment_refund_items(*))"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getAdminOrderDetail", error);
  if (!data) return null;

  const row = data as unknown as OrderDetailRow;
  const customsInfo = row.customs_info as unknown as { personalCustomsCode?: string } | null;

  // STEP 26 — "already refunded" only ever counts PENDING+COMPLETED refunds
  // (a FAILED refund never consumed any of the refundable quota), mirroring
  // admin_create_refund's own guard exactly.
  const activeRefunds = row.payment_refunds.filter((refund) => refund.status === "PENDING" || refund.status === "COMPLETED");
  const refundedQuantityByItem = new Map<string, number>();
  for (const refund of activeRefunds) {
    for (const item of refund.payment_refund_items) {
      refundedQuantityByItem.set(item.order_item_id, (refundedQuantityByItem.get(item.order_item_id) ?? 0) + item.quantity);
    }
  }
  const completedAmountByPayment = new Map<string, number>();
  const pendingAmountByPayment = new Map<string, number>();
  for (const refund of row.payment_refunds) {
    if (refund.status === "COMPLETED") {
      completedAmountByPayment.set(refund.payment_id, (completedAmountByPayment.get(refund.payment_id) ?? 0) + refund.amount);
    } else if (refund.status === "PENDING") {
      pendingAmountByPayment.set(refund.payment_id, (pendingAmountByPayment.get(refund.payment_id) ?? 0) + refund.amount);
    }
  }

  const { data: historyData, error: historyError } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  if (historyError) fail("getAdminOrderDetail (history)", historyError);

  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    marketCode: row.market_code,
    currencyCode: row.currency_code,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    customerName: row.profiles?.display_name ?? "비회원",
    customerEmail: row.profiles?.email ?? row.guest_email ?? "-",
    customerPhone: row.guest_phone ?? "-",
    isGuest: row.user_id === null,
    shippingAddress: (row.shipping_address as unknown as Record<string, unknown>) ?? {},
    customsCode: maskCustomsCode(customsInfo?.personalCustomsCode),
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    shippingAmount: row.shipping_amount,
    totalAmount: row.total_amount,
    items: row.order_items.map((item) => ({
      id: item.id,
      productNameSnapshot: item.product_name_snapshot,
      skuSnapshot: item.sku_snapshot,
      optionSnapshot: (item.option_snapshot as unknown as Record<string, string>) ?? {},
      unitPrice: item.unit_price,
      originalPrice: item.original_price,
      quantity: item.quantity,
      shippingType: item.shipping_type,
      originCountry: item.origin_country,
      refundedQuantity: refundedQuantityByItem.get(item.id) ?? 0,
    })),
    shippingGroups: row.shipping_groups.map((group) => ({
      id: group.id,
      shippingType: group.shipping_type,
      shippingMethod: group.shipping_method,
      destinationCountry: group.destination_country,
      shippingFee: group.shipping_fee,
      status: group.status,
      carrier: group.carrier,
      trackingNumber: group.tracking_number,
      shippedAt: group.shipped_at,
      deliveredAt: group.delivered_at,
      itemIds: group.shipping_group_items.map((item) => item.order_item_id),
    })),
    payments: [...row.payments]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        providerPaymentId: payment.provider_payment_id,
        paymentMethod: payment.payment_method,
        amount: payment.amount,
        currencyCode: payment.currency_code,
        status: payment.status,
        failureCode: payment.failure_code,
        failureMessage: payment.failure_message,
        paidAt: payment.paid_at,
        createdAt: payment.created_at,
        refundedAmount: completedAmountByPayment.get(payment.id) ?? 0,
        pendingRefundAmount: pendingAmountByPayment.get(payment.id) ?? 0,
      })),
    refunds: [...row.payment_refunds]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((refund) => ({
        id: refund.id,
        paymentId: refund.payment_id,
        status: refund.status,
        amount: refund.amount,
        refundShippingAmount: refund.refund_shipping_amount,
        currencyCode: refund.currency,
        reasonCode: refund.reason_code,
        reason: refund.reason,
        providerRefundId: refund.provider_refund_id,
        failureCode: refund.failure_code,
        createdAt: refund.created_at,
        completedAt: refund.completed_at,
        lines: refund.payment_refund_items.map((item) => ({
          orderItemId: item.order_item_id,
          quantity: item.quantity,
          amount: item.amount,
        })),
      })),
    adminNote: row.admin_note,
    statusHistory: ((historyData ?? []) as unknown as OrderStatusHistoryRow[]).map((entry) => ({
      id: entry.id,
      shippingGroupId: entry.shipping_group_id,
      fromStatus: entry.from_status,
      toStatus: entry.to_status,
      createdAt: entry.created_at,
    })),
    reconciliationWarnings: detectReconciliationWarnings(row.payments, row.payment_refunds),
  };
}

export type UpdateShippingGroupResult = { ok: true } | { ok: false; error: string };

export async function updateAdminShippingGroup(input: {
  shippingGroupId: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
}): Promise<UpdateShippingGroupResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_shipping_group", {
    p_shipping_group_id: input.shippingGroupId,
    p_status: input.status,
    p_carrier: input.carrier,
    p_tracking_number: input.trackingNumber,
  } as never);

  if (error) {
    console.error("[admin/orders] updateAdminShippingGroup failed:", error.message);
    if (error.message.includes("invalid status transition")) {
      return { ok: false, error: "허용되지 않는 배송상태 변경입니다." };
    }
    if (error.message.includes("SHIPPING_INFO_REQUIRED")) {
      return { ok: false, error: "발송 처리하려면 운송사와 송장번호를 입력해야 합니다." };
    }
    if (error.message.includes("ORDER_NOT_PAID")) {
      return { ok: false, error: "결제가 완료되지 않은 주문은 발송 처리할 수 없습니다." };
    }
    if (error.message.includes("INVALID_TRACKING_NUMBER")) {
      return { ok: false, error: "송장번호 형식이 올바르지 않습니다." };
    }
    return { ok: false, error: "배송상태를 변경하지 못했습니다." };
  }
  return { ok: true };
}

export type CancelUnpaidOrderResult = { ok: true } | { ok: false; error: string };

/** Reverses coupon usage / point deduction for an abandoned unpaid order — see cancel_unpaid_order() in 20260825000300_step11_payment_rpcs.sql. */
export async function cancelUnpaidOrder(orderId: string, reason: string): Promise<CancelUnpaidOrderResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_unpaid_order", { p_order_id: orderId, p_reason: reason } as never);

  if (error) {
    console.error("[admin/orders] cancelUnpaidOrder failed:", error.message);
    if (error.message.includes("paid order")) return { ok: false, error: "이미 결제완료된 주문은 이 기능으로 취소할 수 없습니다." };
    return { ok: false, error: "주문을 취소하지 못했습니다." };
  }
  return { ok: true };
}

export type SetOrderNoteResult = { ok: true } | { ok: false; error: string };

export async function setAdminOrderNote(orderId: string, note: string): Promise<SetOrderNoteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_order_note", { p_order_id: orderId, p_note: note } as never);

  if (error) {
    console.error("[admin/orders] setAdminOrderNote failed:", error.message);
    if (error.message.includes("NOTE_TOO_LONG")) return { ok: false, error: "메모는 2000자 이하로 입력해주세요." };
    return { ok: false, error: "메모를 저장하지 못했습니다." };
  }
  return { ok: true };
}
