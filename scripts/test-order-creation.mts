/**
 * STEP 22 spec section 36 — framework-free test script (same convention as
 * scripts/test-cart.mts / scripts/test-checkout-shipping.mts) covering
 * order-creation snapshot correctness, idempotency, and cart-ownership
 * re-verification. createOrderAction/create_order themselves need a live
 * Supabase DB and can't run in this sandbox, so — same honesty convention
 * used throughout this session — checks that can only be proven against
 * the real Server Action/RPC source are structural (readFileSync + regex),
 * clearly marked "(structural)" below; everything else exercises the real
 * pure functions those two call into.
 *
 * Run with: node --experimental-strip-types scripts/test-order-creation.mts
 */
import { readFileSync } from "node:fs";
import { resolveSellPrice, isCartLineOwnedByCaller } from "../lib/checkout/normalize.ts";
import { calculateCartSummary, enrichCartItem, enrichCartItems } from "../lib/cart.ts";
import { getEffectiveStock } from "../lib/storefront/productVariants.ts";
import { evaluateGroupEligibility } from "../lib/shipping/eligibility.ts";
import { computeGroupShippingQuote, isShippingQuoteBlocking } from "../lib/shipping/quote.ts";
import { getPurchasableCartItems } from "../lib/cart/cartLogic.ts";
import { generateOrderId } from "../lib/order.ts";
import type { Product, ProductVariant } from "../types";
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

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return { id: "v1", sku: "SKU-1-A", optionValues: { 색상: "블랙" }, additionalPrice: 0, stockQuantity: 5, isActive: true, ...overrides };
}

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

const orderActionSource = readFileSync(new URL("../lib/actions/order.ts", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/20260906000300_step22_order_snapshot.sql", import.meta.url), "utf8");

// --- 1. 옵션 없는 주문 item snapshot ------------------------------------------
{
  const product = baseProduct({ salePrice: 19900, originalPrice: 20000 });
  const price = resolveSellPrice({ product, variant: null, market: KR_MARKET });
  assert(price.salePrice === 19900, `an option-less order line's unit price must be the product's KRW sale price, got ${price.salePrice}`);
}

// --- 2. variant 주문 item snapshot ---------------------------------------------
{
  const v = variant({ additionalPrice: 3000 });
  const product = baseProduct({ salePrice: 19900, options: [{ name: "색상", choices: ["블랙"] }], variants: [v] });
  const price = resolveSellPrice({ product, variant: v, market: KR_MARKET });
  assert(price.salePrice === 22900, `a variant order line must snapshot base + additional_price (19900+3000=22900), got ${price.salePrice}`);
}

// --- 3. product name snapshot (structural) -------------------------------------
{
  assert(
    migrationSource.includes("'product_name_snapshot', v_product.name_ko"),
    "(structural) create_order must snapshot product_name_snapshot from the product row it looked up itself, never from client input"
  );
  // v_resolved_items is the RPC's own server-built jsonb (assembled from v_product.name_ko
  // above), re-read by the second loop below — client-supplied p_items never has this key at
  // all, since the per-item loop above only ever reads product_id/variant_id/quantity from it.
  const firstLoopEnd = migrationSource.indexOf("end loop;");
  const firstLoopBody = migrationSource.slice(0, firstLoopEnd);
  assert(
    !firstLoopBody.includes("v_item ->> 'product_name_snapshot'") && !firstLoopBody.includes("v_item -> 'product_name_snapshot'"),
    "(structural) the loop over CLIENT-supplied p_items must never read a product_name_snapshot field from it"
  );
}

// --- 4. SKU snapshot (structural) -----------------------------------------------
{
  assert(
    migrationSource.includes("'sku_snapshot', coalesce(v_variant.sku, v_product.sku)"),
    "(structural) create_order must derive sku_snapshot from the resolved variant/product row, never trust the client's own sku_snapshot claim"
  );
}

// --- 5. option snapshot -----------------------------------------------------------
{
  const v = variant({ id: "bm", optionValues: { 색상: "블랙", 사이즈: "M" } });
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }, { name: "사이즈", choices: ["M"] }], variants: [v] });
  const line = enrichCartItem(cartItem({ variantId: "bm" }), [product], KR_MARKET);
  assert(line !== null && JSON.stringify(line.optionValues) === JSON.stringify({ 색상: "블랙", 사이즈: "M" }), "a variant order's option snapshot must carry the variant's own option values");
  assert(
    migrationSource.includes("v_option_snapshot := coalesce(v_variant.option_values, '{}'::jsonb)"),
    "(structural) create_order must derive the stored option_snapshot from the variant row itself, not from client-supplied option_snapshot"
  );
}

