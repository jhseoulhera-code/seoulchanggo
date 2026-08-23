// Relative + .ts-extensioned (not "@/" aliases) so this stays importable by
// scripts/test-cart.mts under plain Node — same reasoning as
// lib/ai/productAssistant's cross-file imports (see that subtree's
// registry.ts for the original precedent). Every other caller in the app
// still imports these via "@/lib/..." as usual; only this file's own
// references changed.
import { convertFromKrw, getProductMarketPrice } from "./currency.ts";
import { hasPriceChanged } from "./cart/cartLogic.ts";
import { calculateVariantPrice, getEffectiveStock, isProductSoldOut } from "./storefront/productVariants.ts";
import { getShippingFeeForMarket, isProductAvailableInMarket } from "./shipping.ts";
import type { Product, ShippingType } from "@/types";
import type { CartItem, CartLineView, CartSummaryTotals } from "@/types/cart";
import type { Market } from "@/types/market";

function buildOptionLabel(optionValues: Record<string, string>): string {
  return Object.values(optionValues).join(" / ");
}

/**
 * Joins a cart line with its live product/variant record and resolves
 * price/stock/availability for the current market — STEP 20 spec section
 * 16's "실시간 재검증" (never trust the stored snapshot alone). Returns null
 * only when the product itself no longer exists in the fetched catalog
 * (deleted, or filtered out because it's inactive — getAllProducts already
 * excludes inactive products), matching the pre-STEP-20 behavior exactly.
 *
 * A line whose variantId no longer resolves to any variant on the product
 * (the variant was deleted — cart_items.variant_id is ON DELETE CASCADE as
 * of the STEP 20 migration, so this path is defensive rather than expected
 * in practice) is treated as unpurchasable rather than silently priced as
 * if it were option-less.
 */
export function enrichCartItem(item: CartItem, products: Product[], market: Market): CartLineView | null {
  const product = products.find((candidate) => candidate.id === item.productId);
  if (!product) return null;

  const hasOptions = Boolean(product.options && product.options.length > 0);
  const variant = item.variantId ? (product.variants ?? []).find((v) => v.id === item.variantId) ?? null : null;
  const isAvailable = isProductAvailableInMarket(product, market.countryCode);

  if (item.variantId && !variant) {
    return {
      cartItem: item,
      product,
      optionValues: {},
      optionLabel: "",
      unitPrice: 0,
      unitOriginalPrice: 0,
      subtotal: 0,
      discountAmount: 0,
      shippingFee: 0,
      isAvailable,
      unavailableCountry: isAvailable ? undefined : market.countryCode,
      isPurchasable: false,
      priceChanged: false,
      currentStock: 0,
    };
  }

  const { salePrice: baseSale, originalPrice: baseOriginal } = getProductMarketPrice(product, market);
  // additional_price is a raw KRW delta with no per-market override (STEP
  // 18/19's documented limitation) — converted the same way the base price
  // already is for a non-KRW market, so the two stay comparable.
  const additionalConverted = variant
    ? market.currency === "KRW"
      ? variant.additionalPrice
      : convertFromKrw(variant.additionalPrice, market.currency)
    : 0;
  const unitPrice = variant ? calculateVariantPrice(baseSale, additionalConverted) : baseSale;
  const unitOriginalPrice = variant ? calculateVariantPrice(baseOriginal, additionalConverted) : baseOriginal;

  const rawStock = hasOptions ? getEffectiveStock(true, variant, product.stock) : getEffectiveStock(false, null, product.stock);
  const currentStock = Number.isFinite(rawStock) ? rawStock : null;

  const soldOut = hasOptions
    ? isProductSoldOut(true, product.variants ?? [], product.stock)
    : isProductSoldOut(false, [], product.stock);
  const variantActive = variant ? variant.isActive : true;
  const isPurchasable = isAvailable && !soldOut && variantActive && (!hasOptions || Boolean(variant));

  // unit_price_snapshot is always KRW (cart_add_item's own documented
  // convention, matching additional_price) — convert it the same way for
  // an apples-to-apples comparison in whatever currency is being displayed.
  // A customer whose market has an explicit non-KRW override price
  // (product.marketPrices/globalPrice) will see that override reflected in
  // unitPrice above but not in this converted snapshot — a known, disclosed
  // limitation shared with STEP 18/19's own KRW-only variant pricing scope.
  const snapshotInMarketCurrency =
    market.currency === "KRW" ? item.unitPriceSnapshot : convertFromKrw(item.unitPriceSnapshot, market.currency);

  return {
    cartItem: item,
    product,
    optionValues: variant?.optionValues ?? {},
    optionLabel: variant ? buildOptionLabel(variant.optionValues) : "",
    unitPrice,
    unitOriginalPrice,
    subtotal: unitPrice * item.quantity,
    discountAmount: Math.max(0, unitOriginalPrice - unitPrice) * item.quantity,
    shippingFee: getShippingFeeForMarket(product, market),
    isAvailable,
    unavailableCountry: isAvailable ? undefined : market.countryCode,
    isPurchasable,
    priceChanged: hasPriceChanged(snapshotInMarketCurrency, unitPrice),
    currentStock,
  };
}

export function enrichCartItems(items: CartItem[], products: Product[], market: Market): CartLineView[] {
  return items.map((item) => enrichCartItem(item, products, market)).filter((line): line is CartLineView => line !== null);
}

/**
 * STEP 20 spec section 20/21 — fulfillment-type grouping for the cart page.
 * Product.shippingType (domestic/overseas_direct/overseas_agent) already
 * exists project-wide (STEP 08) and already drove this exact grouping
 * before STEP 20 — reused as-is, not reinvented, since it's precisely the
 * "국내/해외직배송/구매대행" split the spec describes.
 */
const GROUP_ORDER: ShippingType[] = ["domestic", "overseas_direct", "overseas_agent"];

export function groupLinesByShippingType(lines: CartLineView[]): { shippingType: ShippingType; lines: CartLineView[] }[] {
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

/** STEP 20 spec section 17 — an unpurchasable line (sold out, deactivated, no longer sold) never contributes to the total the customer sees, even if still checked. */
export function calculateCartSummary(lines: CartLineView[]): CartSummaryTotals {
  return summarizeLines(lines.filter((line) => line.cartItem.checked && line.isAvailable && line.isPurchasable));
}
