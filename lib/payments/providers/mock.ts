import "server-only";

import type {
  CancelPaymentResult,
  ConfirmPaymentInput,
  ConfirmPaymentResult,
  CreatePaymentInput,
  CreatePaymentResult,
  ParsedWebhookEvent,
  PaymentProviderAdapter,
  RefundPaymentResult,
  WebhookVerifyInput,
} from "@/lib/payments/types";

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
    return { ok: true, providerTransactionId: `mock_txn_${input.paymentId}` };
  },

  async cancelPayment(): Promise<CancelPaymentResult> {
    return { ok: true };
  },

  async refundPayment(): Promise<RefundPaymentResult> {
    return { ok: true, providerRefundId: `mock_refund_${Date.now()}` };
  },

  verifyWebhook(): boolean {
    // No real signature scheme — Mock never sends real webhooks in this flow.
    return true;
  },

  parseWebhook(input: WebhookVerifyInput): ParsedWebhookEvent | null {
    try {
      const body = JSON.parse(input.rawBody) as {
        eventId?: string;
        eventType?: string;
        providerPaymentId?: string;
        success?: boolean;
        failureCode?: string;
        failureMessage?: string;
      };
      if (!body.eventId || !body.providerPaymentId) return null;
      return {
        providerEventId: body.eventId,
        eventType: body.eventType ?? "payment.updated",
        providerPaymentId: body.providerPaymentId,
        success: Boolean(body.success),
        failureCode: body.failureCode,
        failureMessage: body.failureMessage,
        payload: body,
      };
    } catch {
      return null;
    }
  },
};
