/**
 * STEP 26 spec section 40 — framework-free test script (same convention as
 * every prior scripts/test-*.mts in this project). lib/refunds/*.ts and
 * lib/payments/reconciliation.ts are plain, Node-testable modules (no
 * "server-only" import), so their real logic is exercised directly; the
 * repository (lib/repositories/admin/refunds.ts, lib/repositories/admin/
 * orders.ts), the Server Action (lib/actions/refunds.ts), the provider
 * adapters (lib/payments/providers/*.ts), and the migration SQL are all
 * "server-only" or SQL-only, so they're verified structurally
 * (readFileSync + regex/substring), exactly like every prior STEP's
 * security/RLS/finalization checks in this session.
 *
 * Run with: node --experimental-strip-types scripts/test-refunds.mts
 */
import { readFileSync } from "node:fs";
import {
  computeRefundLineAmount,
  computeTotalRefundAmount,
  isFullyRefunded,
  isOverRefundAmount,
  isOverRefundQuantity,
  refundResultMatchesExpected,
  remainingRefundableQuantity,
} from "../lib/refunds/calculation.ts";
import { isValidShippingRefundAmount } from "../lib/refunds/shippingPolicy.ts";
import { canAutoRestoreStock, isPreShipmentStatus } from "../lib/refunds/stockRestore.ts";
import { isStalePendingRefund, STALE_REFUND_PENDING_THRESHOLD_MINUTES } from "../lib/payments/reconciliation.ts";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const migrationSource = readFileSync(new URL("../supabase/migrations/20260906000700_step26_refunds.sql", import.meta.url), "utf8");
const step23MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000400_step23_payment_finalization.sql", import.meta.url), "utf8");
const step25MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000600_step25_admin_order_fulfillment.sql", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../lib/payments/providers/mock.ts", import.meta.url), "utf8");
const stubFactorySource = readFileSync(new URL("../lib/payments/providers/stubFactory.ts", import.meta.url), "utf8");
const paymentsTypesSource = readFileSync(new URL("../lib/payments/types.ts", import.meta.url), "utf8");
const refundsActionSource = readFileSync(new URL("../lib/actions/refunds.ts", import.meta.url), "utf8");
const adminRefundsRepoSource = readFileSync(new URL("../lib/repositories/admin/refunds.ts", import.meta.url), "utf8");
const adminOrdersRepoSource = readFileSync(new URL("../lib/repositories/admin/orders.ts", import.meta.url), "utf8");
const mypageActionSource = readFileSync(new URL("../lib/actions/mypage.ts", import.meta.url), "utf8");
const mypageOrderDetailPageSource = readFileSync(new URL("../app/mypage/orders/[orderId]/page.tsx", import.meta.url), "utf8");
const refundPanelSource = readFileSync(new URL("../components/admin/orders/RefundPanel.tsx", import.meta.url), "utf8");
const shippingPolicySource = readFileSync(new URL("../lib/refunds/shippingPolicy.ts", import.meta.url), "utf8");

// --- 1. unpaid cancel (structural) -------------------------------------------------
{
  assert(
    migrationSource.includes("create or replace function public.cancel_own_unpaid_order(p_order_id uuid, p_guest_contact text default null)") &&
      migrationSource.includes("perform public._cancel_unpaid_order_core(p_order_id, '고객 요청으로 취소됨');"),
    "(structural) cancel_own_unpaid_order must exist and delegate to the shared cancel core"
  );
  assert(
    mypageActionSource.includes('supabase.rpc("cancel_own_unpaid_order"'),
    "(structural) the customer-facing mypage action must call cancel_own_unpaid_order"
  );
}

// --- 2. unpaid cancel에서 refund 호출 안 함 (structural) -----------------------------
{
  const coreFnStart = migrationSource.indexOf("create or replace function public._cancel_unpaid_order_core");
  const coreFnBody = migrationSource.slice(coreFnStart, migrationSource.indexOf("$$;", coreFnStart));
  assert(
    !coreFnBody.includes("admin_create_refund") && !coreFnBody.includes("refund"),
    "(structural) _cancel_unpaid_order_core must never touch anything refund-related — an unpaid order was never charged"
  );
  assert(!mypageActionSource.includes("processRefundAction"), "(structural) the customer cancel path must never call the refund action");
}

