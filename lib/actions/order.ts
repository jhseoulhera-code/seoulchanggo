"use server";

import { MARKETS } from "@/data/markets";
import { getProductMarketPrice } from "@/lib/currency";
import { mapProductRow, PRODUCT_SELECT } from "@/lib/repositories/products";
import { getShippingFeeForMarket } from "@/lib/shipping";
import { createClient } from "@/lib/supabase/server";
import type { ProductJoinRow } from "@/lib/repositories/products";
import type { ShippingTypeEnum } from "@/types/database";
import type { CountryCode, CurrencyCode, Market } from "@/types/market";
import type { CheckoutItem, CustomsInfo, GuestCustomer, PaymentMethodId, ShippingAddress } from "@/types/order";

const SHIPPING_TYPE_TO_DB: Record<CheckoutItem["shippingType"], ShippingTypeEnum> = {
  domestic: "DOMESTIC",
  overseas_direct: "OVERSEAS_DIRECT",
  overseas_agent: "OVERSEAS_AGENCY",
};

export type CreateOrderActionInput = {
  orderNumber: string;
  customer: GuestCustomer;
  shippingAddress: ShippingAddress;
  customsInfo?: CustomsInfo;
  market: CountryCode;
  currency: CurrencyCode;
  paymentMethod: PaymentMethodId;
  items: CheckoutItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  couponCode?: string;
  pointsUsed?: number;
};

export type CreateOrderActionResult =
  | { ok: true; orderId: string }
  | { ok: false; error: "PRICE_MISMATCH" | "PRICE_NOT_READY" | "COUPON_INVALID" | "POINTS_INVALID" | "UNKNOWN" };

const PRICE_TOLERANCE = 1;

/**
 * The only path that writes an order to Supabase — called from CheckoutClient for both
 * guest and member checkouts. Runs server-side so client-submitted prices/fees are never
 * trusted as-is: every line is re-checked against the DB's own product_prices /
 * product_shipping_markets rows before public.create_order() is called. Identity is taken
 * from the caller's own session cookie (if any), never from client input, so a browser
 * can't place an order "as" another member.
 */
