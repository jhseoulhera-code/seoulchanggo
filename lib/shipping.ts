// Relative + .ts-extensioned so lib/cart.ts (imported directly by
// scripts/test-cart.mts under plain Node) can resolve this transitively —
// see that file's own import comment.
import { convertFromKrw } from "./currency.ts";
import type { Product, ShippingType } from "@/types";
import type { CountryCode, Market } from "@/types/market";

const DEFAULT_SHIPPING_FEE_KRW: Record<ShippingType, number> = {
  domestic: 3000,
  overseas_direct: 5000,
  overseas_agent: 6000,
  direct_pickup: 0,
};

/** A product with no `availableCountries` ships everywhere — no magic "ALL" sentinel needed. */
export function isProductAvailableInMarket(product: Product, countryCode: CountryCode): boolean {
  if (!product.availableCountries || product.availableCountries.length === 0) return true;
  return product.availableCountries.includes(countryCode);
}

/**
 * Base shipping fee in KRW for a destination market: per-market override, else a shippingType default.
 *
 * STEP 26.1 spec section 8 — a direct_pickup product's fee is always 0,
 * checked BEFORE any per-market override, so a stray admin-entered
 * product_shipping_markets fee for a pickup product can never leak through.
 * This is never trusted from client input either way (this function only
 * ever runs server-side or is re-verified server-side in createOrderAction).
 */
export function getBaseShippingFeeKrw(product: Product, countryCode: CountryCode): number {
  if (product.shippingType === "direct_pickup") return 0;
  if (product.freeShipping) return 0;
  return product.shippingFees?.[countryCode] ?? DEFAULT_SHIPPING_FEE_KRW[product.shippingType];
}

/** Shipping fee converted into the current market's display currency. */
export function getShippingFeeForMarket(product: Product, market: Market): number {
  const baseKrw = getBaseShippingFeeKrw(product, market.countryCode);
  return convertFromKrw(baseKrw, market.currency);
}
