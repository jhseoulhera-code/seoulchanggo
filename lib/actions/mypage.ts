"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  OrderItemRow,
  OrderRow,
  OrderStatusEnum,
  PaymentAttemptStatusEnum,
  PaymentMethodEnum,
  PaymentProviderEnum,
  PaymentRefundRow,
  PaymentRow,
  PaymentStatusEnum,
  ShippingGroupItemRow,
  ShippingGroupRow,
  ShippingGroupStatusEnum,
  ShippingMethodEnum,
  ShippingTypeEnum,
} from "@/types/database";
import type { CountryCode, CurrencyCode } from "@/types/market";

export type MyOrderSummary = {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  currencyCode: CurrencyCode;
};

export async function getMyOrdersAction(): Promise<MyOrderSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) {
    console.error("[mypage] getMyOrdersAction failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as OrderRow[]).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    totalAmount: row.total_amount,
    currencyCode: row.currency_code,
  }));
}

export type MyReviewSummary = { id: string; productId: string; productNameKo: string; rating: number; content: string; createdAt: string };

export async function getMyReviewsAction(): Promise<MyReviewSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, rating, content, created_at, products(name_ko)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[mypage] getMyReviewsAction failed:", error.message);
    return [];
  }

  type Row = { id: string; product_id: string; rating: number; content: string; created_at: string; products: { name_ko: string } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productNameKo: row.products?.name_ko ?? "-",
    rating: row.rating,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export type MyInquirySummary = { id: string; productId: string; productNameKo: string; question: string; status: string; createdAt: string };

export async function getMyInquiriesAction(): Promise<MyInquirySummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("product_inquiries")
    .select("id, product_id, question, status, created_at, products(name_ko)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[mypage] getMyInquiriesAction failed:", error.message);
    return [];
  }

  type Row = { id: string; product_id: string; question: string; status: string; created_at: string; products: { name_ko: string } | null };
  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productNameKo: row.products?.name_ko ?? "-",
    question: row.question,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export type MyOrderDetailItem = {
  id: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  optionSnapshot: Record<string, string>;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  subtotal: number;
  shippingType: ShippingTypeEnum;
};

export type MyOrderDetailShippingGroup = {
  id: string;
  shippingType: ShippingTypeEnum;
  shippingMethod: ShippingMethodEnum | null;
  destinationCountry: CountryCode;
  shippingFee: number;
  status: ShippingGroupStatusEnum;
  itemIds: string[];
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
};

/**
 * STEP 22 spec section 23 — a customer-facing order detail, distinct from
 * AdminOrderDetail (types/admin.ts): this never exposes another customer's
 * PII, and every field here comes straight from the order/order_items/
 * shipping_groups SNAPSHOT rows (STEP 08 schema), never re-derived from the
 * current live product — a renamed product or deleted variant must never
 * change how a past order reads.
 */
/**
 * STEP 23 spec section 38 — the latest payment ATTEMPT for this order (not
 * orders.payment_status, which only ever distinguishes UNPAID/PAID and
 * loses the FAILED/PENDING nuance). Never exposes provider_payment_id/
 * provider_transaction_id/raw_metadata/failure_message — none of those are
 * meant for a customer's eyes (internal-only diagnostic values, and
 * raw_metadata is an allow-list of non-sensitive provider fields at best).
 */
export type MyOrderDetailPayment = {
  status: PaymentAttemptStatusEnum;
  provider: PaymentProviderEnum;
  paymentMethod: PaymentMethodEnum;
  amount: number;
  currencyCode: CurrencyCode;
  paidAt: string | null;
  createdAt: string;
};

export type MyOrderDetail = {
  id: string;
  orderNumber: string;
  createdAt: string;
  marketCode: CountryCode;
  currencyCode: CurrencyCode;
  paymentMethod: PaymentMethodEnum;
  paymentStatus: PaymentStatusEnum;
  orderStatus: OrderStatusEnum;
  shippingAddress: Record<string, unknown>;
  itemsSubtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  items: MyOrderDetailItem[];
  shippingGroups: MyOrderDetailShippingGroup[];
  latestPayment: MyOrderDetailPayment | null;
  /** STEP 23 section 38 — a failed/abandoned attempt can still be retried against the same order; a PAID or CANCELLED order cannot. */
  canRetryPayment: boolean;
  /** STEP 26 spec section 3 — an unpaid, not-already-cancelled order can be self-cancelled; kept as its own field even though its condition matches canRetryPayment today, since "retry" and "cancel" are distinct customer actions. */
  canCancel: boolean;
  /** STEP 26 spec section 31 — sum of COMPLETED refund amounts for this order; never derived from a raw provider/internal code. */
  refundedAmount: number;
  refundStatus: "NONE" | "PENDING" | "PARTIAL" | "COMPLETED";
};

type OrderDetailRow = OrderRow & {
  order_items: OrderItemRow[];
  shipping_groups: (ShippingGroupRow & { shipping_group_items: ShippingGroupItemRow[] })[];
  payments: PaymentRow[];
  payment_refunds: PaymentRefundRow[];
};

