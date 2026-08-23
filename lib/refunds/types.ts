// Relative-import-free, pure — Node-testable like lib/shipping/carriers.ts.
// STEP 26 spec section 6/33 — the client only ever chooses WHICH order items
// and how much quantity to refund, and picks a reason code; it never
// computes or sends an amount (admin_create_refund derives that from
// order_items snapshots server-side).

export type RefundLineInput = {
  orderItemId: string;
  quantity: number;
};

export type RefundReasonCode = "CUSTOMER_REQUEST" | "OUT_OF_STOCK" | "DELIVERY_ISSUE" | "PRODUCT_ISSUE" | "OTHER";

export const REFUND_REASON_LABEL: Record<RefundReasonCode, string> = {
  CUSTOMER_REQUEST: "고객요청",
  OUT_OF_STOCK: "품절",
  DELIVERY_ISSUE: "배송불가",
  PRODUCT_ISSUE: "상품문제",
  OTHER: "기타",
};

export const REFUND_REASON_CODES: RefundReasonCode[] = ["CUSTOMER_REQUEST", "OUT_OF_STOCK", "DELIVERY_ISSUE", "PRODUCT_ISSUE", "OTHER"];