// --- 3. paid order는 direct cancel 금지 (structural) --------------------------------
{
  const coreFnStart = migrationSource.indexOf("create or replace function public._cancel_unpaid_order_core");
  const coreFnBody = migrationSource.slice(coreFnStart, migrationSource.indexOf("$$;", coreFnStart));
  assert(
    coreFnBody.includes("if v_order.payment_status = 'PAID' then") && coreFnBody.includes("raise exception 'a paid order cannot be cancelled through this path';"),
    "(structural) a PAID order must be rejected by the shared cancel core, whether reached via the admin or the customer path"
  );
}

// --- 4. full refund amount (real) ----------------------------------------------------
{
  const amount = computeTotalRefundAmount([{ unitPrice: 10000, quantity: 2 }], 3000);
  assert(amount === 23000, `full refund of 2×10000 + 3000 shipping must equal 23000, got ${amount}`);
  assert(isFullyRefunded(23000, 23000), "a completed-refund total equal to the payment amount must be considered fully refunded");
}

// --- 5. partial refund amount (real) --------------------------------------------------
{
  const amount = computeRefundLineAmount(10000, 1);
  assert(amount === 10000, `a single-unit refund line must equal unitPrice × 1, got ${amount}`);
  assert(!isFullyRefunded(10000, 23000), "a partial completed-refund total must not be considered fully refunded");
}

// --- 6. order snapshot price 사용 (structural) -----------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_create_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_create_refund"));
  assert(fnBody.includes("v_order_item.unit_price"), "(structural) admin_create_refund must compute refund amounts from order_items.unit_price (the order's own snapshot)");
}

// --- 7. current product price 불신 (structural) ----------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_create_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_create_refund"));
  assert(!/from\s+public\.products/.test(fnBody), "(structural) admin_create_refund must never join/select from products to determine a refund amount — only order_items");
}

// --- 8. quantity over-refund 금지 (real + structural) -----------------------------------
{
  assert(isOverRefundQuantity(4, 5, 2), "requesting 4 when only 3 remain (5 ordered - 2 already refunded) must be flagged as over-refund");
  assert(!isOverRefundQuantity(3, 5, 2), "requesting exactly the remaining 3 must not be flagged as over-refund");
  assert(remainingRefundableQuantity(5, 2) === 3, "5 ordered minus 2 already refunded must leave 3 remaining");
  assert(
    migrationSource.includes("raise exception 'OVER_REFUND_QUANTITY:"),
    "(structural) admin_create_refund must raise OVER_REFUND_QUANTITY when a requested quantity exceeds the remaining refundable quantity"
  );
}

// --- 9. amount over-refund 금지 (real + structural) -------------------------------------
{
  assert(isOverRefundAmount(20000, 5000, 24000), "already-refunded 20000 + requested 5000 exceeding the 24000 payment (with tolerance) must be flagged");
  assert(!isOverRefundAmount(20000, 3000, 24000), "already-refunded 20000 + requested 3000 staying within the 24000 payment must not be flagged");
  assert(migrationSource.includes("raise exception 'OVER_REFUND_AMOUNT:"), "(structural) admin_create_refund must raise OVER_REFUND_AMOUNT as a cross-check independent of the per-item quantity guard");
}

// --- 10. multiple partial refund 누적 (real) ----------------------------------------------
{
  let remaining = remainingRefundableQuantity(10, 0);
  remaining = remainingRefundableQuantity(10, 10 - remaining + 3); // first partial refund of 3
  assert(remaining === 7, `after refunding 3 of 10, remaining must be 7, got ${remaining}`);
  const afterSecond = remainingRefundableQuantity(10, 3 + 4); // second partial refund of 4
  assert(afterSecond === 3, `after refunding 3 then 4 of 10, remaining must be 3, got ${afterSecond}`);
}

// --- 11. final partial → full refunded state (real) ---------------------------------------
{
  assert(!isFullyRefunded(15000, 20000), "15000 of 20000 refunded must not yet be fully refunded");
  assert(isFullyRefunded(20000, 20000), "20000 of 20000 refunded (the final partial completing it) must be fully refunded");
}

// --- 12. refund idempotency (structural) --------------------------------------------------
{
  assert(
    migrationSource.includes("alter table public.payment_refunds add constraint payment_refunds_idempotency_key_key unique (idempotency_key);"),
    "(structural) payment_refunds.idempotency_key must carry a real DB unique constraint"
  );
  assert(
    migrationSource.includes("exception when unique_violation then") && migrationSource.includes("select * into v_existing from public.payment_refunds where idempotency_key = p_idempotency_key;"),
    "(structural) admin_create_refund must catch a unique_violation on the idempotency key and return the EXISTING refund rather than erroring"
  );
}

