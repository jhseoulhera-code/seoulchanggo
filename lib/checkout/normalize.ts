// Relative + .ts-extensioned (not "@/" aliases) — same reasoning as
// lib/cart.ts's own imports: this file is imported directly by
// scripts/test-checkout-shipping.mts under plain Node, and transitively by
// lib/cart.ts itself, so every hop in the chain has to resolve without a
// bundler. Every other caller in the app still imports this via
// "@/lib/checkout/normalize" as usual.
import { convertFromKrw, getProductMarketPrice } from "../currency.ts";
import { calculateVariantPrice } from "../storefront/productVariants.ts";
import type { Product, ProductVariant } from "@/types";
import type { Market } from "@/types/market";

/**
 * STEP 21 spec section 6 — one place that resolves "what should this
 * exact product+variant actually sell for in this market/currency", used
 * by every caller that used to duplicate this arithmetic (the storefront
 * purchase panel, the cart's own enrichCartItem, the buy-now-to-checkout
 * bridge, and the server-side order pre-check) so they can never drift
 * from each other.
 *
 * additional_price stays a raw KRW delta with no per-market override
 * (STEP 18/19's documented scope) — converted here the same way the base
 * price itself is, for any non-KRW market. Never trusted from a cart
 * snapshot: this always reads live from the given product/variant.
 */
export type ResolveSellPriceInput = {
  product: Product;
  variant: ProductVariant | null;
  market: Market;
};

export type ResolvedSellPrice = {
  salePrice: number;
  originalPrice: number;
  /** Whether the base price came from an explicit per-currency product_prices row (true) vs a dev-rate KRW conversion (false) — see lib/currency.ts's getProductMarketPrice. */
  isExplicit: boolean;
};

export function resolveSellPrice({ product, variant, market }: ResolveSellPriceInput): ResolvedSellPrice {
  const base = getProductMarketPrice(product, market);
  if (!variant) return base;

  const deltaConverted = market.currency === "KRW" ? variant.additionalPrice : convertFromKrw(variant.additionalPrice, market.currency);
  return {
    salePrice: calculateVariantPrice(base.salePrice, deltaConverted),
    originalPrice: calculateVariantPrice(base.originalPrice, deltaConverted),
    isExplicit: base.isExplicit,
  };
}

export type CheckoutUnavailableReason = "market" | "soldOut";

/**
 * STEP 21 spec section 4's CheckoutLine.unavailableReason, kept as a small
 * closed set of reason codes (not free text) so the UI decides the exact
 * customer-facing message/locale, not this pure function.
 */
export function deriveUnavailableReason(isAvailable: boolean, isPurchasable: boolean): CheckoutUnavailableReason | null {
  if (!isAvailable) return "market";
  if (!isPurchasable) return "soldOut";
  return null;
}

/** A real, persisted cart_items row's identity, as returned by cart_get_items (never client-declared). */
export type RealCartLineIdentity = {
  cartItemId: string;
  productId: string;
  variantId: string | null;
};

export type ClaimedCartLine = {
  cartItemId?: string;
  productId: string;
  variantId: string | null;
};

/**
 * STEP 22 spec section 14/25 — a cart-sourced checkout line is trustworthy
 * only if it actually corresponds to a row in the CALLER's OWN persisted
 * cart (fetched server-side via cart_get_items, never taken from the
 * client's in-memory CheckoutItem array as-is). This is a distinct check
 * from price/stock re-validation: a forged cartItemId could otherwise still
 * price/stock-check out "correctly" while never having been a real item in
 * anyone's cart, or worse, could reference an id belonging to a different
 * user's cart. A buy-now line (no real cart_items row at all) is never
 * checked here — the caller skips this function entirely for those.
 */
export function isCartLineOwnedByCaller(claimed: ClaimedCartLine, realCartLines: RealCartLineIdentity[]): boolean {
  if (!claimed.cartItemId) return false;
  return realCartLines.some(
    (real) =>
      real.cartItemId === claimed.cartItemId &&
      real.productId === claimed.productId &&
      real.variantId === claimed.variantId
  );
}
