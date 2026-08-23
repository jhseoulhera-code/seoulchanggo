// Pure — STEP 26 spec sections 26-28. Deliberately offers ONLY a validation
// helper (is the admin-typed shipping-refund amount within the remaining
// cap?), never a proportional/automatic "refund N% of shipping" calculator —
// that policy hasn't been decided yet, and inventing one here would be
// exactly the "임의 정책" the spec forbids.

export type ShippingRefundCheckInput = {
  requestedShippingRefundAmount: number;
  alreadyRefundedShippingAmount: number;
  orderShippingAmount: number;
};

export function isValidShippingRefundAmount(input: ShippingRefundCheckInput): boolean {
  if (input.requestedShippingRefundAmount < 0) return false;
  return input.alreadyRefundedShippingAmount + input.requestedShippingRefundAmount <= input.orderShippingAmount;
}
