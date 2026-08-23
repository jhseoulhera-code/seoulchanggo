// Relative + .ts-extensioned — see eligibility.ts's own comment.
import type { ShippingType } from "@/types";
import type { CurrencyCode } from "@/types/market";
import type { CheckoutItem } from "@/types/order";

export type ShippingQuoteStatus = "CALCULATED" | "FREE" | "UNAVAILABLE" | "PENDING";

export type ShippingQuote = {
  groupKey: ShippingType;
  /** null means "not a real number yet" (UNAVAILABLE/PENDING) — never faked as 0. */
  amount: number | null;
  currency: CurrencyCode;
  status: ShippingQuoteStatus;
  message?: string;
};

/**
 * Derives a group's shipping quote from its already-priced CheckoutItems (each item's
 * shippingFee was resolved by getShippingFeeForMarket via enrichCartItem/resolveSellPrice).
 *
 * PENDING is a reserved status for a future async freight-rate lookup (e.g. a real
 * overseas_direct carrier API) that can't answer synchronously — today's fee logic
 * (lib/shipping.ts) always resolves immediately to a flat rate or 0, so PENDING is never
 * actually returned by this function yet. It stays in the type/status union so UI and the
 * total-summary logic are forward-compatible without a second migration later, but claiming
 * it's reachable today would misrepresent what this STEP actually implements.
 */
export function computeGroupShippingQuote(
  shippingType: ShippingType,
  items: CheckoutItem[],
  currency: CurrencyCode,
  isShippable: boolean
): ShippingQuote {
  if (!isShippable) {
    return { groupKey: shippingType, amount: null, currency, status: "UNAVAILABLE" };
  }
  if (items.length === 0) {
    return { groupKey: shippingType, amount: null, currency, status: "PENDING" };
  }

  const amount = items.reduce((sum, item) => sum + item.shippingFee, 0);
  return { groupKey: shippingType, amount, currency, status: amount === 0 ? "FREE" : "CALCULATED" };
}

export function isGrandTotalDetermined(quotes: ShippingQuote[]): boolean {
  return quotes.every((quote) => quote.status === "CALCULATED" || quote.status === "FREE");
}
