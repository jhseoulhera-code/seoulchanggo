import { createCartItemId, enrichCartItem, summarizeLines } from "@/lib/cart";
import type { Product, ShippingType } from "@/types";
import type { BuyNowItem, CartItem, CartLineView, CartSummaryTotals } from "@/types/cart";
import type { Market } from "@/types/market";
import type { CheckoutItem, OrderShippingGroup } from "@/types/order";

function checkoutItemFromLine(line: CartLineView): CheckoutItem {
  return {
    cartItemId: line.cartItem.cartItemId,
    productId: line.product.id,
    productName: line.product.name,
    image: line.product.image,
    category: line.product.category,
    selectedOptions: line.cartItem.selectedOptions,
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
  };
}

/** Only the checked cart lines become checkout items — unselected items stay behind in the cart. */
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

/** Runs the buy-now intent through the same pricing/availability pipeline as the cart, without touching the cart itself. */
export function buildCheckoutItemFromBuyNow(
  buyNow: BuyNowItem,
  products: Product[],
  market: Market
): CheckoutItem | null {
  const syntheticItem: CartItem = {
    cartItemId: createCartItemId(buyNow.productId, buyNow.selectedOptions),
    productId: buyNow.productId,
    selectedOptions: buyNow.selectedOptions,
    quantity: buyNow.quantity,
    checked: true,
  };
  const line = enrichCartItem(syntheticItem, products, market);
  return line ? checkoutItemFromLine(line) : null;
}

const GROUP_ORDER: ShippingType[] = ["domestic", "overseas_direct", "overseas_agent"];

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
  return summarizeLines(items.filter((item) => item.isAvailable));
}
