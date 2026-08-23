import type { CountryCode } from "@/types/market";
import type { Product } from "@/types";

/** UI-local option selection state (e.g. while a customer is picking 색상/사이즈) — no longer part of a stored CartItem, but still useful wherever a "group name -> chosen value" map is needed (OptionSelector, CheckoutItem's display snapshot). */
export type SelectedOptions = Record<string, string>;

/**
 * STEP 20 spec section 2 — the minimum identity a cart line must carry.
 * variantId is undefined/null for an option-less product; two lines with
 * the same identity must merge into one row (see lib/cart/cartLogic.ts's
 * sameCartIdentity), never stack as separate rows.
 */
export type CartItemIdentity = { productId: string; variantId?: string | null };

/**
 * A cart line as stored server-side (cart_items). selectedOptions is gone
 * — STEP 18/19 made every purchasable option combination a real
 * product_variants row, so a line's options are always derivable by
 * joining product_variants via variantId (see lib/cart.ts's
 * enrichCartItem), never trusted as client-supplied display text.
 */
export type CartItem = {
  cartItemId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  /** KRW unit price captured by the server at add-to-cart time — comparison-only, never trusted as the current price (see cart_items.unit_price_snapshot's own migration comment). */
  unitPriceSnapshot: number;
  /** Client-local "selected for checkout" flag — never persisted (matches the pre-STEP-20 cart's own convention). */
  checked: boolean;
};

export type CartLineView = {
  cartItem: CartItem;
  product: Product;
  /** The resolved variant's own option values (e.g. {"색상":"블랙","사이즈":"M"}), {} for an option-less line. */
  optionValues: Record<string, string>;
  /** Customer-facing label built from optionValues (e.g. "블랙 / M"), never the raw DB jsonb. */
  optionLabel: string;
  unitPrice: number;
  unitOriginalPrice: number;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  /** Shippable to the customer's current market — unrelated to stock/sale status (STEP 08's original meaning, unchanged). */
  isAvailable: boolean;
  unavailableCountry?: CountryCode;
  /** STEP 20 spec section 17 — product/variant still sellable (active, in stock, priceable) right now. False excludes the line from totals and future checkout eligibility without needing to remove it from the cart. */
  isPurchasable: boolean;
  /** STEP 20 spec section 4/18 — unitPrice (now) differs from cartItem.unitPriceSnapshot (when added). */
  priceChanged: boolean;
  /** null = not stock-tracked (unlimited); otherwise the live stock backing this exact line (variant or product). */
  currentStock: number | null;
};

export type CartSummaryTotals = {
  itemsTotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  selectedCount: number;
};

export type BuyNowItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};
