"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  OrderItemRow,
  OrderRow,
  OrderStatusEnum,
  PaymentMethodEnum,
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
};

/**
 * STEP 22 spec section 23 — a customer-facing order detail, distinct from
 * AdminOrderDetail (types/admin.ts): this never exposes another customer's
 * PII, and every field here comes straight from the order/order_items/
 * shipping_groups SNAPSHOT rows (STEP 08 schema), never re-derived from the
 * current live product — a renamed product or deleted variant must never
 * change how a past order reads.
 */
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
};

type OrderDetailRow = OrderRow & {
  order_items: OrderItemRow[];
  shipping_groups: (ShippingGroupRow & { shipping_group_items: ShippingGroupItemRow[] })[];
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
    .select("*, order_items(*), shipping_groups(*, shipping_group_items(*))")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[mypage] getMyOrderDetailAction failed:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as OrderDetailRow;

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
    })),
  };
}
