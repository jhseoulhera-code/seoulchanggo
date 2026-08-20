"use server";

import { createClient } from "@/lib/supabase/server";
import type { ShippingTypeEnum } from "@/types/database";
import type { CountryCode, CurrencyCode } from "@/types/market";
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
};

export type CreateOrderActionResult = { ok: true; orderId: string } | { ok: false; error: "PRICE_MISMATCH" | "UNKNOWN" };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const slugs = input.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, slug, product_prices(*), product_shipping_markets(*)")
    .in("slug", slugs);

  if (productsError || !products) {
    console.error("[order] createOrderAction product lookup failed:", productsError?.message);
    return { ok: false, error: "UNKNOWN" };
  }

  type ProductLookupRow = {
    id: string;
    slug: string;
    product_prices: { market_code: string; sale_price: number; original_price: number }[];
    product_shipping_markets: { country_code: string; shipping_fee: number }[];
  };
  const productsBySlug = new Map((products as unknown as ProductLookupRow[]).map((row) => [row.slug, row]));

  const groupShippingFee = new Map<string, number>();
  for (const item of input.items) {
    groupShippingFee.set(item.shippingType, (groupShippingFee.get(item.shippingType) ?? 0) + item.shippingFee);
  }

  const rpcItems: Record<string, unknown>[] = [];
  for (const item of input.items) {
    const product = productsBySlug.get(item.productId);
    if (!product) return { ok: false, error: "PRICE_MISMATCH" };

    const priceRow = product.product_prices.find((price) => price.market_code === input.market);
    const marketRow = product.product_shipping_markets.find((market) => market.country_code === input.market);
    if (!priceRow) return { ok: false, error: "PRICE_MISMATCH" };

    const expectedShippingFee = marketRow?.shipping_fee ?? 0;
    if (
      Math.abs(priceRow.sale_price - item.unitPrice) > PRICE_TOLERANCE ||
      Math.abs(priceRow.original_price - item.unitOriginalPrice) > PRICE_TOLERANCE ||
      Math.abs(expectedShippingFee - item.shippingFee) > PRICE_TOLERANCE
    ) {
      return { ok: false, error: "PRICE_MISMATCH" };
    }

    rpcItems.push({
      product_id: product.id,
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

  const { data: orderId, error: rpcError } = await supabase.rpc("create_order", {
    p_order_number: input.orderNumber,
    p_user_id: user?.id ?? null,
    p_guest_email: user ? null : input.customer.email,
    p_guest_phone: user ? null : input.customer.phone,
    p_market_code: input.market,
    p_currency_code: input.currency,
    p_subtotal: input.subtotal,
    p_discount_amount: input.discount,
    p_shipping_amount: input.shippingFee,
    p_total_amount: input.total,
    p_payment_method: input.paymentMethod,
    p_shipping_address: input.shippingAddress,
    p_customs_info: input.customsInfo ?? null,
    p_items: rpcItems,
  } as never);

  if (rpcError || !orderId) {
    console.error("[order] create_order RPC failed:", rpcError?.message);
    return { ok: false, error: "UNKNOWN" };
  }

  return { ok: true, orderId: orderId as unknown as string };
}
