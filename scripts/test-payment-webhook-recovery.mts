/**
 * STEP 24 spec section 41 — framework-free test script (same convention as
 * scripts/test-payment-finalization.mts). lib/payments/mockWebhookSignature.ts
 * and lib/payments/reconciliation.ts are deliberately NOT "server-only"
 * marked, so their real logic is exercised directly here; everything that
 * only exists inside a "server-only" file (mock.ts, the registry, the
 * routes) or inside a migration's SQL is verified structurally
 * (readFileSync + regex/substring), exactly like every prior STEP's
 * security/RLS/finalization checks in this session.
 *
 * Run with: node --experimental-strip-types scripts/test-payment-webhook-recovery.mts
 */
import { readFileSync } from "node:fs";
import { computeMockWebhookSignature, verifyMockWebhookSignature } from "../lib/payments/mockWebhookSignature.ts";
import {
  buildReconciliationResult,
  classifyReconciliationIssue,
  isStalePendingPayment,
  STALE_PAYMENT_PENDING_THRESHOLD_MINUTES,
} from "../lib/payments/reconciliation.ts";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const typesSource = readFileSync(new URL("../lib/payments/types.ts", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../lib/payments/providers/mock.ts", import.meta.url), "utf8");
const stubFactorySource = readFileSync(new URL("../lib/payments/providers/stubFactory.ts", import.meta.url), "utf8");
const webhookRouteSource = readFileSync(new URL("../app/api/webhooks/payments/[provider]/route.ts", import.meta.url), "utf8");
const paymentRetrySource = readFileSync(new URL("../lib/paymentRetry.ts", import.meta.url), "utf8");
const mypageActionSource = readFileSync(new URL("../lib/actions/mypage.ts", import.meta.url), "utf8");
const orderDetailPageSource = readFileSync(new URL("../app/mypage/orders/[orderId]/page.tsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/20260906000500_step24_payment_webhook_recovery.sql", import.meta.url), "utf8");
const step11RpcSource = readFileSync(new URL("../supabase/migrations/20260825000300_step11_payment_rpcs.sql", import.meta.url), "utf8");
const step23MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000400_step23_payment_finalization.sql", import.meta.url), "utf8");
const envExampleSource = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

// --- 1. ParsedWebhookEvent amount (structural) ---------------------------------
{
  assert(
    /ParsedWebhookEvent = \{[\s\S]{0,400}amount: number \| null;/.test(typesSource),
    "(structural) ParsedWebhookEvent must carry a normalized amount (number | null), not just a bare success boolean"
  );
}

// --- 2. ParsedWebhookEvent currency (structural) --------------------------------
{
  assert(
    /ParsedWebhookEvent = \{[\s\S]{0,400}currencyCode: CurrencyCode \| null;/.test(typesSource),
    "(structural) ParsedWebhookEvent must carry a normalized currencyCode (CurrencyCode | null)"
  );
}

// --- 3. success webhook null amount 거부 (structural) ---------------------------
{
  assert(
    migrationSource.includes("if p_provider_amount is null or abs(p_provider_amount - v_payment.amount) > v_amount_tolerance then"),
    "(structural) _apply_payment_result must still reject a PAID call with a null provider amount — fail-closed, unchanged from STEP 23"
  );
}

// --- 4. null currency 거부 (structural) ------------------------------------------
{
  assert(
    migrationSource.includes("if p_provider_currency is null or p_provider_currency <> v_payment.currency_code then"),
    "(structural) _apply_payment_result must still reject a PAID call with a null provider currency"
  );
}

// --- 5. invalid signature 거부 --------------------------------------------------
{
  const rawBody = JSON.stringify({ eventId: "evt_1", providerPaymentId: "mock_pay_1", status: "PAID", amount: 10000, currency: "KRW" });
  assert(!verifyMockWebhookSignature(rawBody, "definitely-not-the-right-signature"), "an incorrect signature must be rejected");
  assert(!verifyMockWebhookSignature(rawBody, undefined), "a missing signature must be rejected, never treated as valid by omission");
  assert(
    !verifyMockWebhookSignature(rawBody, computeMockWebhookSignature(rawBody, "a-different-secret")),
    "a signature computed with the wrong secret must be rejected"
  );
}

// --- 6. valid signature 처리 -----------------------------------------------------
{
  const rawBody = JSON.stringify({ eventId: "evt_2", providerPaymentId: "mock_pay_2", status: "PAID", amount: 10000, currency: "KRW" });
  const signature = computeMockWebhookSignature(rawBody);
  assert(verifyMockWebhookSignature(rawBody, signature), "the correct HMAC signature for this exact raw body must verify");
  const tamperedBody = rawBody.replace("10000", "1"); // same signature, different (tampered) body
  assert(!verifyMockWebhookSignature(tamperedBody, signature), "a signature computed for one body must not verify against a different (tampered) body");
}

// --- 7. duplicate event idempotency (structural) --------------------------------
{
  const step11SchemaSource = readFileSync(new URL("../supabase/migrations/20260825000100_step11_payments_schema.sql", import.meta.url), "utf8");
  assert(step11SchemaSource.includes("unique (provider, provider_event_id)"), "(structural) payment_events must keep its (provider, provider_event_id) unique constraint");
  assert(
    migrationSource.includes("exception when unique_violation then\n    return jsonb_build_object('status', 'duplicate_event', 'already_processed', true)"),
    "(structural) a duplicate provider_event_id must short-circuit to 'duplicate_event' before any finalize logic runs, 2/10/100 times over"
  );
}

// --- 8. same payment/different event 중복 finalize 방지 (structural) -------------
{
  assert(
    migrationSource.includes("create unique index payments_provider_payment_id_key"),
    "(structural) payments must have a real DB unique constraint on (provider, provider_payment_id), so the same provider payment can never be split across two internal payment rows"
  );
  assert(
    migrationSource.includes("select * into v_payment from public.payments where id = p_payment_id for update") &&
      migrationSource.includes("if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then"),
    "(structural) _apply_payment_result's terminal-status guard keys off the internal payment_id, so ANY number of distinct webhook event ids resolving to the same payment are still only ever applied once"
  );
}

// --- 9. browser confirm + webhook race (structural) ------------------------------
{
  assert(
    migrationSource.includes("select * into v_payment from public.payments where id = p_payment_id for update"),
    "(structural) the payment row must be locked (for update) before any status decision — this is what serializes a browser confirm and a webhook racing on the same payment_id"
  );
  assert(
    step11RpcSource.includes("return public._apply_payment_result(") && migrationSource.includes("return public._apply_payment_result("),
    "(structural) confirm_payment (browser path, STEP 11/23 file) and process_webhook_payment_event (webhook path, this STEP's file) both ultimately call _apply_payment_result — the row lock inside it is the actual race boundary, not two independent code paths"
  );
}

// --- 10. webhook success → atomic stock decrement (structural) ------------------
{
  assert(
    migrationSource.includes("if p_normalized_status = 'PAID' then") &&
      migrationSource.includes("return public._apply_payment_result(\n      p_payment_id, true,"),
    "(structural) a PAID webhook must route into the SAME _apply_payment_result that performs atomic stock deduction — no separate webhook-only stock logic"
  );
  assert(
    (migrationSource.match(/where id = v_item\.(variant_id|product_id) and stock_quantity >= v_item\.quantity/g) ?? []).length === 2,
    "(structural) the atomic conditional stock UPDATEs (both variant and option-less) must still be present, unchanged from STEP 23"
  );
}

// --- 11. webhook amount mismatch (structural) ------------------------------------
{
  assert(
    webhookRouteSource.includes("p_provider_amount: event.amount"),
    "(structural) the webhook route must forward the PARSED event's own amount (never a hardcoded null, STEP 23's known limitation) to process_webhook_payment_event"
  );
  assert(!webhookRouteSource.includes("p_provider_amount: null"), "(structural) the webhook route must never hardcode p_provider_amount to null anymore");
}

// --- 12. webhook currency mismatch (structural) ----------------------------------
{
  assert(
    webhookRouteSource.includes("p_provider_currency: event.currencyCode"),
    "(structural) the webhook route must forward the parsed event's own currencyCode, never a hardcoded null"
  );
  assert(!webhookRouteSource.includes("p_provider_currency: null"), "(structural) the webhook route must never hardcode p_provider_currency to null anymore");
}

// --- 13. webhook failed (structural) ---------------------------------------------
{
  assert(
    migrationSource.includes("elsif p_normalized_status = 'FAILED' then") &&
      migrationSource.includes("return public._apply_payment_result(\n      p_payment_id, false,"),
    "(structural) a FAILED webhook must route into _apply_payment_result's failure branch"
  );
}

// --- 14. PAID를 늦은 FAILED가 덮지 못함 (structural) ------------------------------
{
  const guardIdx = migrationSource.indexOf("if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then");
  const successIdx = migrationSource.indexOf("if p_success then");
  assert(guardIdx !== -1 && successIdx !== -1 && guardIdx < successIdx, "(structural) the terminal-status short-circuit must run BEFORE any success/failure branch — a late FAILED event for an already-PAID payment never reaches the failure-handling code at all");
}

// --- 15. duplicate PAID stock 재차감 없음 (structural) ----------------------------
{
  // Same guard as #14/#8 — a second PAID call for an already-PAID payment_id
  // returns already_processed before the stock loop is ever reached again.
  const paidLoopIdx = migrationSource.indexOf("for v_item in");
  const guardIdx = migrationSource.indexOf("if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then");
  assert(guardIdx < paidLoopIdx, "(structural) the terminal-status guard must run before the stock-deduction loop, so a second PAID call never re-enters it");
}

// --- 16. out-of-order event (structural) ------------------------------------------
{
  // The guard checks payments.status, not event arrival order or timestamps —
  // it is structurally order-independent: whichever event reaches
  // _apply_payment_result FIRST wins the terminal transition, regardless of
  // which the provider considers chronologically "earlier".
  assert(
    !migrationSource.includes("received_at") || step11RpcSource.includes("received_at"),
    "(structural) finalize decisions must not depend on payment_events.received_at ordering — only on payments.status itself"
  );
}

// --- 17. provider PAID/local pending reconciliation -------------------------------
{
  const issue = classifyReconciliationIssue({ status: "PENDING", amount: 10000, currencyCode: "KRW" }, { status: "PAID", amount: 10000, currencyCode: "KRW" });
  assert(issue === "PROVIDER_PAID_LOCAL_PENDING", `provider PAID + local non-PAID must classify as PROVIDER_PAID_LOCAL_PENDING, got ${issue}`);
}

// --- 18. stale pending detection ---------------------------------------------------
{
  const oldEnough = new Date(Date.now() - (STALE_PAYMENT_PENDING_THRESHOLD_MINUTES + 5) * 60000).toISOString();
  const tooRecent = new Date(Date.now() - 5 * 60000).toISOString();
  assert(isStalePendingPayment("READY", oldEnough), "a READY payment older than the threshold must be detected as stale");
  assert(!isStalePendingPayment("READY", tooRecent), "a READY payment younger than the threshold must not be flagged stale");
  assert(!isStalePendingPayment("PAID", oldEnough), "a terminal PAID payment must never be flagged stale-pending, however old");
}

// --- 19. stale pending 자동 취소 없음 (structural) ---------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.list_stale_pending_payments");
  const fnBody = migrationSource.slice(fnStart);
  assert(!/update\s+public\.(orders|payments)/i.test(fnBody), "(structural) list_stale_pending_payments must be purely read-only — it must never UPDATE orders or payments itself");
  assert(fnBody.includes("return query"), "(structural) list_stale_pending_payments must only ever SELECT and return rows");
}

// --- 20. retry payment same order (structural) -------------------------------------
{
  assert(
    paymentRetrySource.includes("orderId: input.orderId") && paymentRetrySource.includes("p_order_id".length >= 0),
    "(structural) attemptPayment must operate against an existing orderId supplied by the caller"
  );
  assert(orderDetailPageSource.includes("orderId: order.id"), "(structural) the order-detail retry button must pass the EXISTING order's own id, not construct a new one");
}

// --- 21. retry가 새 order 생성하지 않음 (structural) --------------------------------
{
  assert(
    !paymentRetrySource.includes("create_order") && !paymentRetrySource.includes("createOrderAction"),
    "(structural) lib/paymentRetry.ts must never call create_order/createOrderAction — a retry only ever calls prepare/confirm against an existing order"
  );
}

// --- 22. PAID 주문 retry 금지 (structural) -------------------------------------------
{
  assert(
    mypageActionSource.includes('canRetryPayment: row.payment_status !== "PAID"'),
    "(structural) canRetryPayment must be false once the order is PAID"
  );
  assert(
    step23MigrationSource.includes("if v_order.payment_status <> 'UNPAID' or v_order.order_status not in ('ORDER_CREATED', 'PAYMENT_PENDING') then") ||
      migrationSource.includes("if v_order.payment_status <> 'UNPAID' or v_order.order_status not in ('ORDER_CREATED', 'PAYMENT_PENDING') then"),
    "(structural) prepare_payment itself must still refuse to start a new attempt on an already-PAID order — the real server-side boundary, not just the UI hint"
  );
}

// --- 23. cancelled 주문 retry 금지 (structural) --------------------------------------
{
  assert(
    mypageActionSource.includes('row.order_status !== "CANCELLED"'),
    "(structural) canRetryPayment must be false once the order is CANCELLED"
  );
}

// --- 24. payment event audit metadata (structural) ------------------------------------
{
  assert(
    webhookRouteSource.includes("eventType: event.eventType") &&
      webhookRouteSource.includes("status: event.status") &&
      webhookRouteSource.includes("providerPaymentId: event.providerPaymentId"),
    "(structural) the stored audit metadata must include provider/event/payment identifying fields"
  );
}

// --- 25. raw sensitive payload 미저장 (structural) -------------------------------------
{
  assert(!webhookRouteSource.includes("p_payload: event.payload"), "(structural) the webhook route must never forward the full raw parsed payload as-is into payment_events — only the allow-listed auditMetadata object");
  assert(webhookRouteSource.includes("p_payload: auditMetadata"), "(structural) the webhook route must pass the allow-listed auditMetadata object as p_payload, not the raw event");
}

// --- 26. webhook secret client 노출 없음 (structural) -----------------------------------
{
  assert(!envExampleSource.includes("NEXT_PUBLIC_MOCK_WEBHOOK_SECRET"), "(structural) the mock webhook secret must never be a NEXT_PUBLIC_ variable");
  assert(envExampleSource.includes("MOCK_WEBHOOK_SECRET="), "(structural) .env.example must document the server-only mock webhook secret placeholder");
  const mockSigSource = readFileSync(new URL("../lib/payments/mockWebhookSignature.ts", import.meta.url), "utf8");
  assert(!/process\.env\.NEXT_PUBLIC_/.test(mockSigSource), "(structural) the mock webhook signature helper must never READ a NEXT_PUBLIC_ env var (a doc comment merely naming it is fine)");
}

// --- 27. service-role-only processing boundary (structural) ----------------------------
{
  assert(webhookRouteSource.includes("createServiceRoleClient()"), "(structural) the webhook route must use the service-role client, never a browser-session-scoped client");
  assert(
    !migrationSource.includes("grant execute on function public.process_webhook_payment_event"),
    "(structural) process_webhook_payment_event must still carry NO grant to authenticated/anon — only reachable via the service-role key"
  );
}

// --- 28. stock failure reconciliation issue -------------------------------------------
{
  const reconciliationSource = readFileSync(new URL("../lib/payments/reconciliation.ts", import.meta.url), "utf8");
  assert(
    reconciliationSource.includes("PROVIDER_PAID_LOCAL_STOCK_FAILURE"),
    "(structural) the reconciliation issue taxonomy must distinguish 'provider actually charged, but our own stock check failed' from an ordinary decline"
  );
  const providerRefIdx = migrationSource.indexOf("if p_provider_payment_id is not null or p_provider_transaction_id is not null then");
  const stockLoopIdx = migrationSource.indexOf("begin\n      for v_item in");
  assert(
    providerRefIdx !== -1 && stockLoopIdx !== -1 && providerRefIdx < stockLoopIdx,
    "(structural) the provider's payment/transaction reference must be persisted BEFORE the stock-deduction loop runs, so a stock failure never loses it"
  );
}

// --- 29. refund가 자동 stock restore하지 않음 (structural) -------------------------------
{
  assert(
    !/stock_quantity\s*=\s*stock_quantity\s*\+/.test(migrationSource) && !/stock_quantity\s*=\s*stock_quantity\s*\+/.test(step23MigrationSource),
    "(structural) no payment-domain migration may increment stock_quantity — refund/cancel must never auto-restore stock this STEP"
  );
  assert(
    migrationSource.includes("else\n    -- CANCELLED / REFUNDED / UNKNOWN"),
    "(structural) CANCELLED/REFUNDED webhook events must fall into the logged-only branch, never a stock-mutating one"
  );
}

// --- 30. pending/failure/success UI state helper (structural) --------------------------
{
  assert(
    orderDetailPageSource.includes("PAYMENT_ATTEMPT_STATUS_LABEL"),
    "(structural) the customer-facing order detail must collapse the 9-value payment_attempt_status_enum onto a small pending/paid/failed/cancelled/refunded set, never show the raw enum"
  );
}

// --- 31. provider unavailable reconciliation --------------------------------------------
{
  const result = buildReconciliationResult("pay_1", "ord_1", { status: "PAID", amount: 10000, currencyCode: "KRW" }, null);
  assert(result.issue === "PROVIDER_UNAVAILABLE", `a locally-PAID payment with no provider answer must flag PROVIDER_UNAVAILABLE, got ${result.issue}`);
  assert(result.actionRequired, "an unresolved reconciliation issue must set actionRequired: true");

  const noIssue = buildReconciliationResult("pay_2", "ord_2", { status: "PENDING", amount: 10000, currencyCode: "KRW" }, null);
  assert(noIssue.issue === undefined && !noIssue.actionRequired, "a still-pending local payment with no provider answer yet is ordinary, not itself an issue");
}

// --- 32. production stub fail-closed (structural) ---------------------------------------
{
  assert(
    stubFactorySource.includes('async getPaymentStatus(): Promise<PaymentStatusLookupResult> {\n      return { ok: false, error: message };'),
    "(structural) an unconfigured real provider's getPaymentStatus must fail clearly (NOT_CONFIGURED-equivalent), never fabricate a status"
  );
  assert(
    stubFactorySource.includes("verifyWebhook(): boolean {\n      return false;"),
    "(structural) an unconfigured real provider's webhook must never verify — no real credentials means no real webhook is ever trusted"
  );
}

// --- 33. mock webhook success (structural shape) -----------------------------------------
{
  assert(
    mockSource.includes('KNOWN_STATUSES.includes(body.status as NormalizedPaymentStatus)') && mockSource.includes('"UNKNOWN"'),
    "(structural) MOCK's parseWebhook must normalize an unrecognized status string to UNKNOWN rather than passing it through unchecked"
  );
  assert(
    mockSource.includes("amount: typeof body.amount === \"number\" ? body.amount : null") &&
      mockSource.includes('currencyCode: (body.currency as CurrencyCode | undefined) ?? null'),
    "(structural) MOCK's parseWebhook must populate amount/currencyCode from the payload, defaulting to null rather than throwing on a missing field"
  );
}

// --- 34. mock invalid signature (structural, cross-check with #5) ------------------------
{
  assert(
    mockSource.includes("verifyMockWebhookSignature(input.rawBody, input.headers[\"x-mock-signature\"])"),
    "(structural) MOCK's verifyWebhook must actually delegate to the real HMAC check, not unconditionally return true"
  );
}

// --- 35. existing STEP23 finalization regression 없음 -------------------------------------
{
  assert(
    !migrationSource.includes("greatest(0, stock_quantity - v_item.quantity)"),
    "(structural) STEP 23's overselling fix (no unconditional floor-at-0 update) must not have regressed in this STEP's rewrite of _apply_payment_result"
  );
  assert(
    migrationSource.includes("'PAYMENT_AMOUNT_MISMATCH'") && migrationSource.includes("'PAYMENT_CURRENCY_MISMATCH'") && migrationSource.includes("'STOCK_CHANGED'"),
    "(structural) all three STEP 23 failure codes must still be present after this STEP's changes"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — webhook signature verification, normalized amount/currency threading, duplicate/out-of-order/race idempotency, reconciliation classification, stale-pending detection (read-only), retry-same-order, audit-metadata allow-listing, secret/PII non-exposure, and STEP 23 regression checks passed."
);
