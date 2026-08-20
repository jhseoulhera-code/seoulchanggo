import { NextResponse } from "next/server";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { PaymentProvider } from "@/lib/payments/types";

type ConfirmBody = {
  paymentId: string;
  providerPaymentId: string;
  provider: PaymentProvider;
  /** MOCK-only QA toggle — see lib/payments/providers/mock.ts. */
  simulateFailure?: boolean;
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
    simulateFailure: body.simulateFailure,
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
  } as never);

  if (error || !data) {
    console.error("[payments/confirm] confirm_payment RPC failed:", error?.message);
    return NextResponse.json({ ok: false, error: "결제 확인 처리에 실패했습니다." }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, failureCode: result.failureCode, failureMessage: result.failureMessage }, { status: 200 });
  }

  const applied = data as unknown as { status: string };
  return NextResponse.json({ ok: true, status: applied.status });
}
