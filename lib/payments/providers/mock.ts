import "server-only";

import { verifyMockWebhookSignature } from "@/lib/payments/mockWebhookSignature";
import type {
  CancelPaymentResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentStatus,
  ParsedWebhookEvent,
  PaymentProviderAdapter,
  PaymentStatusLookupResult,
  RefundPaymentInput,
  RefundPaymentResult,
  WebhookVerifyInput,
} from "@/lib/payments/types";
import type { CurrencyCode } from "@/types/market";

const KNOWN_STATUSES: NormalizedPaymentStatus[] = ["PAID", "FAILED", "CANCELLED", "REFUNDED", "UNKNOWN"];

/**
 * The only provider with a real (if synthetic) implementation today — every
 * other adapter is a stub (STEP 11 spec section 33). Never falls back to
 * automatically in production; lib/payments/registry.ts only ever selects it
 * when a real provider's credentials are absent, which is always true in
 * this environment but would stop being true the moment KOREA_PG_* etc. are
 * set. `simulateFailure` is the only way to exercise the failure path — a
 * real card is never declined "by default", so this must be opt-in.
 */
export const mockPaymentProvider: PaymentProviderAdapter = {
  provider: "MOCK",

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      ok: true,
      providerPaymentId: `mock_pay_${input.paymentId}`,
      clientData: { mode: "mock", amount: input.amount, currency: input.currencyCode },
    };
  },

  async confirmPayment(input: ConfirmPaymentInput): Promise<ConfirmPaymentResult> {
    if (input.simulateFailure) {
      return { ok: false, failureCode: "MOCK_SIMULATED_FAILURE", failureMessage: "테스트를 위해 의도적으로 실패 처리된 결제입니다." };
    }
    // QA-only: deliberately echoes back a WRONG amount so the amount-mismatch
    // rejection path (_apply_payment_result's PAYMENT_AMOUNT_MISMATCH) can be
    // exercised end-to-end without a real PG ever disagreeing with itself.
    const amount = input.simulateAmountMismatch ? (input.amount ?? 0) + 1 : (input.amount ?? 0);
    return {
      ok: true,
      providerTransactionId: `mock_txn_${input.paymentId}`,
      amount,
      currencyCode: input.currencyCode ?? "KRW",
      approvedAt: new Date().toISOString(),
    };
  },

  async cancelPayment(): Promise<CancelPaymentResult> {
    return { ok: true };
  },

  // STEP 26 — deterministic providerRefundId derived from OUR refund row id,
  // never Date.now(): a retry of the same refundId must resolve to the same
  // provider-side refund rather than creating a second one.
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    return {
      ok: true,
      providerRefundId: `mock_refund_${input.refundId}`,
      amount: input.amount,
      currencyCode: input.currencyCode,
      status: "COMPLETED",
    };
  },

  verifyWebhook(input: WebhookVerifyInput): boolean {
    // STEP 24 — a real HMAC check (lib/payments/mockWebhookSignature.ts), so
    // "invalid signature rejected" is an actually-exercisable scenario
    // against this route, not a permanently-true stub. Header name matches
    // what buildMockWebhookRequest-style test/QA callers must send.
    return verifyMockWebhookSignature(input.rawBody, input.headers["x-mock-signature"]);
  },

  parseWebhook(input: WebhookVerifyInput): ParsedWebhookEvent | null {
    try {
      const body = JSON.parse(input.rawBody) as {
        eventId?: string;
        eventType?: string;
        providerPaymentId?: string;
        status?: string;
        amount?: number;
        currency?: string;
        approvedAt?: string;
        failureCode?: string;
        failureMessage?: string;
      };
      if (!body.eventId || !body.providerPaymentId) return null;

      const status: NormalizedPaymentStatus = KNOWN_STATUSES.includes(body.status as NormalizedPaymentStatus)
        ? (body.status as NormalizedPaymentStatus)
        : "UNKNOWN";

      return {
        providerEventId: body.eventId,
        eventType: body.eventType ?? "payment.updated",
        providerPaymentId: body.providerPaymentId,
        status,
        amount: typeof body.amount === "number" ? body.amount : null,
        currencyCode: (body.currency as CurrencyCode | undefined) ?? null,
        approvedAt: body.approvedAt ?? null,
        failureCode: body.failureCode,
        failureMessage: body.failureMessage,
        payload: body,
      };
    } catch {
      return null;
    }
  },

  async getPaymentStatus(): Promise<PaymentStatusLookupResult> {
    // MOCK confirms synchronously and keeps no backing store of its own to
    // query afterward — a real adapter's implementation queries the PG's
    // own record. Returning a clear "not supported" here (rather than
    // fabricating a status) keeps reconciliation honest about what MOCK
    // actually can and can't tell it.
    return { ok: false, error: "MOCK has no persistent payment record to query — status is only known at confirm/webhook time." };
  },
};
