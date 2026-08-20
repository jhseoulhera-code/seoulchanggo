import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderItemRow, OrderRow, PaymentRow, ShippingGroupItemRow, ShippingGroupRow } from "@/types/database";
import type { AdminOrderDetail, AdminOrderListItem } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/orders] ${context} failed:`, error.message);
  throw new Error("주문 데이터를 처리하지 못했습니다.");
}

export type AdminOrderFilters = {
  q?: string;
  marketCode?: string;
  paymentStatus?: string;
  orderStatus?: string;
  dateFrom?: string;
  dateTo?: string;
};

type OrderListRow = OrderRow & {
  profiles: { display_name: string; email: string } | null;
  order_items: { id: string }[];
  shipping_groups: { destination_country: AdminOrderListItem["marketCode"] }[];
};

export async function listAdminOrders(filters: AdminOrderFilters = {}): Promise<AdminOrderListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("*, profiles(display_name, email), order_items(id), shipping_groups(destination_country)")
    .order("created_at", { ascending: false });

  if (filters.q) {
    query = query.or(`order_number.ilike.%${filters.q}%,guest_email.ilike.%${filters.q}%,guest_phone.ilike.%${filters.q}%`);
  }
  if (filters.marketCode) query = query.eq("market_code", filters.marketCode);
  if (filters.paymentStatus) query = query.eq("payment_status", filters.paymentStatus);
  if (filters.orderStatus) query = query.eq("order_status", filters.orderStatus);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", filters.dateTo);

  const { data, error } = await query.limit(200);
  if (error) fail("listAdminOrders", error);

  return ((data ?? []) as unknown as OrderListRow[]).map((row) => ({
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
  }));
}

type OrderDetailRow = OrderRow & {
  profiles: { display_name: string; email: string } | null;
  order_items: OrderItemRow[];
  shipping_groups: (ShippingGroupRow & { shipping_group_items: ShippingGroupItemRow[] })[];
  payments: PaymentRow[];
};

/** Personal customs code is masked at the repository boundary — see components/admin/orders/OrderDetailView.tsx for the "show full value" control. */
function maskCustomsCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return value;
  return `${value.slice(0, 1)}${"*".repeat(value.length - 3)}${value.slice(-2)}`;
}

export async function getAdminOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, profiles(display_name, email), order_items(*), shipping_groups(*, shipping_group_items(*)), payments(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getAdminOrderDetail", error);
  if (!data) return null;

  const row = data as unknown as OrderDetailRow;
  const customsInfo = row.customs_info as unknown as { personalCustomsCode?: string } | null;

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
      itemIds: group.shipping_group_items.map((item) => item.order_item_id),
    })),
    payments: [...row.payments]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        paymentMethod: payment.payment_method,
        amount: payment.amount,
        currencyCode: payment.currency_code,
        status: payment.status,
        failureCode: payment.failure_code,
        failureMessage: payment.failure_message,
        paidAt: payment.paid_at,
        createdAt: payment.created_at,
      })),
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
