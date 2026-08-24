import { enrichCartItem, summarizeLines } from "@/lib/cart";
import { calculateVariantPrice } from "@/lib/storefront/productVariants";
import { deriveUnavailableReason } from "@/lib/checkout/normalize";
import type { Product, ShippingType } from "@/types";
import type { BuyNowItem, CartItem, CartLineView, CartSummaryTotals } from "@/types/cart";
import type { Market } from "@/types/market";
import type { CheckoutItem, OrderShippingGroup } from "@/types/order";

function checkoutItemFromLine(line: CartLineView): CheckoutItem {
  return {
    cartItemId: line.cartItem.cartItemId,
    productId: line.product.id,
    variantId: line.cartItem.variantId,
    productName: line.product.name,
    image: line.product.image,
    category: line.product.category,
    selectedOptions: line.optionValues,
    optionLabel: line.optionLabel,
    quantity: line.cartItem.quantity,
    unitPrice: line.unitPrice,
    unitOriginalPrice: line.unitOriginalPrice,
    subtotal: line.subtotal,
    discountAmount: line.discountAmount,
    shippingType: line.product.shippingType,
    shippingLabel: line.product.shippingLabel,
    originCountry: line.product.originCountry,
    internationalShippingMethod: line.product.internationalShippingMethod,
    shippingFee: line.shippingFee,
    isAvailable: line.isAvailable,
    isPurchasable: line.isPurchasable,
    priceChanged: line.priceChanged,
    unavailableReason: deriveUnavailableReason(line.isAvailable, line.isPurchasable) ?? undefined,
  };
}

/**
 * Every checked cart line becomes a checkout item, INCLUDING one that's no
 * longer purchasable (sold out, deactivated variant, etc.) — STEP 21 spec
 * section 33/36 needs those visible so CheckoutClient's existing "some
 * items can't be ordered" screen can show them, not silently vanish them
 * from the list (which is what STEP 20's filter here used to do). Only a
 * line whose product no longer exists in the fetched catalog at all is
 * dropped, since there's nothing left to render for it.
 */
export function buildCheckoutItemsFromCart(
  cartItems: CartItem[],
  products: Product[],
  market: Market
): CheckoutItem[] {
  return cartItems
    .filter((item) => item.checked)
    .map((item) => enrichCartItem(item, products, market))
    .filter((line): line is CartLineView => line !== null)
    .map(checkoutItemFromLine);
}

/**
 * Runs the buy-now intent through the same pricing/availability pipeline
 * as the cart, without touching the cart itself. The synthetic item's
 * unitPriceSnapshot is set to the price resolved for it right now (not a
 * real past snapshot) so enrichCartItem never reports a bogus "price
 * changed" for an item that was never actually sitting in a cart.
 */
export function buildCheckoutItemFromBuyNow(
  buyNow: BuyNowItem,
  products: Product[],
  market: Market
): CheckoutItem | null {
  const product = products.find((candidate) => candidate.id === buyNow.productId);
  if (!product) return null;

  const variant = buyNow.variantId ? (product.variants ?? []).find((v) => v.id === buyNow.variantId) ?? null : null;
  // enrichCartItem always treats unitPriceSnapshot as KRW (matching what
  // cart_add_item actually stores) — using product.salePrice (the raw KRW
  // base, not market-converted) here keeps that assumption true instead of
  // double-converting and reporting a bogus "price changed".
  const unitPriceSnapshot = variant ? calculateVariantPrice(product.salePrice, variant.additionalPrice) : product.salePrice;

  const syntheticItem: CartItem = {
    cartItemId: `buynow-${buyNow.productId}-${buyNow.variantId ?? "base"}`,
    productId: buyNow.productId,
    variantId: buyNow.variantId,
    quantity: buyNow.quantity,
    unitPriceSnapshot,
    checked: true,
  };
  const line = enrichCartItem(syntheticItem, products, market);
  return line ? checkoutItemFromLine(line) : null;
}

const GROUP_ORDER: ShippingType[] = ["domestic", "overseas_direct", "overseas_agent", "direct_pickup"];

export function groupCheckoutItemsByShippingType(
  items: CheckoutItem[]
): { shippingType: ShippingType; items: CheckoutItem[] }[] {
  return GROUP_ORDER.map((shippingType) => ({
    shippingType,
    items: items.filter((item) => item.shippingType === shippingType),
  })).filter((group) => group.items.length > 0);
}

/** Overseas-agency groups start life as PURCHASING since the seller has to source the item first. */
export function buildOrderShippingGroups(items: CheckoutItem[]): OrderShippingGroup[] {
  return groupCheckoutItemsByShippingType(items).map((group) => ({
    shippingType: group.shippingType,
    items: group.items,
    shippingFee: group.items.reduce((sum, item) => sum + item.shippingFee, 0),
    status: group.shippingType === "overseas_agent" ? "PURCHASING" : "PREPARING",
  }));
}

export function calculateCheckoutSummary(items: CheckoutItem[]): CartSummaryTotals {
  return summarizeLines(items.filter((item) => item.isAvailable && item.isPurchasable));
}