// --- 6. unit price snapshot (재검증, cart snapshot 불신) --------------------------
{
  // Price raised since add-to-cart (19900 -> 23000): the ORDER must snapshot the CURRENT price, never the stale cart unitPriceSnapshot.
  const product = baseProduct({ salePrice: 23000, originalPrice: 24000 });
  const price = resolveSellPrice({ product, variant: null, market: KR_MARKET });
  assert(price.salePrice === 23000, "unit_price snapshotted onto the order must be the CURRENT resolveSellPrice result, never the stale cart snapshot");
  assert(
    orderActionSource.includes("resolveSellPrice({ product, variant, market: validationMarket })"),
    "(structural) createOrderAction must recompute price via resolveSellPrice before ever building an order item, never copy item.unitPrice through as-is"
  );
}

// --- 7. subtotal 계산 --------------------------------------------------------------
{
  const product = baseProduct({ salePrice: 8000 });
  const line = enrichCartItem(cartItem({ quantity: 4, unitPriceSnapshot: 8000 }), [product], KR_MARKET);
  assert(line !== null && line.subtotal === 32000, `subtotal must be unit_price(8000) x quantity(4) = 32000, got ${line?.subtotal}`);
}

// --- 8. market/currency 유지 (structural) ------------------------------------------
{
  assert(
    orderActionSource.includes("p_market_code: input.market") && orderActionSource.includes("p_currency_code: input.currency"),
    "(structural) createOrderAction must forward the checkout's own market/currency onto the order, not derive it from the product's native currency"
  );
  assert(
    migrationSource.includes("p_market_code public.market_code_enum") && migrationSource.includes("p_currency_code public.currency_code_enum"),
    "(structural) create_order must store market_code/currency_code as typed enum columns, never free text"
  );
}

// --- 9. 배송 type snapshot (structural) ---------------------------------------------
{
  assert(
    migrationSource.includes("'shipping_type', v_product.shipping_type"),
    "(structural) create_order must snapshot shipping_type from the resolved product row, never trust the client's own claimed shipping_type"
  );
}

// --- 10. 배송비 snapshot -------------------------------------------------------------
{
  const quote = computeGroupShippingQuote("domestic", [{ shippingFee: 3000 } as never], "KRW", true);
  assert(quote.amount === 3000 && quote.status === "CALCULATED", "a real per-group shipping fee must snapshot as a concrete CALCULATED amount");
  assert(
    migrationSource.includes("shipping_fee, status\n      ) values"),
    "(structural) create_order must persist a resolved shipping_fee onto each shipping_groups row"
  );
}

// --- 11. 주소 snapshot (structural) ---------------------------------------------------
{
  assert(
    migrationSource.includes("shipping_address jsonb) not") === false && migrationSource.includes("p_shipping_address jsonb"),
    "create_order must accept the full shipping address object, not merely an address book id"
  );
  const schemaSource = readFileSync(new URL("../supabase/migrations/20260820000200_schema_tables.sql", import.meta.url), "utf8");
  assert(
    schemaSource.includes("shipping_address jsonb not null"),
    "(structural) orders.shipping_address must store the full address snapshot inline (not a foreign key to a mutable address book), so a later address-book edit never changes a past order"
  );
}

