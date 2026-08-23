/**
 * STEP 23 spec section 39 — framework-free test script (same convention as
 * scripts/test-order-creation.mts). The entire payment domain
 * (lib/payments/*, app/api/payments/*, the RPCs) is either "server-only"
 * marked (importing it in plain Node throws by design — see
 * node_modules/server-only/index.js) or a Route Handler/RPC that needs a
 * live Supabase DB, so essentially every check here is structural
 * (readFileSync + regex/substring assertions), exactly like every prior
 * STEP's security/RLS checks in this session. A few checks reuse real pure
 * functions from the Node-testable subtree (lib/cart.ts, lib/checkout/
 * normalize.ts) where the thing being verified genuinely lives there.
 *
 * Run with: node --experimental-strip-types scripts/test-payment-finalization.mts
 */
import { readFileSync } from "node:fs";
import { resolveSellPrice } from "../lib/checkout/normalize.ts";
import { calculateCartSummary, enrichCartItems } from "../lib/cart.ts";
import type { Product } from "../types";
import type { CartItem } from "../types/cart";
import type { Market } from "../types/market";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const KR_MARKET: Market = { countryCode: "KR", countryName: "대한민국", locale: "ko", currency: "KRW" };

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "test-product",
    dbId: "11111111-1111-1111-1111-111111111111",
    sku: "PRODUCT-1",
    name: "테스트 상품",
    image: "https://example.com/image.jpg",
    originalPrice: 20000,
    salePrice: 19900,
    discountRate: 5,
    rating: 4.5,
    reviewCount: 10,
    shippingType: "domestic",
    shippingLabel: "국내출고",
    freeShipping: false,
    category: "kitchen",
    stock: 10,
    ...overrides,
  };
}

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return { cartItemId: "ci-1", productId: "test-product", variantId: null, quantity: 1, unitPriceSnapshot: 19900, checked: true, ...overrides };
}

const registrySource = readFileSync(new URL("../lib/payments/registry.ts", import.meta.url), "utf8");
const mockSource = readFileSync(new URL("../lib/payments/providers/mock.ts", import.meta.url), "utf8");
const typesSource = readFileSync(new URL("../lib/payments/types.ts", import.meta.url), "utf8");
const prepareRouteSource = readFileSync(new URL("../app/api/payments/prepare/route.ts", import.meta.url), "utf8");
const confirmRouteSource = readFileSync(new URL("../app/api/payments/confirm/route.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/20260906000400_step23_payment_finalization.sql", import.meta.url), "utf8");
const step22MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000300_step22_order_snapshot.sql", import.meta.url), "utf8");
const step11SchemaSource = readFileSync(new URL("../supabase/migrations/20260825000100_step11_payments_schema.sql", import.meta.url), "utf8");
const mypageActionSource = readFileSync(new URL("../lib/actions/mypage.ts", import.meta.url), "utf8");
const checkoutClientSource = readFileSync(new URL("../components/checkout/CheckoutClient.tsx", import.meta.url), "utf8");

// --- 1. provider registry (structural) --------------------------------------
{
  assert(
    registrySource.includes("export function resolveProviderForMarket") && registrySource.includes("export function getPaymentAdapter"),
    "(structural) a single registry module must own both market->provider resolution and provider->adapter lookup — no market/provider if-chain duplicated elsewhere"
  );
}

// --- 2. KR routing (structural) ----------------------------------------------
{
  assert(
    registrySource.includes('if (market === "KR" && isKoreaPgConfigured()) return "KOREA_PG"'),
    "(structural) the KR market must route to KOREA_PG once (and only once) its credentials are configured"
  );
}

// --- 3. IN routing (structural) ----------------------------------------------
{
  assert(
    registrySource.includes('if (market === "IN" && isIndiaPgConfigured()) return "INDIA_PG"'),
    "(structural) the IN market must route to INDIA_PG once its credentials are configured"
  );
}

// --- 4. GLOBAL routing (structural) -------------------------------------------
{
  assert(
    registrySource.includes("if (isGlobalPgConfigured()) return \"GLOBAL_PG\""),
    "(structural) any market falls through to GLOBAL_PG once it's configured, independent of KR/IN-specific providers"
  );
}

// --- 5. dev mock fallback (structural) ----------------------------------------
{
  assert(
    registrySource.includes('if (process.env.NODE_ENV === "production") return null') && registrySource.includes('return "MOCK"'),
    "(structural) development/preview must fall back to MOCK when no real provider is configured for the market"
  );
}

