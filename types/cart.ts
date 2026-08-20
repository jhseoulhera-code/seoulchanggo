import type { CountryCode } from "@/types/market";
import type { Product } from "@/types";

export type SelectedOptions = Record<string, string>;

/**
 * Normalized cart line — mirrors the shape a real cart_items table would use
 * (productId + options + quantity), so it can be swapped for a server/DB-backed
 * cart later without changing how the UI reads price/shipping/availability.
 */
export type CartItem = {
  cartItemId: string;
  productId: string;
  selectedOptions: SelectedOptions;
  quantity: number;
  checked: boolean;
};

export type CartLineView = {
  cartItem: CartItem;
  product: Product;
  optionLabel: string;
  unitPrice: number;
  unitOriginalPrice: number;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  isAvailable: boolean;
  unavailableCountry?: CountryCode;
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
  selectedOptions: SelectedOptions;
  quantity: number;
};