// --- 13. duplicate provider refund 방지 (structural) ---------------------------------------
{
  assert(
    mockSource.includes("providerRefundId: `mock_refund_${input.refundId}`"),
    "(structural) MOCK's refundPayment must derive providerRefundId deterministically from OUR OWN refund id, never Date.now() or a random value — a retry must resolve to the same provider-side refund"
  );
}

// --- 14. provider amount mismatch (real + structural) ---------------------------------------
{
  assert(!refundResultMatchesExpected(10000, "KRW", 9000, "KRW"), "a provider-reported amount that differs from the expected amount must not match");
  assert(refundResultMatchesExpected(10000, "KRW", 10000, "KRW"), "a provider-reported amount equal to the expected amount must match");
  assert(
    migrationSource.includes("failure_code = 'REFUND_AMOUNT_MISMATCH'") && migrationSource.includes("abs(p_provider_amount - v_refund.amount) > v_amount_tolerance"),
    "(structural) admin_finalize_refund must reject (never complete) a provider amount that doesn't match the reserved refund amount"
  );
}

// --- 15. currency mismatch (real + structural) ------------------------------------------------
{
  assert(!refundResultMatchesExpected(10000, "KRW", 10000, "USD"), "a provider-reported currency that differs from the expected currency must not match");
  assert(
    migrationSource.includes("failure_code = 'REFUND_CURRENCY_MISMATCH'") && migrationSource.includes("p_provider_currency <> v_refund.currency"),
    "(structural) admin_finalize_refund must reject a provider currency that doesn't match the reserved refund currency"
  );
}

// --- 16. mock refund success (structural) -------------------------------------------------------
{
  assert(
    mockSource.includes("status: \"COMPLETED\",") && mockSource.includes("async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {"),
    "(structural) MOCK's refundPayment must echo back a normalized success result (amount/currencyCode/status), not a bare boolean"
  );
}

// --- 17. mock refund failure path (structural — the SYSTEM must handle a provider failure) ------
{
  assert(
    migrationSource.includes("if not p_success then") &&
      migrationSource.includes("status = 'FAILED', failure_code = p_failure_code, failure_message = p_failure_message"),
    "(structural) admin_finalize_refund must correctly record a provider-reported refund failure, even though MOCK itself always succeeds today"
  );
  assert(
    paymentsTypesSource.includes('| { ok: false; error: string; failureCode?: string };'),
    "(structural) RefundPaymentResult's failure branch must be able to carry a failureCode for a real adapter's future failure path"
  );
}

// --- 18. production stub fail-closed (structural) -------------------------------------------------
{
  assert(
    stubFactorySource.includes("async refundPayment(): Promise<RefundPaymentResult> {\n      return { ok: false, error: message };"),
    "(structural) an unconfigured real provider's refundPayment must fail clearly (NOT_CONFIGURED-equivalent), never fabricate a successful refund"
  );
}

// --- 19. variant stock restore (structural) ---------------------------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_finalize_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_finalize_refund"));
  assert(
    fnBody.includes("if v_item.variant_id is not null then") && fnBody.includes("update public.product_variants set stock_quantity = stock_quantity + v_item.quantity"),
    "(structural) admin_finalize_refund must restore product_variants.stock_quantity for a variant order item"
  );
}

// --- 20. simple product stock restore (structural) --------------------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_finalize_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_finalize_refund"));
  assert(
    fnBody.includes("elsif v_item.stock_type = 'TRACKED' then") && fnBody.includes("update public.products set stock_quantity = stock_quantity + v_item.quantity"),
    "(structural) admin_finalize_refund must restore products.stock_quantity for a non-variant TRACKED order item"
  );
}

// --- 21. unlimited no restore (structural) ------------------------------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_finalize_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_finalize_refund"));
  assert(
    !/stock_type = 'UNLIMITED'[\s\S]{0,80}stock_quantity/.test(fnBody),
    "(structural) admin_finalize_refund must never write stock_quantity for an UNLIMITED stock_type item"
  );
  assert(
    fnBody.includes("UNLIMITED stock_type: no stock_quantity to restore"),
    "(structural) the UNLIMITED no-op case must be explicitly acknowledged, not silently missing"
  );
}