// --- 6. production misconfiguration fail (structural) -------------------------
{
  // Same block as #5 proves production returns null (never MOCK) — the route must then refuse, not silently proceed.
  assert(
    prepareRouteSource.includes("if (!provider)") && prepareRouteSource.includes("status: 503"),
    "(structural) the prepare route must return a clear 503/configuration error when resolveProviderForMarket returns null in production, never silently fall back to a fake success"
  );
}

// --- 7. order amount source of truth (structural) ------------------------------
{
  assert(
    migrationSource.includes("v_order.total_amount, 'READY'") || migrationSource.includes("amount = v_order.total_amount"),
    "(structural) prepare_payment must source the payment amount from orders.total_amount, never a client-declared amount"
  );
  assert(
    migrationSource.includes("'amount', v_order.total_amount") && migrationSource.includes("'currency_code', v_order.currency_code"),
    "(structural) prepare_payment's own response must echo the order's own amount/currency, which the client then merely carries forward for MOCK to echo — never invents its own"
  );
}

// --- 8. client amount 불신 (structural) -----------------------------------------
{
  assert(
    confirmRouteSource.includes("p_provider_amount: result.ok ? result.amount : null"),
    "(structural) the confirm route must forward the ADAPTER's own confirmed amount (never the raw request body's amount) as the value _apply_payment_result checks"
  );
  assert(
    !/p_provider_amount:\s*body\.amount/.test(confirmRouteSource),
    "(structural) the confirm route must never pass the client-submitted body.amount straight through as the provider-confirmed amount"
  );
}

// --- 9. provider amount mismatch 거부 (structural) ------------------------------
{
  assert(
    migrationSource.includes("if p_provider_amount is null or abs(p_provider_amount - v_payment.amount) > v_amount_tolerance then") &&
      migrationSource.includes("'PAYMENT_AMOUNT_MISMATCH'"),
    "(structural) _apply_payment_result must reject (never mark PAID) when the provider-confirmed amount doesn't match payments.amount"
  );
  assert(
    migrationSource.includes("if p_provider_amount is null"),
    "(structural) a missing provider amount must fail CLOSED (treated as a mismatch), never silently skip the check"
  );
}

// --- 10. provider currency mismatch 거부 (structural) ---------------------------
{
  assert(
    migrationSource.includes("if p_provider_currency is null or p_provider_currency <> v_payment.currency_code then") &&
      migrationSource.includes("'PAYMENT_CURRENCY_MISMATCH'"),
    "(structural) _apply_payment_result must reject (never mark PAID) when the provider-confirmed currency doesn't match payments.currency_code"
  );
}

// --- 11. 이미 PAID 주문 재결제 거부 (structural) ----------------------------------
{
  assert(
    migrationSource.includes("if v_order.payment_status <> 'UNPAID' or v_order.order_status not in ('ORDER_CREATED', 'PAYMENT_PENDING') then") &&
      migrationSource.includes("raise exception 'order is not payable in its current state'"),
    "(structural) prepare_payment must refuse to start a new payment attempt against an order that's already PAID"
  );
}

// --- 12. 동일 payment id 중복 finalize 방지 (structural) -------------------------
{
  assert(
    migrationSource.includes("select * into v_payment from public.payments where id = p_payment_id for update") &&
      migrationSource.includes("if v_payment.status in ('PAID', 'FAILED', 'CANCELLED') then") &&
      migrationSource.includes("return jsonb_build_object('status', v_payment.status, 'already_processed', true)"),
    "(structural) _apply_payment_result must lock the payment row and short-circuit on a terminal status, so calling confirm twice for the same payment_id is a no-op the second time"
  );
}

// --- 13. 옵션 없는 상품 재고 차감 (structural) -----------------------------------
{
  assert(
    migrationSource.includes("elsif v_item.stock_type = 'TRACKED' then") &&
      migrationSource.includes("update public.products\n          set stock_quantity = stock_quantity - v_item.quantity\n          where id = v_item.product_id and stock_quantity >= v_item.quantity"),
    "(structural) an option-less TRACKED product must have products.stock_quantity atomically decremented at payment finalize time"
  );
}

// --- 14. variant 재고 차감 (structural) -------------------------------------------
{
  assert(
    migrationSource.includes("if v_item.variant_id is not null then") &&
      migrationSource.includes("update public.product_variants\n          set stock_quantity = stock_quantity - v_item.quantity\n          where id = v_item.variant_id and stock_quantity >= v_item.quantity"),
    "(structural) a variant order item must have product_variants.stock_quantity atomically decremented at payment finalize time"
  );
}