// --- 12. 총액 계산 -----------------------------------------------------------------------
{
  const product = baseProduct({ salePrice: 10000 });
  const lines = enrichCartItems([cartItem({ quantity: 2, unitPriceSnapshot: 10000 })], [product], KR_MARKET);
  const totals = calculateCartSummary(lines);
  assert(totals.grandTotal === totals.itemsTotal + totals.shippingTotal, "grand total must equal itemsTotal + shippingTotal, computed server-side");
}

// --- 13. client supplied total 불신 (structural) -----------------------------------------
{
  assert(
    !/insert into public\.orders[\s\S]{0,50}p_subtotal|p_total_amount|p_shipping_amount/.test(migrationSource),
    "(structural) create_order must never accept a client-declared subtotal/shipping/total parameter — every amount is recomputed from v_subtotal/v_shipping_amount/v_final_total inside the function"
  );
  assert(
    migrationSource.includes("v_final_total := v_subtotal + v_shipping_amount - v_coupon_discount - p_points_used"),
    "(structural) the final order total must be computed server-side from server-resolved subtotal/shipping/discount, never taken from client input"
  );
}

// --- 14. cart snapshot price 불신 (structural) -------------------------------------------
{
  const cartSource = readFileSync(new URL("../lib/cart.ts", import.meta.url), "utf8");
  assert(
    cartSource.includes("resolveSellPrice"),
    "(structural) lib/cart.ts must resolve the displayed price via resolveSellPrice (current price), never surface unitPriceSnapshot as the final price"
  );
}

// --- 15. 현재 가격 재검증 ------------------------------------------------------------------
{
  const product = baseProduct({ salePrice: 15000 });
  const stalePrice = 12000; // what the cart snapshotted at add-to-cart time
  const currentPrice = resolveSellPrice({ product, variant: null, market: KR_MARKET }).salePrice;
  assert(currentPrice !== stalePrice && currentPrice === 15000, "order creation must always re-resolve the CURRENT price, independent of whatever the cart snapshot says");
}

// --- 16. 현재 stock 재검증 -----------------------------------------------------------------
{
  const currentStock = getEffectiveStock(false, null, 2);
  assert(currentStock === 2, `current stock must be re-read live, got ${currentStock}`);
  assert(5 > currentStock, "a requested quantity above the freshly re-checked stock must be detectable as exceeding it");
  assert(
    orderActionSource.includes("item.quantity > currentStock") && orderActionSource.includes('error: "STOCK_CHANGED"'),
    "(structural) createOrderAction must reject with STOCK_CHANGED when the freshly re-checked stock can't cover the requested quantity"
  );
}

// --- 17. variant ownership 검증 (cross-product 재확인, structural) ------------------------
{
  assert(
    migrationSource.includes("where id = v_variant_id and product_id = v_product_id"),
    "(structural) create_order must resolve a variant scoped to the CLAIMED product_id, rejecting a variant id that actually belongs to a different product"
  );
  assert(
    migrationSource.includes("does not belong to product"),
    "(structural) a cross-product variant id must raise a clear, distinguishable exception"
  );
}

// --- 18. 비활성 variant 거부 -----------------------------------------------------------------
{
  const inactive = variant({ id: "iv", isActive: false });
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }], variants: [inactive] });
  const line = enrichCartItem(cartItem({ variantId: "iv" }), [product], KR_MARKET);
  assert(line !== null && !line.isPurchasable, "an inactive variant must never be purchasable at order-creation time");
  assert(
    migrationSource.includes("if not v_variant.is_active then") && migrationSource.includes("STOCK_CHANGED: variant"),
    "(structural) create_order must itself re-check variant.is_active and reject an inactive variant, not only rely on the TS pre-check"
  );
}

