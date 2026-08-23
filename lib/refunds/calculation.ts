// Pure, Node-testable (no "server-only", no DB access) mirror of
// admin_create_refund/admin_finalize_refund's own arithmetic
// (supabase/migrations/20260906000700_step26_refunds.sql) — the SQL
// function is the actual source of truth and re-derives every one of these
// numbers itself under a row lock; this file exists so the same logic can be
// unit-tested directly and so the admin UI can show a fail-fast "expected
// refund amount" / validation error before ever calling the server action.

/** STEP 26 spec section 7 — order_items.unit_price × refund quantity, the order's own SNAPSHOT price, never a re-fetched live product price. */
export function computeRefundLineAmount(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

/** STEP 26 spec section 8 — "주문 5개, 기존 환불 2개 → 최대 추가 환불 3개". */
export function remainingRefundableQuantity(orderedQuantity: number, alreadyRefundedQuantity: number): number {
  return Math.max(0, orderedQuantity - alreadyRefundedQuantity);
}

/** STEP 26 spec section 9 — over-refund-by-quantity guard, mirrored from admin_create_refund's OVER_REFUND_QUANTITY check. */
export function isOverRefundQuantity(requestedQuantity: number, orderedQuantity: number, alreadyRefundedQuantity: number): boolean {
  return requestedQuantity > remainingRefundableQuantity(orderedQuantity, alreadyRefundedQuantity);
}

export type RefundLineForTotal = { unitPrice: number; quantity: number };

/** STEP 26 spec section 6/26 — item lines plus an admin-provided (never auto-computed) shipping-fee portion. */
export function computeTotalRefundAmount(lines: RefundLineForTotal[], shippingRefundAmount: number): number {
  return lines.reduce((sum, line) => sum + computeRefundLineAmount(line.unitPrice, line.quantity), 0) + shippingRefundAmount;
}

const AMOUNT_TOLERANCE = 1;

/** STEP 26 spec section 9 — over-refund-by-amount guard, mirrored from admin_create_refund's OVER_REFUND_AMOUNT check. */
export function isOverRefundAmount(alreadyRefundedAmount: number, requestedTotalAmount: number, paymentAmount: number): boolean {
  return alreadyRefundedAmount + requestedTotalAmount > paymentAmount + AMOUNT_TOLERANCE;
}

/** STEP 26 spec section 16 — a payment is fully refunded once completed refunds cover its whole amount (within the same tolerance payment finalization uses). */
export function isFullyRefunded(totalCompletedRefundAmount: number, paymentAmount: number): boolean {
  return totalCompletedRefundAmount >= paymentAmount - AMOUNT_TOLERANCE;
}

/** STEP 26 spec section 15 — mirrors admin_finalize_refund's provider amount/currency verification; a mismatch must never be treated as a completed refund. */
export function refundResultMatchesExpected(
  expectedAmount: number,
  expectedCurrency: string,
  providerAmount: number | null,
  providerCurrency: string | null
): boolean {
  if (providerAmount === null || providerCurrency === null) return false;
  return Math.abs(providerAmount - expectedAmount) <= AMOUNT_TOLERANCE && providerCurrency === expectedCurrency;
}