export async function createOrderAction(input: CreateOrderActionInput): Promise<CreateOrderActionResult> {
  // Point balances/redemption are tracked as plain KRW-equivalent integers
  // (point_transactions has no currency_code — see supabase/migrations
  // 20260823000100_step10_schema.sql), and create_order() subtracts
  // p_points_used 1:1 from the order total in p_currency_code. Applying
  // points to a non-KRW order would silently misvalue them (e.g. 10 points
  // becoming a $10 discount instead of ~$0.0075), so cross-currency points
  // redemption is blocked here rather than converted with a fake dev rate.
  if (input.pointsUsed && input.pointsUsed > 0 && input.currency !== "KRW") {
    return { ok: false, error: "POINTS_INVALID" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slugs = input.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .in("slug", slugs);

  if (productsError || !products) {
    console.error("[order] createOrderAction product lookup failed:", productsError?.message);
    return { ok: false, error: "UNKNOWN" };
  }

  const productsBySlug = new Map(
    (products as unknown as ProductJoinRow[]).map((row) => [row.slug, mapProductRow(row)])
  );

  // The order's own currency, not the product's native/KR row — a KR-shipping
  // order priced in USD must be re-validated against the same USD-first/
  // dev-rate-fallback resolution the client used (getProductMarketPrice),
  // not the market's native-currency row (STEP 13 currency addendum: Market
  // and Currency are no longer 1:1, so `market_code === input.market` alone
  // no longer identifies "the" price row).
  const validationMarket: Market = { ...MARKETS[input.market], currency: input.currency };

  const groupShippingFee = new Map<string, number>();
  for (const item of input.items) {
    groupShippingFee.set(item.shippingType, (groupShippingFee.get(item.shippingType) ?? 0) + item.shippingFee);
  }

  const rpcItems: Record<string, unknown>[] = [];
  for (const item of input.items) {
    const product = productsBySlug.get(item.productId);
    if (!product || !product.dbId) return { ok: false, error: "PRICE_MISMATCH" };

    const expectedPrice = getProductMarketPrice(product, validationMarket);
    const expectedShippingFee = getShippingFeeForMarket(product, validationMarket);
    if (
      Math.abs(expectedPrice.salePrice - item.unitPrice) > PRICE_TOLERANCE ||
      Math.abs(expectedPrice.originalPrice - item.unitOriginalPrice) > PRICE_TOLERANCE ||
      Math.abs(expectedShippingFee - item.shippingFee) > PRICE_TOLERANCE
    ) {
      return { ok: false, error: "PRICE_MISMATCH" };
    }

    // STEP 14 production policy: DEV_EXCHANGE_RATES (lib/currency.ts) is a
    // placeholder for a real exchange-rate source and must never be the
    // basis of a real charge — only an admin-entered price for the order's
    // own currency (product_prices.currency_code) may be sold in
    // production. Development/preview keeps allowing the dev-rate
    // conversion so currencies without an explicit price stay testable.
    if (!expectedPrice.isExplicit && process.env.NODE_ENV === "production") {
      return { ok: false, error: "PRICE_NOT_READY" };
    }

    rpcItems.push({
      product_id: product.dbId,
      variant_id: null,
      product_name_snapshot: item.productName,
      sku_snapshot: item.productId,
      option_snapshot: item.selectedOptions,
      unit_price: item.unitPrice,
      original_price: item.unitOriginalPrice,
      quantity: item.quantity,
      shipping_type: SHIPPING_TYPE_TO_DB[item.shippingType],
      origin_country: item.originCountry ?? null,
      shipping_group_key: item.shippingType,
      group_shipping_fee: groupShippingFee.get(item.shippingType) ?? 0,
      shipping_method: item.internationalShippingMethod ?? null,
    });
  }

  // STEP 15: create_order() no longer accepts p_subtotal/p_discount_amount/
  // p_shipping_amount/p_total_amount at all — it recomputes every amount
  // itself from product_prices/product_shipping_markets/products, so those
  // client-declared numbers (and unit_price/original_price/shipping_type/
  // origin_country/product_name_snapshot/sku_snapshot inside each item)
  // are no longer even read as the source of truth; the RPC is. This
  // Server Action's own pre-check above still runs first, purely so a
  // forged/stale client price fails fast with a friendly error instead of
  // reaching the RPC's own rejection — it is no longer the actual security
  // boundary. p_is_production is set from this trusted server process's own
  // NODE_ENV, never from client input, so production can't be spoofed into
  // allowing a DEV_EXCHANGE_RATES-based charge from the RPC side either.
  const { data: orderId, error: rpcError } = await supabase.rpc("create_order", {
    p_order_number: input.orderNumber,
    p_user_id: user?.id ?? null,
    p_guest_email: user ? null : input.customer.email,
    p_guest_phone: user ? null : input.customer.phone,
    p_market_code: input.market,
    p_currency_code: input.currency,
    p_payment_method: input.paymentMethod,
    p_shipping_address: input.shippingAddress,
    p_customs_info: input.customsInfo ?? null,
    p_items: rpcItems,
    p_coupon_code: input.couponCode ?? null,
    p_points_used: input.pointsUsed ?? 0,
    p_is_production: process.env.NODE_ENV === "production",
  } as never);

  if (rpcError || !orderId) {
    console.error("[order] create_order RPC failed:", rpcError?.message);
    const message = rpcError?.message ?? "";
    if (message.includes("PRICE_NOT_READY")) return { ok: false, error: "PRICE_NOT_READY" };
    if (message.includes("coupon")) return { ok: false, error: "COUPON_INVALID" };
    if (message.includes("point")) return { ok: false, error: "POINTS_INVALID" };
    if (message.includes("not available in market") || message.includes("not found or inactive")) {
      return { ok: false, error: "PRICE_MISMATCH" };
    }
    return { ok: false, error: "UNKNOWN" };
  }

  return { ok: true, orderId: orderId as unknown as string };
}