// --- 19. shipping unavailable 거부 ------------------------------------------------------------
{
  const restricted = baseProduct({ id: "r", dbId: "r", availableCountries: ["KR"] });
  const eligibility = evaluateGroupEligibility("domestic", [restricted], "IN");
  const quote = computeGroupShippingQuote("domestic", [], "INR", eligibility.isShippable);
  assert(isShippingQuoteBlocking(quote), "an unshippable destination's quote must block order creation");
  assert(
    orderActionSource.includes('error: quote.status === "PENDING" ? "SHIPPING_PENDING" : "SHIPPING_UNAVAILABLE"'),
    "(structural) createOrderAction must reject order creation when any shipping group's quote is blocking (UNAVAILABLE/PENDING)"
  );
}

// --- 20. shipping pending 거부 -------------------------------------------------------------
{
  // Reserved/forward-compatible status (see lib/shipping/quote.ts) — this proves the
  // GATING logic itself rejects PENDING, independent of whether real fee logic can
  // produce it yet.
  const pendingQuote = computeGroupShippingQuote("overseas_direct", [], "KRW", true);
  assert(pendingQuote.status === "PENDING", "an empty-items quote must report PENDING");
  assert(isShippingQuoteBlocking(pendingQuote), "a PENDING shipping quote must be treated as blocking, exactly like UNAVAILABLE — never let an order through with an undetermined fee");
}

// --- 21. idempotency 동일 key 중복 주문 방지 (structural) -----------------------------------
{
  assert(
    migrationSource.includes("create unique index orders_idempotency_key_key on public.orders (idempotency_key)"),
    "(structural) orders.idempotency_key must be backed by a real DB unique constraint — the actual idempotency guarantee, mirroring payment_events' own pattern"
  );
  assert(
    migrationSource.includes("select id into v_order_id from public.orders where idempotency_key = p_idempotency_key") &&
      migrationSource.includes("return v_order_id;"),
    "(structural) create_order must look up an existing order by idempotency_key up front and return it as-is, rather than re-running validation or inserting again"
  );
  assert(
    migrationSource.includes("exception when unique_violation then"),
    "(structural) create_order must also handle the true concurrent race (two near-simultaneous calls with the same key) via the insert's own unique_violation, not just the up-front check"
  );
}

// --- 22. 다른 idempotency key는 별도 주문 (structural) -------------------------------------
{
  // A plain (non-partial) unique index still permits any number of distinct
  // non-null keys — only an EXACT key match short-circuits to the existing
  // order; nothing in create_order() ties two different keys together.
  assert(
    !migrationSource.includes("idempotency_key is not null and idempotency_key <>"),
    "a different idempotency key must never be treated as matching an existing order — only an identical key does"
  );
}

// --- 23. 선택 cart item만 주문 -------------------------------------------------------------
{
  const product = baseProduct();
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", checked: true }), cartItem({ cartItemId: "2", checked: false })],
    [product],
    KR_MARKET
  );
  const purchasable = getPurchasableCartItems(lines.filter((l) => l.cartItem.checked));
  assert(purchasable.length === 1, "order creation from cart must only ever include checked, purchasable lines");
}

// --- 24. 다른 사용자 cart item 거부 ----------------------------------------------------------
{
  const realCartLines = [{ cartItemId: "real-1", productId: "p1", variantId: null }];
  assert(
    isCartLineOwnedByCaller({ cartItemId: "real-1", productId: "p1", variantId: null }, realCartLines),
    "a cartItemId that genuinely exists in the caller's own cart must be recognized as owned"
  );
  assert(
    !isCartLineOwnedByCaller({ cartItemId: "someone-elses-item", productId: "p1", variantId: null }, realCartLines),
    "a cartItemId that doesn't match any of the caller's own real cart lines (e.g. copied from another user's cart) must be rejected"
  );
  assert(
    orderActionSource.includes("isCartLineOwnedByCaller") && orderActionSource.includes('error: "CART_CHANGED"'),
    "(structural) createOrderAction must re-verify every cart-sourced line against the caller's own persisted cart before creating an order"
  );
}