// --- 15. unlimited stock 미차감 (structural) --------------------------------------
{
  // The loop only ever updates product_variants (variant present) or products WHEN stock_type = 'TRACKED' —
  // an option-less UNLIMITED product (no variant, stock_type <> 'TRACKED') matches neither branch and is never touched.
  assert(
    migrationSource.includes("elsif v_item.stock_type = 'TRACKED' then"),
    "(structural) stock deduction must be gated on stock_type = 'TRACKED' — an UNLIMITED product's stock_quantity must never be decremented"
  );
}

// --- 16. stock 부족 finalize 실패 (structural) -------------------------------------
{
  assert(
    migrationSource.includes("if not found then") && migrationSource.includes("raise exception 'STOCK_CHANGED: insufficient stock for variant %'"),
    "(structural) an insufficient-stock UPDATE (0 rows affected) must raise, not silently floor the deduction at 0"
  );
  assert(
    !migrationSource.includes("greatest(0, stock_quantity - v_item.quantity)"),
    "(structural) the STEP 11 overselling bug (unconditional greatest(0, ...) update with no stock check) must be fully removed, not left alongside the new atomic version"
  );
}

// --- 17. 여러 item 중 하나 부족 시 전체 rollback 구조 (structural) -----------------
{
  const beginIdx = migrationSource.indexOf("begin\n      for v_item in");
  const exceptionIdx = migrationSource.indexOf("exception when others then", beginIdx);
  assert(
    beginIdx !== -1 && exceptionIdx !== -1 && exceptionIdx > beginIdx,
    "(structural) the stock-deduction loop must run inside its own begin/exception sub-block (a Postgres savepoint), so item 2's shortfall rolls back item 1's already-applied deduction from the SAME order"
  );
}

// --- 18. atomic stock update SQL 구조 (structural) ---------------------------------
{
  assert(
    (migrationSource.match(/where id = v_item\.(variant_id|product_id) and stock_quantity >= v_item\.quantity/g) ?? []).length === 2,
    "(structural) BOTH the variant and option-less stock updates must condition on stock_quantity >= quantity in the WHERE clause — a select-then-update pattern would race, this doesn't"
  );
}

// --- 19. payment success 상태 전환 (structural) ------------------------------------
{
  assert(
    migrationSource.includes("set status = 'PAID',") &&
      migrationSource.includes("set payment_status = 'PAID',\n        order_status = case when order_status in ('ORDER_CREATED', 'PAYMENT_PENDING') then 'PREPARING' else order_status end"),
    "(structural) a successful finalize must move payments.status to PAID and orders.payment_status/order_status together"
  );
}

// --- 20. payment failed 상태 처리 (structural) -------------------------------------
{
  assert(
    migrationSource.includes("set status = 'FAILED', failure_code = p_failure_code, failure_message = p_failure_message") &&
      migrationSource.includes("set order_status = 'PAYMENT_PENDING'\n    where id = v_payment.order_id and order_status = 'ORDER_CREATED'"),
    "(structural) a failed payment must mark the attempt FAILED while keeping the ORDER in a retry-friendly state (never CANCELLED, never deleted)"
  );
}

// --- 21. payment success 후 cart 제거 조건 (structural) ----------------------------
{
  assert(
    checkoutClientSource.includes("function finalizeOrder(orderNumber: string)") &&
      checkoutClientSource.includes("availableItems.forEach((item) => {\n        if (item.cartItemId) cart.removeItem(item.cartItemId);"),
    "(structural) cart items must be removed only inside finalizeOrder (reached after a successful payment confirmation), scoped to just the items actually in this order"
  );
}

// --- 22. payment failure 후 cart 유지 (structural) ---------------------------------
{
  const attemptPaymentStart = checkoutClientSource.indexOf("async function attemptPayment");
  const attemptPaymentEnd = checkoutClientSource.indexOf("\n  }\n", attemptPaymentStart);
  const attemptPaymentBody = checkoutClientSource.slice(attemptPaymentStart, attemptPaymentEnd);
  assert(
    attemptPaymentBody.includes("setPaymentFailure({") && !attemptPaymentBody.includes("cart.removeItem"),
    "(structural) attemptPayment's failure branches must only ever record a paymentFailure, never touch the cart — a failed payment must never remove items"
  );
}

// --- 23. payment event uniqueness (structural) --------------------------------------
{
  assert(
    step11SchemaSource.includes("unique (provider, provider_event_id)"),
    "(structural) payment_events must have a real DB unique constraint on (provider, provider_event_id) — the entire webhook idempotency mechanism"
  );
  assert(
    migrationSource.includes("exception when unique_violation then\n    return jsonb_build_object('status', 'duplicate_event', 'already_processed', true)"),
    "(structural) process_webhook_payment_event must treat a duplicate event id as already-handled, not re-run finalize logic"
  );
}

