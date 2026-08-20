import { NextResponse } from "next/server";
import { getPaymentAdapter, resolveProviderForMarket } from "@/lib/payments/registry";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { CountryCode } from "@/types/market";
import type { PaymentMethodId } from "@/types/order";

type PrepareBody = {
  orderId: string;
  paymentMethod: PaymentMethodId;
  marketCode: CountryCode;
  guestContact?: string;
};

/**
 * Order → Payment handoff (STEP 11 spec section 12). The heavy lifting —
 * ownership check, payable-state check, amount/currency derivation from the
 * order row itself — happens inside the prepare_payment() RPC; this route
 * only picks which provider adapter to hand the resulting payment to.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase가 연결되어 있지 않습니다." }, { status: 503 });
  }

  let body: PrepareBody;
  try {
    body = (await request.json()) as PrepareBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (!body.orderId || !body.paymentMethod || !body.marketCode) {
    return NextResponse.json({ ok: false, error: "필수 정보가 누락되었습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const provider = resolveProviderForMarket(body.marketCode);

  const { data, error } = await supabase.rpc("prepare_payment", {
    p_order_id: body.orderId,
    p_payment_method: body.paymentMethod,
    p_provider: provider,
    p_guest_contact: body.guestContact ?? null,
  } as never);

  if (error || !data) {
    console.error("[payments/prepare] prepare_payment RPC failed:", error?.message);
    return NextResponse.json({ ok: false, error: "결제를 준비하지 못했습니다." }, { status: 400 });
  }

  const prepared = data as unknown as { payment_id: string; amount: number; currency_code: string; market_code: string };
  const adapter = getPaymentAdapter(provider);

  const created = await adapter.createPayment({
    paymentId: prepared.payment_id,
    orderId: body.orderId,
    amount: prepared.amount,
    currencyCode: prepared.currency_code as never,
    paymentMethod: body.paymentMethod,
    marketCode: prepared.market_code as CountryCode,
  });

  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    paymentId: prepared.payment_id,
    provider,
    providerPaymentId: created.providerPaymentId,
    clientData: created.clientData ?? null,
    amount: prepared.amount,
    currencyCode: prepared.currency_code,
  });
}
