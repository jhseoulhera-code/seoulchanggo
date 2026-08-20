import { NextResponse } from "next/server";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { createServiceRoleClient } from "@/lib/supabase/serviceClient";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { PaymentProvider } from "@/lib/payments/types";

const KNOWN_PROVIDERS: PaymentProvider[] = ["KOREA_PG", "INDIA_PG", "GLOBAL_PG", "MOCK"];

function parseProvider(raw: string): PaymentProvider | null {
  const upper = raw.toUpperCase();
  return (KNOWN_PROVIDERS as string[]).includes(upper) ? (upper as PaymentProvider) : null;
}

/**
 * Structure for future real-PG webhooks (STEP 11 spec section 14). Uses the
 * service-role client deliberately — this is server-to-server, never a
 * browser session, and process_webhook_payment_event() isn't even granted
 * to authenticated/anon, so only this route (or equivalent trusted code) can
 * call it. Signature verification happens before anything else touches the
 * DB: no adapter, no real credentials configured yet means every real
 * provider's verifyWebhook() returns false today (by design — see
 * lib/payments/providers/stubFactory.ts), so this route is inert until a
 * real adapter is implemented.
 */
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = parseProvider(rawProvider);
  if (!provider) {
    return NextResponse.json({ ok: false, error: "unknown provider" }, { status: 404 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase가 연결되어 있지 않습니다." }, { status: 503 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const adapter = getPaymentAdapter(provider);

  if (!adapter.verifyWebhook({ headers, rawBody })) {
    console.error(`[webhooks/payments/${provider}] signature verification failed`);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const event = adapter.parseWebhook({ headers, rawBody });
  if (!event) {
    return NextResponse.json({ ok: false, error: "unparseable event" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: payment, error: lookupError } = await supabase
      .from("payments")
      .select("id")
      .eq("provider_payment_id", event.providerPaymentId)
      .maybeSingle();

    if (lookupError || !payment) {
      console.error(`[webhooks/payments/${provider}] payment not found for`, event.providerPaymentId);
      return NextResponse.json({ ok: false, error: "payment not found" }, { status: 404 });
    }

    const { error: rpcError } = await supabase.rpc("process_webhook_payment_event", {
      p_provider: provider,
      p_provider_event_id: event.providerEventId,
      p_payment_id: (payment as unknown as { id: string }).id,
      p_event_type: event.eventType,
      p_payload: event.payload as never,
      p_success: event.success,
      p_failure_code: event.failureCode ?? null,
      p_failure_message: event.failureMessage ?? null,
    } as never);

    if (rpcError) {
      console.error(`[webhooks/payments/${provider}] process_webhook_payment_event failed:`, rpcError.message);
      return NextResponse.json({ ok: false, error: "processing failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[webhooks/payments/${provider}] unexpected error:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
