import type { PaymentMethodId } from "@/types/order";
import type { CountryCode } from "@/types/market";

export type AttemptPaymentInput = {
  orderId: string;
  paymentMethod: PaymentMethodId;
  marketCode: CountryCode;
  guestContact?: string;
  simulateFailure?: boolean;
  simulateAmountMismatch?: boolean;
};

export type AttemptPaymentResult =
  | { ok: true; status: string }
  | { ok: false; stage: "prepare" | "confirm"; error?: string; failureCode?: string; failureMessage?: string };

/**
 * STEP 24 spec section 23/24 — the ONE place that runs prepare_payment →
 * adapter.createPayment → adapter.confirmPayment → confirm_payment. Used by
 * both the initial Checkout flow (components/checkout/CheckoutClient.tsx)
 * and the order-detail "retry payment" button
 * (app/mypage/orders/[orderId]/page.tsx) so a retry is structurally
 * guaranteed to go through the exact same server-side path — never a
 * second, slightly-different implementation, and never a new order (this
 * only ever takes an existing orderId).
 */
export async function attemptPayment(input: AttemptPaymentInput): Promise<AttemptPaymentResult> {
  const prepareResponse = await fetch("/api/payments/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: input.orderId,
      paymentMethod: input.paymentMethod,
      marketCode: input.marketCode,
      guestContact: input.guestContact,
    }),
  });
  const prepared = await prepareResponse.json();
  if (!prepared.ok) {
    return { ok: false, stage: "prepare", error: prepared.error };
  }

  const confirmResponse = await fetch("/api/payments/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId: prepared.paymentId,
      providerPaymentId: prepared.providerPaymentId,
      provider: prepared.provider,
      amount: prepared.amount,
      currencyCode: prepared.currencyCode,
      simulateFailure: prepared.provider === "MOCK" ? input.simulateFailure : undefined,
      simulateAmountMismatch: prepared.provider === "MOCK" ? input.simulateAmountMismatch : undefined,
      guestContact: input.guestContact,
    }),
  });
  const confirmed = await confirmResponse.json();
  if (!confirmed.ok) {
    return { ok: false, stage: "confirm", error: confirmed.error, failureCode: confirmed.failureCode, failureMessage: confirmed.failureMessage };
  }

  return { ok: true, status: confirmed.status };
}
