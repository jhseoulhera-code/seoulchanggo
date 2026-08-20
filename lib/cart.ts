import { getProductMarketPrice } from "@/lib/currency";
import { getShippingFeeForMarket, isProductAvailableInMarket } from "@/lib/shipping";
import type { Product, ShippingType } from "@/types";
import type { CartItem, CartLineView, CartSummaryTotals, SelectedOptions } from "@/types/cart";
import type { Market } from "@/types/market";

export function createCartItemId(productId: string, selectedOptions: SelectedOptions): string {
  const optionKey = Object.entries(selectedOptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, choice]) => `${group}:${choice}`)
    .join("|");
  return optionKey ? `${productId}__${optionKey}` : productId;
}

export function formatOptionLabel(selectedOptions: SelectedOptions): string {
  return Object.values(selectedOptions).join(" / ");
}

/** Joins a cart line with its live product record and resolves price/fee/availability for the current market. */
export function enrichCartItem(
  item: CartItem,
  products: Product[],
  market: Market
): CartLineView | null {
  const product = products.find((candidate) => candidate.id === item.productId);
  if (!product) return null;

  const { salePrice, originalPrice } = getProductMarketPrice(product, market);
  const isAvailable = isProductAvailableInMarket(product, market.countryCode);

  return {
    cartItem: item,
    product,
    optionLabel: formatOptionLabel(item.selectedOptions),
    unitPrice: salePrice,
    unitOriginalPrice: originalPrice,
    subtotal: salePrice * item.quantity,
    discountAmount: Math.max(0, originalPrice - salePrice) * item.quantity,
    shippingFee: getShippingFeeForMarket(product, market),
    isAvailable,
    unavailableCountry: isAvailable ? undefined : market.countryCode,
  };
}

export function enrichCartItems(
  items: CartItem[],
  products: Product[],
  market: Market
): CartLineView[] {
  return items
    .map((item) => enrichCartItem(item, products, market))
    .filter((line): line is CartLineView => line !== null);
}

const GROUP_ORDER: ShippingType[] = ["domestic", "overseas_direct", "overseas_agent"];

export function groupLinesByShippingType(
  lines: CartLineView[]
): { shippingType: ShippingType; lines: CartLineView[] }[] {
  return GROUP_ORDER.map((shippingType) => ({
    shippingType,
    lines: lines.filter((line) => line.product.shippingType === shippingType),
  })).filter((group) => group.lines.length > 0);
}

export type PricedLine = {
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
};

/** Shared totals arithmetic for anything shaped like a priced line — cart lines and checkout items alike. */
export function summarizeLines(lines: PricedLine[]): CartSummaryTotals {
  return {
    itemsTotal: lines.reduce((sum, line) => sum + line.subtotal, 0),
    discountTotal: lines.reduce((sum, line) => sum + line.discountAmount, 0),
    shippingTotal: lines.reduce((sum, line) => sum + line.shippingFee, 0),
    grandTotal: lines.reduce((sum, line) => sum + line.subtotal + line.shippingFee, 0),
    selectedCount: lines.length,
  };
}

export function calculateCartSummary(lines: CartLineView[]): CartSummaryTotals {
  return summarizeLines(lines.filter((line) => line.cartItem.checked && line.isAvailable));
}
