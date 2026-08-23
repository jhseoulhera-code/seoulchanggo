/**
 * STEP 19 spec section 16 — the shape a real cart/order write would need
 * (productId + optional variantId + the exact sku/quantity/unitPrice the
 * customer confirmed), computed and validated on the product detail page
 * but deliberately not sent anywhere yet: this step only normalizes the
 * customer's current, valid selection into this shape so STEP 20 can wire
 * it into a real cart/order call without re-deriving any of this logic.
 */
export type PurchaseSelection = {
  productId: string;
  variantId?: string;
  sku: string;
  quantity: number;
  unitPrice: number;
};
