import type { CartItemIdentity, CartLineView } from "@/types/cart";

/**
 * STEP 20 spec section 2/12/34/35 — pure cart business logic, kept
 * dependency-free (no Supabase/React/server-only import) so it's directly
 * unit-testable by scripts/test-cart.mts and mirrors exactly what the
 * SECURITY DEFINER RPCs in the STEP 20 migration enforce server-side
 * (cart_add_item/cart_set_quantity/cart_merge_guest_into_user) — these
 * functions exist so that rule can be verified in isolation, and so the UI
 * can apply the same "capped at stock" clamp optimistically before a
 * server round trip confirms it.
 */

export function sameCartIdentity(a: CartItemIdentity, b: CartItemIdentity): boolean {
  return a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null);
}

/** null stock means "not tracked" (unlimited) — never clamp in that case. */
export function capQuantityAtStock(quantity: number, stock: number | null): number {
  if (stock === null) return Math.max(1, quantity);
  return Math.max(1, Math.min(quantity, Math.max(stock, 1)));
}

/** Mirrors cart_add_item/cart_merge_guest_into_user's "existing + incoming, capped at current stock" rule. */
export function mergeQuantities(existing: number, incoming: number, stock: number | null): number {
  return capQuantityAtStock(existing + incoming, stock);
}

/** A won-level (or smallest-unit) threshold avoids flagging a "price change" from float rounding noise in a currency conversion. */
export function hasPriceChanged(snapshotPrice: number, currentPrice: number, threshold = 1): boolean {
  return Math.abs(currentPrice - snapshotPrice) >= threshold;
}

/** STEP 20 spec section 34 — only a purchasable line (active, in stock, priceable, shippable to the current market) is eligible for a future checkout. */
export function getPurchasableCartItems(lines: CartLineView[]): CartLineView[] {
  return lines.filter((line) => line.isAvailable && line.isPurchasable);
}

export function calculateCartBadgeQuantity(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
