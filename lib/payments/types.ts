import type { CurrencyCode, CountryCode } from "@/types/market";
import type { PaymentMethodId } from "@/types/order";

export type PaymentProvider = "KOREA_PG" | "INDIA_PG" | "GLOBAL_PG" | "MOCK";

export type CreatePaymentInput = {
  paymentId: string;
  orderId: string;
  amount: number;
  currencyCode: CurrencyCode;
  paymentMethod: PaymentMethodId;
  marketCode: CountryCode;
};

export type CreatePaymentResult =
  | { ok: true; providerPaymentId: string; redirectUrl?: string; clientData?: Record<string, unknown> }
  | { ok: false; error: string };

export type ConfirmPaymentInput = {
  paymentId: string;
  providerPaymentId: string;
  /**
   * STEP 23 — what the ROUTE believes should be charged (echoed straight
   * from prepare_payment's own response, which itself came from
   * orders.total_amount/currency_code, never client-typed). A real PG
   * adapter ignores this and queries the PG's own record of what it
   * actually charged instead — MOCK has no real backing store, so it
   * echoes this back as its "confirmed" amount, which is what makes it a
   * faithful stand-in: the real security check (ConfirmPaymentResult's
   * amount/currencyCode vs payments.amount/currency_code) happens
   * server-side in _apply_payment_result regardless of where this number
   * originated, so a forged confirm request still gets rejected there.
   */
  amount?: number;
  currencyCode?: CurrencyCode;
  /** Only meaningful for MOCK — lets Checkout QA a failed-payment path without a real PG. */
  simulateFailure?: boolean;
  /** Only meaningful for MOCK — lets Checkout QA the amount-mismatch rejection path without a real PG. */
  simulateAmountMismatch?: boolean;
};

export type ConfirmPaymentResult =
  | {
      ok: true;
      providerTransactionId: string;
      /** STEP 23 spec section 25 — the provider's OWN normalized confirmation, never a raw provider payload. */
      amount: number;
      currencyCode: CurrencyCode;
      approvedAt: string;
    }
  | { ok: false; failureCode: string; failureMessage: string };

export type CancelPaymentInput = { providerPaymentId: string };
export type CancelPaymentResult = { ok: true } | { ok: false; error: string };

export type RefundPaymentInput = { providerPaymentId: string; amount: number; reason: string };
export type RefundPaymentResult = { ok: true; providerRefundId: string } | { ok: false; error: string };

export type WebhookVerifyInput = { headers: Record<string, string>; rawBody: string };

export type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  providerPaymentId: string;
  success: boolean;
  failureCode?: string;
  failureMessage?: string;
  payload: unknown;
};

/**
 * Every real PG integration implements this and nothing outside
 * lib/payments/ ever calls a provider SDK directly (STEP 11 spec section 5)
 * — Checkout, the Route Handlers, and the webhook route only ever talk to
 * this interface via lib/payments/registry.ts.
 */
export interface PaymentProviderAdapter {
  provider: PaymentProvider;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult>;
  cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;
  verifyWebhook(input: WebhookVerifyInput): boolean;
  parseWebhook(input: WebhookVerifyInput): ParsedWebhookEvent | null;
}
