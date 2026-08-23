// Relative + .ts-extensioned so scripts/test-checkout-shipping.mts (STEP 21) can import
// this transitively under plain Node — same convention as lib/shipping.ts itself.
import { isProductAvailableInMarket } from "../shipping.ts";
import type { Product, ShippingType } from "@/types";
import type { CountryCode } from "@/types/market";

export type ShippingGroupEligibility = {
  shippingType: ShippingType;
  isShippable: boolean;
  /** Product ids in this group that can't ship to countryCode — empty when isShippable is true. */
  unshippableProductIds: string[];
};

/** Per-item shippability check, reusing the same rule cart/checkout pricing already applies. */
export function isItemShippableToCountry(product: Product, countryCode: CountryCode): boolean {
  return isProductAvailableInMarket(product, countryCode);
}

/**
 * A shipping group (one shippingType's worth of cart/checkout lines) is only as shippable
 * as its least-shippable product — one destination-restricted item blocks the whole group
 * rather than silently splitting it further (STEP 21: no fabricated partial-ship policy).
 */
export function evaluateGroupEligibility(
  shippingType: ShippingType,
  products: Product[],
  countryCode: CountryCode
): ShippingGroupEligibility {
  const unshippable = products.filter((product) => !isItemShippableToCountry(product, countryCode));
  return {
    shippingType,
    isShippable: unshippable.length === 0,
    unshippableProductIds: unshippable.map((product) => product.id),
  };
}
