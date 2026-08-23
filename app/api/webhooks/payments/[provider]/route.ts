import { NextResponse } from "next/server";
import { getPaymentAdapter } from "@/lib/payments/registry";
import { createServiceRoleClient } from "@/lib/supabase/serviceClient";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { NormalizedPaymentStatus, PaymentProvider } from "@/lib/payments/types";

const KNOWN_PROVIDERS: PaymentProvider[] = ["KOREA_PG", "INDIA_PG", "GLOBAL_PG", "MOCK"];

function parseProvider(raw: string): PaymentProvider | null {
  const upper = raw.toUpperCase();
  return (KNOWN_PROVIDERS as string[]).includes(upper) ? (upper as PaymentProvider) : null;
}

/**
 * STEP 24 — the same route STEP 11 stubbed out, now actually wired end to
 * end. Server-to-server only (never a browser session), which is why this
 * uses the service-role client: process_webhook_payment_event() isn't
 * granted to authenticated/anon at all, so only this route (or equivalent
 * trusted server code) can reach it.
 *
 * Signature verification runs on the RAW body text (never a parsed-then-
 * restringified copy, which could differ byte-for-byte from what the
 * provider actually signed) and strictly before anything touches the DB —
 * no adapter, no real credentials configured yet means every real
 * provider's verifyWebhook() returns false today (lib/payments/providers/
 * stubFactory.ts), so this route stays inert for them until a real adapter
 * exists. MOCK's verifyWebhook is a real HMAC check now (STEP 24), so this
 * route's rejection path is genuinely exercisable in dev/test.
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
    // Signature invalid — 401. A provider that genuinely never gets a valid
    // signature accepted (misconfigured secret) will keep retrying, which is
    // the correct behavior: this is not "message processed", so it must not
    // be a 2xx (STEP 24 spec section 35).
    console.error(`[webhooks/payments/${provider}] signature verification failed`);
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  const event = adapter.parseWebhook({ headers, rawBody });
  // A body that doesn't even parse into the provider's own expected shape,
  // or is missing the two identifiers every downstream step needs
  // (providerEventId for the idempotency ledger, providerPaymentId to find
  // OUR payment row) can never be turned into a resolvable action — 400,
  // never retried the same way (STEP 24 spec section 35).
  if (!event || !event.providerEventId || !event.providerPaymentId) {
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

    // STEP 24 — allow-listed metadata only, never event.payload wholesale
    // (spec section 30/31): a real provider's webhook body could carry
    // customer PII or payment-instrument fragments this app has no reason
    // to retain. Only the handful of fields this app itself already treats
    // as non-sensitive identifiers are stored.
    const auditMetadata = {
      eventType: event.eventType,
      status: event.status,
      providerPaymentId: event.providerPaymentId,
      approvedAt: event.approvedAt ?? null,
      failureCode: event.failureCode ?? null,
    };

    // STEP 23's known limitation, fixed here: the provider's own reported
    // amount/currency now actually flow into the RPC, so a PAID webhook can
    // finally result in a real PAID payment instead of always failing
    // PAYMENT_AMOUNT_MISMATCH. process_webhook_payment_event only ever
    // routes PAID/FAILED into _apply_payment_result (the SAME finalize path
    // the browser confirm route uses — no duplicated stock-decrement logic);
    // CANCELLED/REFUNDED/UNKNOWN are recorded in payment_events for
    // reconciliation but never auto-actioned this STEP (see the RPC's own comment).
    const normalizedStatus: NormalizedPaymentStatus = event.status;

    const { data, error: rpcError } = await supabase.rpc("process_webhook_payment_event", {
      p_provider: provider,
      p_provider_event_id: event.providerEventId,
      p_payment_id: (payment as unknown as { id: string }).id,
      p_event_type: event.eventType,
      p_payload: auditMetadata as never,
      p_normalized_status: normalizedStatus,
      p_provider_payment_id: event.providerPaymentId,
      p_provider_transaction_id: null,
      p_failure_code: event.failureCode ?? null,
      p_failure_message: event.failureMessage ?? null,
      p_provider_amount: event.amount,
      p_provider_currency: event.currencyCode,
    } as never);

    if (rpcError) {
      // A genuine internal failure (DB unreachable, unexpected error) — 500
      // so the provider retries, since we did NOT successfully record this
      // event (unlike a duplicate, which the RPC itself reports as ok).
      console.error(`[webhooks/payments/${provider}] process_webhook_payment_event failed:`, rpcError.message);
      return NextResponse.json({ ok: false, error: "processing failed" }, { status: 500 });
    }

    // Whatever the RPC's verdict — PAID, FAILED, already_processed, or
    // LOGGED_FOR_REVIEW — we successfully received and recorded the event,
    // so the provider must not retry it: 200 either way (STEP 24 spec
    // section 35's "정상 처리/중복 event → 2xx").
    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error(`[webhooks/payments/${provider}] unexpected error:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