/**
 * STEP 22 spec section 25 — ownership is enforced twice: the explicit
 * `.eq("user_id", user.id)` filter here, AND the orders_select_own /
 * order_items_select_own / shipping_groups_select_own RLS policies
 * (supabase/migrations/20260820000400_rls_policies.sql) that would return
 * zero rows for another user's order id regardless of this filter — the
 * same belt-and-suspenders pattern getMyOrdersAction above already uses.
 * A guessed/incremented orderId can never surface another customer's
 * address, phone, or order contents.
 */
export async function getMyOrderDetailAction(orderId: string): Promise<MyOrderDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), shipping_groups(*, shipping_group_items(*)), payments(*), payment_refunds(*)")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[mypage] getMyOrderDetailAction failed:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as OrderDetailRow;
  const latestPaymentRow = [...row.payments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];

  // STEP 26 spec section 31 — customer sees only a coarse refund state
  // (never a raw internal status code or reconciliation issue).
  const refundedAmount = row.payment_refunds.filter((refund) => refund.status === "COMPLETED").reduce((sum, refund) => sum + refund.amount, 0);
  const hasPendingRefund = row.payment_refunds.some((refund) => refund.status === "PENDING");
  const refundStatus: MyOrderDetail["refundStatus"] = hasPendingRefund
    ? "PENDING"
    : latestPaymentRow?.status === "REFUNDED"
      ? "COMPLETED"
      : latestPaymentRow?.status === "PARTIALLY_REFUNDED"
        ? "PARTIAL"
        : "NONE";

  return {
    id: row.id,
    orderNumber: row.order_number,
    createdAt: row.created_at,
    marketCode: row.market_code,
    currencyCode: row.currency_code,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    orderStatus: row.order_status,
    shippingAddress: (row.shipping_address as unknown as Record<string, unknown>) ?? {},
    itemsSubtotal: row.subtotal,
    discountTotal: row.discount_amount,
    shippingTotal: row.shipping_amount,
    grandTotal: row.total_amount,
    items: row.order_items.map((item) => ({
      id: item.id,
      productNameSnapshot: item.product_name_snapshot,
      skuSnapshot: item.sku_snapshot,
      optionSnapshot: (item.option_snapshot as unknown as Record<string, string>) ?? {},
      unitPrice: item.unit_price,
      originalPrice: item.original_price,
      quantity: item.quantity,
      subtotal: item.unit_price * item.quantity,
      shippingType: item.shipping_type,
    })),
    shippingGroups: row.shipping_groups.map((group) => ({
      id: group.id,
      shippingType: group.shipping_type,
      shippingMethod: group.shipping_method,
      destinationCountry: group.destination_country,
      shippingFee: group.shipping_fee,
      status: group.status,
      itemIds: group.shipping_group_items.map((item) => item.order_item_id),
      carrier: group.carrier,
      trackingNumber: group.tracking_number,
      shippedAt: group.shipped_at,
      deliveredAt: group.delivered_at,
    })),
    latestPayment: latestPaymentRow
      ? {
          status: latestPaymentRow.status,
          provider: latestPaymentRow.provider,
          paymentMethod: latestPaymentRow.payment_method,
          amount: latestPaymentRow.amount,
          currencyCode: latestPaymentRow.currency_code,
          paidAt: latestPaymentRow.paid_at,
          createdAt: latestPaymentRow.created_at,
        }
      : null,
    canRetryPayment: row.payment_status !== "PAID" && row.order_status !== "CANCELLED",
    canCancel: row.payment_status !== "PAID" && row.order_status !== "CANCELLED",
    refundedAmount,
    refundStatus,
  };
}

export type CancelMyOrderResult = { ok: true } | { ok: false; error: string };

/**
 * STEP 26 spec section 3/37 — customer-initiated cancel for an order that
 * was never paid. Never calls anything refund-related: an unpaid order was
 * never charged, so there is nothing for a payment provider to reverse.
 * cancel_own_unpaid_order re-verifies ownership itself (the same
 * _check_order_access used by prepare_payment/confirm_payment) — this
 * action's own auth.getUser() check is only a fail-fast UX guard, not the
 * real boundary.
 */
export async function cancelMyUnpaidOrderAction(orderId: string): Promise<CancelMyOrderResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase가 연결되어 있지 않습니다." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const { error } = await supabase.rpc("cancel_own_unpaid_order", { p_order_id: orderId } as never);
  if (error) {
    console.error("[mypage] cancelMyUnpaidOrderAction failed:", error.message);
    if (error.message.includes("paid order")) return { ok: false, error: "이미 결제완료된 주문은 취소할 수 없습니다." };
    if (error.message.includes("access denied") || error.message.includes("not found")) {
      return { ok: false, error: "주문을 찾을 수 없습니다." };
    }
    return { ok: false, error: "주문을 취소하지 못했습니다." };
  }
  return { ok: true };
}