// --- 22. pre-shipment restore 허용 (real) ---------------------------------------------------------------
{
  assert(isPreShipmentStatus("PREPARING"), "PREPARING must be eligible for automatic stock restore");
  assert(isPreShipmentStatus("PURCHASING"), "PURCHASING must be eligible for automatic stock restore");
  assert(isPreShipmentStatus("READY_TO_SHIP"), "READY_TO_SHIP must be eligible for automatic stock restore");
  assert(canAutoRestoreStock(["PREPARING", "READY_TO_SHIP"]), "a set of only pre-shipment statuses must be eligible for restore");
}

// --- 23. SHIPPED 자동 restore 금지 (real) -----------------------------------------------------------------
{
  assert(!isPreShipmentStatus("SHIPPED"), "SHIPPED must never be eligible for automatic stock restore");
  assert(!canAutoRestoreStock(["PREPARING", "SHIPPED"]), "any post-shipment group among an item's groups must disqualify it from automatic restore");
}

// --- 24. IN_TRANSIT 자동 restore 금지 (real) --------------------------------------------------------------
{
  assert(!isPreShipmentStatus("IN_TRANSIT"), "IN_TRANSIT must never be eligible for automatic stock restore");
}

// --- 25. DELIVERED 자동 restore 금지 (real) ----------------------------------------------------------------
{
  assert(!isPreShipmentStatus("DELIVERED"), "DELIVERED must never be eligible for automatic stock restore");
}

// --- 26. stock restore idempotency (structural) --------------------------------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_finalize_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_finalize_refund"));
  assert(
    fnBody.includes("where pri.refund_id = p_refund_id and pri.stock_restored_at is null") &&
      fnBody.includes("update public.payment_refund_items set stock_restored_at = now() where id = v_item.refund_item_id;"),
    "(structural) the stock-restore loop must only ever touch refund items with a null stock_restored_at, and must mark them restored exactly once"
  );
}

// --- 27. partial restore quantity 정확성 (structural) ------------------------------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_finalize_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_finalize_refund"));
  assert(
    fnBody.includes("stock_quantity + v_item.quantity") && fnBody.includes("pri.quantity"),
    "(structural) stock restore must add back the REFUND ITEM's own quantity (a partial refund line), never the order item's full ordered quantity"
  );
}

// --- 28. multiple items transaction (structural) -----------------------------------------------------------------
{
  const fnStart = migrationSource.indexOf("create or replace function public.admin_finalize_refund");
  const fnBody = migrationSource.slice(fnStart, migrationSource.indexOf("grant execute on function public.admin_finalize_refund"));
  assert(
    fnBody.includes("language plpgsql") && fnBody.includes("security definer"),
    "(structural) admin_finalize_refund must be a single SECURITY DEFINER PL/pgSQL function — every effect (refund status, payment status, order status, stock restore, audit) commits or rolls back together, not a series of independent client calls"
  );
}

// --- 29. local failure reconciliation (structural) --------------------------------------------------------------------
{
  assert(
    adminOrdersRepoSource.includes('refund.status === "FAILED" && (refund.failure_code === "REFUND_AMOUNT_MISMATCH" || refund.failure_code === "REFUND_CURRENCY_MISMATCH")') &&
      adminOrdersRepoSource.includes('warnings.push({ issue: "REFUND_AMOUNT_MISMATCH", paymentId: refund.payment_id });'),
    "(structural) a FAILED refund with an amount/currency mismatch failure_code must surface as an admin reconciliation warning"
  );
}

// --- 30. provider refunded/local pending issue (real + structural) -----------------------------------------------------
{
  const oldEnough = new Date(Date.now() - (STALE_REFUND_PENDING_THRESHOLD_MINUTES + 5) * 60000).toISOString();
  const tooRecent = new Date(Date.now() - 5 * 60000).toISOString();
  assert(isStalePendingRefund("PENDING", oldEnough), "a PENDING refund older than the threshold must be detected as stale");
  assert(!isStalePendingRefund("PENDING", tooRecent), "a PENDING refund younger than the threshold must not be flagged stale");
  assert(!isStalePendingRefund("COMPLETED", oldEnough), "a terminal COMPLETED refund must never be flagged stale-pending, however old");
  assert(
    adminOrdersRepoSource.includes('warnings.push({ issue: "PROVIDER_REFUNDED_LOCAL_PENDING", paymentId: refund.payment_id });'),
    "(structural) a stale PENDING refund must surface as PROVIDER_REFUNDED_LOCAL_PENDING to the admin"
  );
  assert(
    migrationSource.includes("create or replace function public.list_stale_pending_refunds") &&
      !/update\s+public\.(payment_refunds|payments|orders)/i.test(migrationSource.slice(migrationSource.indexOf("create or replace function public.list_stale_pending_refunds"))),
    "(structural) list_stale_pending_refunds must be purely read-only — it must never auto-resolve a stale refund itself"
  );
}