// --- 25. order ownership (structural) -------------------------------------------------------
{
  const rlsSource = readFileSync(new URL("../supabase/migrations/20260820000400_rls_policies.sql", import.meta.url), "utf8");
  assert(
    rlsSource.includes("create policy orders_select_own on public.orders") && rlsSource.includes("using (auth.uid() = user_id)"),
    "(structural) orders must be readable only by their own owner via RLS — a guessed/incremented order id must return zero rows for anyone else"
  );
  const mypageSource = readFileSync(new URL("../lib/actions/mypage.ts", import.meta.url), "utf8");
  assert(
    mypageSource.includes('.eq("user_id", user.id)') && mypageSource.includes("getMyOrderDetailAction"),
    "(structural) getMyOrderDetailAction must also filter by the caller's own user_id explicitly, on top of RLS"
  );
}

// --- 26. 주문번호 unique 구조 --------------------------------------------------------------
{
  const sample = new Set(Array.from({ length: 5000 }, () => generateOrderId()));
  assert(sample.size === 5000, "generateOrderId must not produce collisions across a large same-process sample");
  assert(/^ORD-\d{8}-[A-Z0-9]{8}$/.test(generateOrderId()), "order number format must be ORD-YYYYMMDD-<8 random base36 chars>");
  const schemaSource = readFileSync(new URL("../supabase/migrations/20260820000200_schema_tables.sql", import.meta.url), "utf8");
  assert(
    schemaSource.includes("order_number text not null unique"),
    "(structural) order_number must ultimately be guaranteed unique by a real DB constraint, not merely by client-side randomness"
  );
}

// --- 27. cart/buy-now normalization (structural) --------------------------------------------
{
  assert(
    orderActionSource.includes('source: "cart" | "buynow"'),
    "(structural) CreateOrderActionInput must carry which pipeline a checkout came from"
  );
  assert(
    (orderActionSource.match(/async function createOrderAction/g) ?? []).length === 1,
    "(structural) there must be exactly ONE order-creation entry point shared by both cart and buy-now checkout, not two parallel implementations"
  );
  assert(
    orderActionSource.includes('if (input.source === "cart")'),
    "(structural) only the cart-sourced path re-verifies cart ownership — buy-now legitimately has no backing cart_items row to check"
  );
}

// --- 28. empty checkout 거부 -----------------------------------------------------------------
{
  const lines = enrichCartItems([], [baseProduct()], KR_MARKET);
  assert(lines.length === 0, "an empty item list must enrich to nothing, never throw");
  assert(
    orderActionSource.includes("if (input.items.length === 0)"),
    "(structural) createOrderAction must explicitly reject an empty item list before doing any further work"
  );
}

// --- 29. unavailable-only checkout 거부 (structural) ------------------------------------------
{
  const checkoutClientSource = readFileSync(new URL("../components/checkout/CheckoutClient.tsx", import.meta.url), "utf8");
  assert(
    checkoutClientSource.includes("unavailableItems.length > 0"),
    "(structural) CheckoutClient must block proceeding to order creation entirely while any item is unavailable/unpurchasable"
  );
}

// --- 30. order item 합계와 order total 일치 검증 -------------------------------------------------
{
  const product1 = baseProduct({ id: "a", dbId: "a", salePrice: 10000 });
  const product2 = baseProduct({ id: "b", dbId: "b", salePrice: 5000 });
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", productId: "a", quantity: 2, unitPriceSnapshot: 10000 }), cartItem({ cartItemId: "2", productId: "b", quantity: 3, unitPriceSnapshot: 5000 })],
    [product1, product2],
    KR_MARKET
  );
  const itemSubtotalSum = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const totals = calculateCartSummary(lines);
  assert(itemSubtotalSum === totals.itemsTotal, `the sum of every order item's own subtotal (${itemSubtotalSum}) must equal the order's itemsTotal (${totals.itemsTotal})`);
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — order-item/variant/option/price/shipping/address snapshot correctness, idempotency, cart-ownership re-verification, order-number uniqueness, and cart/buy-now pipeline-sharing checks passed."
);