// --- 24. 카드정보 저장 금지 구조 (structural) -----------------------------------------
{
  // Targets an actual STORAGE construct (a column, a field name, an inserted/
  // selected identifier) — not prose comments that merely mention "card" while
  // explaining what must NEVER be stored (e.g. this schema file's own header).
  const paymentFiles = [step11SchemaSource, migrationSource, typesSource, mockSource, confirmRouteSource, prepareRouteSource];
  const forbidden = /\b(card_?number|cvv|cvc|full_?expiry|bank_?credentials?|upi_?pin)\b\s*[:=]|\bcolumn\s+\w*(card_?number|cvv|cvc)/i;
  for (const source of paymentFiles) {
    assert(!forbidden.test(source), "(structural) no payment-domain file may declare a field/column that stores a card number/CVV/full expiry/bank credential/UPI PIN");
  }
  assert(
    step11SchemaSource.includes("raw_metadata jsonb"),
    "(structural) the only free-form provider-response field must be a plain jsonb allow-list column (raw_metadata), never dedicated card/credential columns"
  );
}

// --- 25. customer ownership (structural) ---------------------------------------------
{
  const step11RpcSource = readFileSync(new URL("../supabase/migrations/20260825000300_step11_payment_rpcs.sql", import.meta.url), "utf8");
  assert(
    step11RpcSource.includes("if not public._check_order_access(p_order_id, p_guest_contact) then") &&
      step11RpcSource.includes("if not public._check_order_access(v_order_id, p_guest_contact) then"),
    "(structural) BOTH prepare_payment and confirm_payment must re-verify ownership via the same _check_order_access helper before touching payment state"
  );
}

// --- 26. 재시도 가능 주문 (structural) --------------------------------------------------
{
  assert(
    mypageActionSource.includes('canRetryPayment: row.payment_status !== "PAID" && row.order_status !== "CANCELLED"'),
    "(structural) the customer-facing order detail must expose whether a fresh payment attempt is still possible for this order"
  );
}

// --- 27. order total/currency consistency ------------------------------------------
{
  const product = baseProduct({ salePrice: 12000 });
  const price = resolveSellPrice({ product, variant: null, market: KR_MARKET });
  const lines = enrichCartItems([cartItem({ quantity: 2, unitPriceSnapshot: 12000 })], [product], KR_MARKET);
  const totals = calculateCartSummary(lines);
  assert(price.salePrice * 2 === totals.itemsTotal, "the order's itemsTotal must be internally consistent with the same per-item price used to build it");
  assert(
    migrationSource.includes("v_order.market_code, v_order.currency_code, v_order.total_amount, 'READY'"),
    "(structural) payments.currency_code/amount must be copied directly from the order row, never independently computed or client-supplied"
  );
}

// --- 28. payment provider normalized result (structural) --------------------------
{
  assert(
    typesSource.includes("amount: number;") && typesSource.includes("currencyCode: CurrencyCode;") && typesSource.includes("approvedAt: string;"),
    "(structural) ConfirmPaymentResult's success branch must be a normalized shape (amount/currencyCode/approvedAt), not a raw provider payload leaking into the rest of the app"
  );
  assert(
    !confirmRouteSource.includes("result.raw") && !confirmRouteSource.includes("rawResponse"),
    "(structural) the confirm route must never forward a raw provider response object to the client or the RPC"
  );
}

// --- 29. browser confirm/webhook 공통 finalize 경계 (structural) --------------------
{
  assert(
    (migrationSource.match(/return public\._apply_payment_result\(/g) ?? []).length === 2,
    "(structural) BOTH confirm_payment (browser path) and process_webhook_payment_event (webhook path) must call the SAME _apply_payment_result — never a second, duplicated finalize implementation"
  );
}

// --- 30. 기존 create_order idempotency regression 없음 -------------------------------
{
  assert(
    step22MigrationSource.includes("create unique index orders_idempotency_key_key on public.orders (idempotency_key)"),
    "(structural) STEP 22's order-creation idempotency (orders.idempotency_key unique index) must be untouched by this STEP's payment-focused migration"
  );
  assert(
    !/create (or replace )?function public\.create_order|drop function if exists public\.create_order/.test(migrationSource) &&
      !migrationSource.includes("orders_idempotency_key_key"),
    "(structural) this STEP's migration must not define/replace/drop create_order() or redeclare its idempotency index — payment finalization is a fully separate RPC surface (the header comment may still mention it in prose)"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — provider registry/routing, prepare/confirm amount+currency source-of-truth, atomic stock deduction (variant/option-less/unlimited), multi-item rollback, idempotency (payment + webhook event), retry-friendly failure handling, cart timing, and no-card-data-storage checks passed."
);