// --- 31. admin-only action (structural) -----------------------------------------------------------------------------------
{
  assert(refundsActionSource.includes("checkAdminAccess()") && refundsActionSource.includes('access.status !== "ok"'), "(structural) processRefundAction must verify admin access before doing anything");
  assert(
    adminRefundsRepoSource.includes('.rpc("admin_create_refund"') && adminRefundsRepoSource.includes('.rpc("admin_finalize_refund"'),
    "(structural) the reserve/finalize repository functions must call the admin_create_refund/admin_finalize_refund RPCs, never write payment_refunds directly"
  );
  assert(
    migrationSource.match(/if not public\.is_admin\(\) then/g)!.length >= 4,
    "(structural) admin_create_refund, admin_finalize_refund, cancel_unpaid_order, and list_stale_pending_refunds must each independently check is_admin()"
  );
}

// --- 32. customer cannot refund directly through admin endpoint (structural) --------------------------------------------------
{
  assert(!mypageActionSource.includes("admin_create_refund") && !mypageActionSource.includes("admin_finalize_refund"), "(structural) no customer-facing action may call the admin refund RPCs directly");
  assert(!migrationSource.includes("grant execute on function public.admin_create_refund to authenticated, anon"), "(structural) admin_create_refund must not be granted to anon — is_admin() plus the grant boundary together gate it");
}

// --- 33. refund reason validation (structural) ---------------------------------------------------------------------------------
{
  assert(
    migrationSource.includes("create type public.refund_reason_code_enum as enum (\n  'CUSTOMER_REQUEST', 'OUT_OF_STOCK', 'DELIVERY_ISSUE', 'PRODUCT_ISSUE', 'OTHER'\n);"),
    "(structural) refund_reason_code_enum must constrain reason codes to a fixed known set"
  );
  const refundsTypesSource = readFileSync(new URL("../lib/refunds/types.ts", import.meta.url), "utf8");
  assert(
    refundsTypesSource.includes('"CUSTOMER_REQUEST" | "OUT_OF_STOCK" | "DELIVERY_ISSUE" | "PRODUCT_ISSUE" | "OTHER"'),
    "(structural) the TS RefundReasonCode union must mirror the DB enum exactly"
  );
}

// --- 34. provider raw card data 미저장 (structural) ----------------------------------------------------------------------------------
{
  assert(
    !/card_number|cvv|card_cvc/i.test(migrationSource) && !/card_number|cvv|card_cvc/i.test(paymentsTypesSource) && !/card_number|cvv|card_cvc/i.test(refundPanelSource),
    "(structural) no card number/CVV field may exist anywhere in the refund domain — only provider_refund_id is ever stored"
  );
}

// --- 35. payment status PARTIALLY_REFUNDED (structural) --------------------------------------------------------------------------------
{
  assert(
    migrationSource.includes("v_new_payment_status := case when v_total_completed >= v_payment.amount - v_amount_tolerance then 'REFUNDED' else 'PARTIALLY_REFUNDED' end;"),
    "(structural) admin_finalize_refund must set payments.status to PARTIALLY_REFUNDED when the completed refund total doesn't yet cover the whole payment"
  );
  assert(
    !migrationSource.includes("update public.orders set order_status = 'CANCELLED' where id = v_refund.order_id"),
    "(structural) a partial refund must never force order_status to CANCELLED"
  );
}

// --- 36. payment status REFUNDED (structural + real) ------------------------------------------------------------------------------------
{
  assert(migrationSource.includes("update public.orders set order_status = 'REFUNDED' where id = v_refund.order_id;"), "(structural) a fully-refunded payment must roll the order up to order_status = REFUNDED");
  assert(isFullyRefunded(50000, 50000), "a completed-refund total exactly matching the payment amount must count as fully refunded");
}

