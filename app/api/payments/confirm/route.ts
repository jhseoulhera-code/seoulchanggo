import { NextResponse } from "next/server";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { PaymentProvider } from "@/lib/payments/types";

type ConfirmBody = {
  paymentId: string;
  providerPaymentId: string;
  provider: PaymentProvider;
  /**
   * STEP 23 — echoed from the prepare_payment response (itself derived
   * server-side from orders.total_amount/currency_code), passed through to
   * the adapter so MOCK has something to confirm against. This is never
   * the actual security boundary: confirm_payment() below re-compares
   * whatever the adapter reports against payments.amount/currency_code
   * itself, so a client that forges these merely makes MOCK "confirm" the
   * wrong number, which then gets rejected server-side regardless.
   */
  amount?: number;
  currencyCode?: string;
  /** MOCK-only QA toggle — see lib/payments/providers/mock.ts. */
  simulateFailure?: boolean;
  /** MOCK-only QA toggle for the amount-mismatch rejection path — see lib/payments/providers/mock.ts. */
  simulateAmountMismatch?: boolean;
  guestContact?: string;
};

/**
 * Confirms a payment (STEP 11 spec section 13). Success/failure is never
 * taken from the request body directly — the route calls the provider
 * adapter itself and uses ITS verdict as p_success for confirm_payment(),
 * so a client can't just assert "it worked". simulateFailure only steers
 * the MOCK adapter's own decision (a QA affordance, not a bypass — MOCK
 * isn't gating anything of real value).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase가 연결되어 있지 않습니다." }, { status: 503 });
  }

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!body.paymentId || !body.providerPaymentId || !body.provider) {
    return NextResponse.json({ ok: false, error: "필수 정보가 누락되었습니다." }, { status: 400 });
  }

  const adapter = getPaymentAdapter(body.provider);
  const result = await adapter.confirmPayment({
    paymentId: body.paymentId,
    providerPaymentId: body.providerPaymentId,
    amount: body.amount,
    currencyCode: body.currencyCode as never,
    simulateFailure: body.simulateFailure,
    simulateAmountMismatch: body.simulateAmountMismatch,
  });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_payment", {
    p_payment_id: body.paymentId,
    p_success: result.ok,
    p_provider_payment_id: body.providerPaymentId,
    p_provider_transaction_id: result.ok ? result.providerTransactionId : null,
    p_failure_code: result.ok ? null : result.failureCode,
    p_failure_message: result.ok ? null : result.failureMessage,
    p_guest_contact: body.guestContact ?? null,
    // STEP 23 — the actual security check: _apply_payment_result compares
    // these against payments.amount/currency_code (never against this
    // route's own body) before ever marking a payment PAID.
    p_provider_amount: result.ok ? result.amount : null,
    p_provider_currency: result.ok ? result.currencyCode : null,
  } as never);

  if (error || !data) {
    console.error("[payments/confirm] confirm_payment RPC failed:", error?.message);
    return NextResponse.json({ ok: false, error: "결제 확인 처리에 실패했습니다." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, failureCode: result.failureCode, failureMessage: result.failureMessage }, { status: 200 });
  }

  // STEP 23 — the adapter itself said "ok", but _apply_payment_result can
  // still resolve to FAILED server-side (amount/currency mismatch, or a
  // stock shortfall discovered only at finalize time) — that verdict, not
  // the adapter's, is what actually happened to the payment.
  const applied = data as unknown as { status: string; failure_code?: string };
  if (applied.status !== "PAID") {
    return NextResponse.json(
      { ok: false, failureCode: applied.failure_code ?? "UNKNOWN", failureMessage: "결제를 확정하지 못했습니다." },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, status: applied.status });
}
