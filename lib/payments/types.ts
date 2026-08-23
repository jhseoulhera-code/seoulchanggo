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

/**
 * STEP 24 spec section 4 — a normalized outcome every adapter's parseWebhook
 * must collapse its own provider-specific event types into. CANCELLED/
 * REFUNDED are recognized but deliberately NOT auto-actioned this STEP (see
 * process_webhook_payment_event's own comment) — full refund/cancel
 * automation is out of scope; they're only ever logged for reconciliation.
 * UNKNOWN covers any provider event type we don't yet map (never treated as
 * a success).
 */
export type NormalizedPaymentStatus = "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "UNKNOWN";

/**
 * STEP 24 spec section 4/5 — amount/currency are now first-class (STEP 23's
 * known limitation: process_webhook_payment_event always got null/null,
 * which meant a PAID webhook could never actually mark anything PAID). Both
 * are nullable because a real provider's FAILED/CANCELLED event may not
 * carry a charge amount at all — but per the fail-closed rule, a PAID event
 * with a null amount or currency is still never treated as a real success.
 */
export type ParsedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  providerPaymentId: string;
  status: NormalizedPaymentStatus;
  amount: number | null;
  currencyCode: CurrencyCode | null;
  approvedAt?: string | null;
  failureCode?: string;
  failureMessage?: string;
  /** Adapter-internal only — the webhook route builds its own allow-listed metadata for storage, never forwards this wholesale (STEP 24 spec section 30). */
  payload: unknown;
};

export type PaymentStatusLookupResult =
  | { ok: true; status: NormalizedPaymentStatus; amount: number | null; currencyCode: CurrencyCode | null; approvedAt?: string | null }
  | { ok: false; error: string };

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
  /** STEP 24 spec section 18 — forward-compatible reconciliation hook; every stub returns NOT_CONFIGURED today. */
  getPaymentStatus(providerPaymentId: string): Promise<PaymentStatusLookupResult>;
}