// --- 37. customer refund display (structural) ---------------------------------------------------------------------------------------------
{
  assert(
    mypageOrderDetailPageSource.includes("messages.payment.refundStatus.pending") &&
      mypageOrderDetailPageSource.includes("messages.payment.refundStatus.partial") &&
      mypageOrderDetailPageSource.includes("messages.payment.refundStatus.completed"),
    "(structural) the customer order detail must show 환불 처리중/부분환불/환불완료 via the i18n message map, never a raw refund_status_enum value"
  );
  assert(
    !mypageOrderDetailPageSource.includes("providerRefundId") && !mypageOrderDetailPageSource.includes("reconciliationWarnings"),
    "(structural) the customer order detail must never expose an internal provider refund id or a reconciliation issue code"
  );
}

// --- 38. shipping fee null/zero 구분 (real) --------------------------------------------------------------------------------------------------
{
  assert(isValidShippingRefundAmount({ requestedShippingRefundAmount: 0, alreadyRefundedShippingAmount: 0, orderShippingAmount: 3000 }), "a zero shipping-refund request must always be valid");
  assert(!isValidShippingRefundAmount({ requestedShippingRefundAmount: -1, alreadyRefundedShippingAmount: 0, orderShippingAmount: 3000 }), "a negative shipping-refund amount must never be valid");
  assert(
    isValidShippingRefundAmount({ requestedShippingRefundAmount: 3000, alreadyRefundedShippingAmount: 0, orderShippingAmount: 3000 }),
    "a shipping-refund request equal to the full remaining shipping amount must be valid"
  );
  assert(
    !isValidShippingRefundAmount({ requestedShippingRefundAmount: 1, alreadyRefundedShippingAmount: 3000, orderShippingAmount: 3000 }),
    "a shipping-refund request on top of an already-fully-refunded shipping amount must be rejected"
  );
}

// --- 39. refund shipping fee policy not hardcoded (structural) -----------------------------------------------------------------------------------
{
  assert(
    !/[*/]\s*0\.\d/.test(shippingPolicySource) && !shippingPolicySource.includes("export function computeShippingRefund"),
    "(structural) lib/refunds/shippingPolicy.ts must contain no proportional/percentage auto-calculation function — only a cap validator (isValidShippingRefundAmount)"
  );
  assert(
    !migrationSource.match(/refund_shipping_amount\s*:=\s*[\s\S]{0,40}\*/),
    "(structural) admin_create_refund must never itself COMPUTE a shipping refund amount from a ratio — it only validates the admin-provided p_refund_shipping_amount against a cap"
  );
}

// --- 40. existing payment finalization regression 없음 (structural) --------------------------------------------------------------------------------------
{
  assert(!step23MigrationSource.includes("greatest(0, stock_quantity - v_item.quantity)"), "(structural) STEP 23's overselling fix must remain intact after STEP 26's changes");
  assert(step23MigrationSource.includes("create or replace function public._apply_payment_result"), "(structural) _apply_payment_result must still be the one place a payment's own success/failure lands — STEP 26 never touches it");
}

// --- 41. existing shipping flow regression 없음 (structural) ----------------------------------------------------------------------------------------------
{
  assert(
    step25MigrationSource.includes("create or replace function public.admin_update_shipping_group") && !/stock_quantity/.test(step25MigrationSource),
    "(structural) STEP 25's admin_update_shipping_group must remain untouched by STEP 26 and still never reference stock_quantity"
  );
}

// --- 42. existing order snapshot regression 없음 (structural) -------------------------------------------------------------------------------------------
{
  assert(
    adminOrdersRepoSource.includes("item.product_name_snapshot") && adminOrdersRepoSource.includes("item.sku_snapshot") && adminOrdersRepoSource.includes("item.option_snapshot"),
    "(structural) the admin order detail must still render product_name_snapshot/sku_snapshot/option_snapshot — STEP 26 only ADDS refundedQuantity, never replaces the snapshot fields"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — unpaid-order self/admin cancel (no refund, no stock touch), full/partial refund amount computation from order snapshots, over-refund quantity/amount guards, idempotency, provider amount/currency verification, stock-restore eligibility (pre-shipment only) and idempotency, payment/order status rollup (PARTIALLY_REFUNDED/REFUNDED), reconciliation issue surfacing, admin-only RPC gating, reason-code validation, no card-data storage, no hardcoded shipping-refund policy, customer-facing refund display, and STEP 23/25 non-regression checks passed."
);
