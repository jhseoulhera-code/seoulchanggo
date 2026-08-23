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
};

/** A product with no `availableCountries` ships everywhere — no magic "ALL" sentinel needed. */
export function isProductAvailableInMarket(product: Product, countryCode: CountryCode): boolean {
  if (!product.availableCountries || product.availableCountries.length === 0) return true;
  return product.availableCountries.includes(countryCode);
}

/** Base shipping fee in KRW for a destination market: per-market override, else a shippingType default. */
export function getBaseShippingFeeKrw(product: Product, countryCode: CountryCode): number {
  if (product.freeShipping) return 0;
  return product.shippingFees?.[countryCode] ?? DEFAULT_SHIPPING_FEE_KRW[product.shippingType];
}

/** Shipping fee converted into the current market's display currency. */
export function getShippingFeeForMarket(product: Product, market: Market): number {
  const baseKrw = getBaseShippingFeeKrw(product, market.countryCode);
  return convertFromKrw(baseKrw, market.currency);
}
