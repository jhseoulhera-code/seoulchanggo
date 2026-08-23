/**
 * STEP 21 spec section 39 — framework-free test script (same convention as
 * scripts/test-cart.mts) covering the Checkout/shipping-group business
 * logic added this step: variant-aware price/stock resolution
 * (lib/checkout/normalize.ts's resolveSellPrice), shipping-type grouping
 * reused from lib/cart.ts, and the new shipping eligibility/quote helpers
 * (lib/shipping/eligibility.ts, lib/shipping/quote.ts). Server Actions and
 * the create_order RPC itself aren't Node-runnable in this sandbox (no live
 * Supabase/DB), so a few checks are structural source-inspection instead —
 * marked "(structural)" below, same honesty convention as test-cart.mts.
 *
 * Run with: node --experimental-strip-types scripts/test-checkout-shipping.mts
 */
import { readFileSync } from "node:fs";
import { resolveSellPrice } from "../lib/checkout/normalize.ts";
import { calculateCartSummary, enrichCartItem, enrichCartItems, groupLinesByShippingType, summarizeLines } from "../lib/cart.ts";
import { getEffectiveStock } from "../lib/storefront/productVariants.ts";
import { evaluateGroupEligibility } from "../lib/shipping/eligibility.ts";
import { computeGroupShippingQuote, isGrandTotalDetermined } from "../lib/shipping/quote.ts";
import { getPurchasableCartItems } from "../lib/cart/cartLogic.ts";
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
const IN_MARKET: Market = { countryCode: "IN", countryName: "인도", locale: "en", currency: "INR" };

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

// --- 1. 옵션 없는 상품 checkout 가격 --------------------------------------------
{
  const product = baseProduct({ salePrice: 19900, originalPrice: 20000 });
  const price = resolveSellPrice({ product, variant: null, market: KR_MARKET });
  assert(price.salePrice === 19900, `option-less checkout price must equal the product's KRW sale price, got ${price.salePrice}`);
  assert(price.originalPrice === 20000, "option-less checkout original price must equal the product's KRW original price");
}

// --- 2. variant 상품 checkout 가격 / 3. additional_price 반영 -------------------
{
  const v = variant({ additionalPrice: 2000 });
  const product = baseProduct({ salePrice: 19900, originalPrice: 20000, options: [{ name: "색상", choices: ["블랙"] }], variants: [v] });
  const price = resolveSellPrice({ product, variant: v, market: KR_MARKET });
  assert(price.salePrice === 21900, `variant checkout price must be base(19900) + additional_price(2000) = 21900, got ${price.salePrice}`);
  assert(price.originalPrice === 22000, "variant checkout original price must also carry the additional_price delta");
}
{
  // additional_price must convert through the SAME dev-rate as the base price for a non-KRW market.
  const v = variant({ additionalPrice: 2000 });
  const product = baseProduct({ salePrice: 19900, options: [{ name: "색상", choices: ["블랙"] }], variants: [v] });
  const price = resolveSellPrice({ product, variant: v, market: IN_MARKET });
  const expected = Math.max(0, Math.round(19900 * 0.06) + Math.round(2000 * 0.06));
  // resolveSellPrice doesn't round mid-way (only calculateVariantPrice floors at 0), so compare with a small tolerance.
  assert(Math.abs(price.salePrice - (19900 * 0.06 + 2000 * 0.06)) < 1, `variant additional_price must convert via the market's dev-rate like the base price, got ${price.salePrice} (rough expected ${expected})`);
}

// --- 4. variant 재고 체크 --------------------------------------------------------
{
  const v = variant({ stockQuantity: 3 });
  const stock = getEffectiveStock(true, v, 999);
  assert(stock === 3, `variant stock must come from the variant itself, not the parent product's stock, got ${stock}`);
  assert(5 > stock, "a requested quantity above the variant's own stock must be detectable as exceeding it");
}

// --- 5. 비활성 variant 거부 --------------------------------------------------------
{
  const inactive = variant({ id: "iv", isActive: false });
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }], variants: [inactive] });
  const line = enrichCartItem(cartItem({ variantId: "iv" }), [product], KR_MARKET);
  assert(line !== null && !line.isPurchasable, "an inactive variant must never be purchasable at checkout, regardless of stock");

  const orderActionSource = readFileSync(new URL("../lib/actions/order.ts", import.meta.url), "utf8");
  assert(
    /variant && !variant\.isActive/.test(orderActionSource),
    "(structural) createOrderAction's pre-check must explicitly reject an inactive variant before ever comparing price"
  );
}

// --- 6. 다른 product의 variant 사용 거부 (cross-product) --------------------------
{
  const orderActionSource = readFileSync(new URL("../lib/actions/order.ts", import.meta.url), "utf8");
  assert(
    /\(product\.variants \?\?\s*\[\]\)\.find\(\(v\) => v\.id === item\.variantId\)/.test(orderActionSource),
    "(structural) createOrderAction must resolve variantId only against the matched PRODUCT's OWN variants array, never a global variant lookup — this is what makes a cross-product variant id fail to match"
  );
  assert(
    /if \(item\.variantId && !variant\) return \{ ok: false, error: "PRICE_MISMATCH" \}/.test(orderActionSource),
    "(structural) a variantId that doesn't resolve within its claimed product (e.g. it belongs to a different product) must be rejected, not silently treated as option-less"
  );

  const migrationSource = readFileSync(
    new URL("../supabase/migrations/20260906000200_step21_checkout_shipping.sql", import.meta.url),
    "utf8"
  );
  assert(
    migrationSource.includes("where id = v_variant_id and product_id = v_product_id"),
    "(structural) create_order's own SQL must also scope the variant lookup to the claimed product_id, rejecting a cross-product variant id at the RPC layer too — not just in the TS pre-check"
  );
  assert(
    migrationSource.includes("does not belong to product"),
    "(structural) create_order must raise a clear exception when a variant doesn't belong to the given product"
  );
}

// --- 7. 옵션 라벨 정규화 (사람이 읽을 수 있는 형태) --------------------------------
{
  const v = variant({ id: "bm", optionValues: { 색상: "블랙", 사이즈: "M" } });
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }, { name: "사이즈", choices: ["M"] }], variants: [v] });
  const line = enrichCartItem(cartItem({ variantId: "bm" }), [product], KR_MARKET);
  assert(line !== null && line.optionLabel.length > 0 && !line.optionLabel.startsWith("{"), `checkout option display must be human-readable, never raw JSON, got "${line?.optionLabel}"`);
}

// --- 8. 가격 변경 감지 --------------------------------------------------------------
{
  const product = baseProduct({ salePrice: 23000, originalPrice: 24000 });
  const line = enrichCartItem(cartItem({ unitPriceSnapshot: 19900 }), [product], KR_MARKET);
  assert(line !== null && line.priceChanged, "a checkout line must flag priceChanged when the current price differs from the cart's add-time snapshot");
  assert(line!.unitPrice === 23000, "the checkout line's unitPrice must always be the CURRENT price, never the stale snapshot, even when priceChanged is true");
}

// --- 9. cart snapshot 가격을 최종가로 신뢰하지 않는 구조 (structural) --------------
{
  const orderActionSource = readFileSync(new URL("../lib/actions/order.ts", import.meta.url), "utf8");
  assert(
    /resolveSellPrice\(\{ product, variant, market: validationMarket \}\)/.test(orderActionSource),
    "(structural) createOrderAction must recompute the expected price from the CURRENT product/variant/market, never read it back out of the client-submitted item as-is"
  );
  const cartSource = readFileSync(new URL("../lib/cart.ts", import.meta.url), "utf8");
  assert(
    /unitPriceSnapshot/.test(cartSource) && /resolveSellPrice/.test(cartSource),
    "(structural) lib/cart.ts must resolve the displayed/checkout price via resolveSellPrice (current price), using unitPriceSnapshot only for change-detection"
  );
}

// --- 10/11. shipping-type 기반 그룹핑 + 국내/해외직배송/구매대행 분리 --------------
{
  const domestic = baseProduct({ id: "d", dbId: "d", shippingType: "domestic" });
  const overseasDirect = baseProduct({ id: "od", dbId: "od", shippingType: "overseas_direct" });
  const overseasAgent = baseProduct({ id: "oa", dbId: "oa", shippingType: "overseas_agent" });
  const lines = enrichCartItems(
    [
      cartItem({ cartItemId: "1", productId: "d" }),
      cartItem({ cartItemId: "2", productId: "od" }),
      cartItem({ cartItemId: "3", productId: "oa" }),
    ],
    [domestic, overseasDirect, overseasAgent],
    KR_MARKET
  );
  const groups = groupLinesByShippingType(lines);
  assert(groups.length === 3, `a cart mixing all three shipping types must produce three independent groups, got ${groups.length}`);
  assert(new Set(groups.map((g) => g.shippingType)).size === 3, "the three groups must each be a distinct shippingType, never collapsed into one");
  for (const type of ["domestic", "overseas_direct", "overseas_agent"] as const) {
    assert(groups.find((g) => g.shippingType === type)?.lines.length === 1, `the ${type} group must contain exactly its own line, not another group's`);
  }
}

// --- 12. shipping-quote 0원과 null 구분 -------------------------------------------
{
  const freeQuote = computeGroupShippingQuote("domestic", [{ shippingFee: 0 } as never], "KRW", true);
  assert(freeQuote.status === "FREE" && freeQuote.amount === 0, `a real, resolved zero fee must report status FREE with amount 0 (a real number), got status=${freeQuote.status} amount=${freeQuote.amount}`);

  const unavailableQuote = computeGroupShippingQuote("overseas_direct", [], "KRW", false);
  assert(unavailableQuote.amount === null, "an unshippable group's quote amount must be null, never faked as 0");
  assert(unavailableQuote.status === "UNAVAILABLE", "an unshippable group's quote status must be UNAVAILABLE");
  assert(freeQuote.amount !== unavailableQuote.amount, "FREE(0) and UNAVAILABLE(null) must be structurally distinguishable, not both collapse to the same falsy value");
}

// --- 13. 배송 불가 상태 (destination country) -------------------------------------
{
  const restricted = baseProduct({ id: "r", dbId: "r", availableCountries: ["KR"] });
  const eligibility = evaluateGroupEligibility("domestic", [restricted], "IN");
  assert(!eligibility.isShippable, "a group containing a product restricted to KR must not be shippable to IN");
  assert(eligibility.unshippableProductIds.includes("r"), "the unshippable product must be identified by id for the UI to report which item blocked the group");

  const quote = computeGroupShippingQuote("domestic", [], "INR", eligibility.isShippable);
  assert(quote.status === "UNAVAILABLE" && quote.amount === null, "an unshippable destination must produce an UNAVAILABLE quote with a null amount, never a fabricated fee");
}

// --- 14. 배송비 미정(pending) 상태 -------------------------------------------------
{
  // Reserved/forward-compatible status: today's fee logic always resolves synchronously,
  // so PENDING is only reachable via this structural edge (no priced items yet) — see
  // lib/shipping/quote.ts's own comment on why a real async PENDING isn't wired up this step.
  const quote = computeGroupShippingQuote("overseas_direct", [], "KRW", true);
  assert(quote.status === "PENDING", `a group with no priced items yet must report PENDING rather than fabricating a 0 fee, got ${quote.status}`);
  assert(quote.amount === null, "a PENDING quote's amount must be null, never displayed as a number");
}

// --- 15. item 단위 subtotal 계산 ----------------------------------------------------
{
  const product = baseProduct({ salePrice: 12000 });
  const line = enrichCartItem(cartItem({ quantity: 3, unitPriceSnapshot: 12000 }), [product], KR_MARKET);
  assert(line !== null && line.subtotal === 36000, `item subtotal must be unitPrice(12000) * quantity(3) = 36000, got ${line?.subtotal}`);
}

// --- 16. 그룹 단위 subtotal 계산 ----------------------------------------------------
{
  const domestic1 = baseProduct({ id: "d1", dbId: "d1", salePrice: 10000, shippingType: "domestic" });
  const domestic2 = baseProduct({ id: "d2", dbId: "d2", salePrice: 5000, shippingType: "domestic" });
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", productId: "d1", quantity: 2, unitPriceSnapshot: 10000 }), cartItem({ cartItemId: "2", productId: "d2", quantity: 1, unitPriceSnapshot: 5000 })],
    [domestic1, domestic2],
    KR_MARKET
  );
  const groups = groupLinesByShippingType(lines);
  const groupTotal = summarizeLines(groups[0].lines).itemsTotal;
  assert(groupTotal === 25000, `a domestic group of (2x10000)+(1x5000) must subtotal 25000, got ${groupTotal}`);
}

// --- 17. checkout 전체 합계 계산 ----------------------------------------------------
{
  const domestic = baseProduct({ id: "d", dbId: "d", salePrice: 10000, shippingType: "domestic" });
  const overseas = baseProduct({ id: "o", dbId: "o", salePrice: 20000, shippingType: "overseas_direct" });
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", productId: "d", quantity: 1, unitPriceSnapshot: 10000 }), cartItem({ cartItemId: "2", productId: "o", quantity: 1, unitPriceSnapshot: 20000 })],
    [domestic, overseas],
    KR_MARKET
  );
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 30000, `checkout items total across groups must be 30000, got ${totals.itemsTotal}`);
  assert(totals.grandTotal === totals.itemsTotal + totals.shippingTotal, "grand total must equal itemsTotal + shippingTotal (itemsTotal is already the discounted subtotal; discountTotal is a separate display-only breakdown)");
}

// --- 18. 배송비 미정 상태에서는 최종 합계도 미확정 ------------------------------------
{
  const calculated = computeGroupShippingQuote("domestic", [{ shippingFee: 3000 } as never], "KRW", true);
  const pending = computeGroupShippingQuote("overseas_direct", [], "KRW", true);
  assert(!isGrandTotalDetermined([calculated, pending]), "if any shipping group is PENDING, the overall grand total must be reported as undetermined, never a specific (wrong) number");
  assert(isGrandTotalDetermined([calculated]), "when every group has a resolved (CALCULATED/FREE) quote, the grand total must be reported as determined");
}

// --- 19. 혼합 장바구니 (국내+해외직배송+구매대행 동시) --------------------------------
{
  const domestic = baseProduct({ id: "d", dbId: "d", shippingType: "domestic", salePrice: 10000 });
  const overseasDirect = baseProduct({ id: "od", dbId: "od", shippingType: "overseas_direct", salePrice: 20000 });
  const overseasAgent = baseProduct({ id: "oa", dbId: "oa", shippingType: "overseas_agent", salePrice: 30000 });
  const lines = enrichCartItems(
    [
      cartItem({ cartItemId: "1", productId: "d", unitPriceSnapshot: 10000 }),
      cartItem({ cartItemId: "2", productId: "od", unitPriceSnapshot: 20000 }),
      cartItem({ cartItemId: "3", productId: "oa", unitPriceSnapshot: 30000 }),
    ],
    [domestic, overseasDirect, overseasAgent],
    KR_MARKET
  );
  const groups = groupLinesByShippingType(lines);
  const quotes = groups.map((g) => computeGroupShippingQuote(g.shippingType, g.lines.map((l) => ({ shippingFee: l.shippingFee }) as never), KR_MARKET.currency, true));
  assert(groups.length === 3, "a mixed cart must genuinely split into three shipping groups, never a single forced shipping fee");
  assert(new Set(quotes.map((q) => q.groupKey)).size === 3, "each of the three groups must carry its own independent shipping quote");
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 60000, `mixed-cart items total must sum all three groups (10000+20000+30000)=60000, got ${totals.itemsTotal}`);
}

// --- 20. 선택된 아이템만 checkout (selected-items-only) --------------------------------
{
  const product = baseProduct();
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", checked: true }), cartItem({ cartItemId: "2", checked: false })],
    [product],
    KR_MARKET
  );
  const totals = calculateCartSummary(lines);
  assert(totals.selectedCount === 1, "only the checked line must count toward checkout, an unchecked line must never be included");
  const purchasable = getPurchasableCartItems(lines.filter((l) => l.cartItem.checked));
  assert(purchasable.length === 1, "selected-items-only checkout must still apply the purchasable filter, not just the checked flag");
}

// --- 21. cart ownership 서버 재검증 구조 (structural) -----------------------------
{
  const orderActionSource = readFileSync(new URL("../lib/actions/order.ts", import.meta.url), "utf8");
  assert(
    /supabase\.auth\.getUser\(\)/.test(orderActionSource),
    "(structural) createOrderAction must derive the caller's identity from their own session (auth.getUser()), never from a client-submitted userId field"
  );
  assert(
    /p_user_id: user\?\.id \?\?\s*null/.test(orderActionSource),
    "(structural) the RPC's p_user_id must come from the server-resolved session user, not from CreateOrderActionInput"
  );
  assert(
    !/CreateOrderActionInput[\s\S]{0,400}userId/.test(orderActionSource),
    "(structural) CreateOrderActionInput must not carry a client-suppliable userId field at all — ownership is never client-declared"
  );
}

// --- 22. 재고 변경 감지 시 거부 (stock-change rejection) ------------------------------
{
  const orderActionSource = readFileSync(new URL("../lib/actions/order.ts", import.meta.url), "utf8");
  assert(
    /item\.quantity > currentStock[\s\S]{0,80}error: "STOCK_CHANGED"/.test(orderActionSource),
    "(structural) createOrderAction must reject with STOCK_CHANGED when the requested quantity now exceeds current stock"
  );
  assert(
    orderActionSource.includes('message.includes("STOCK_CHANGED")'),
    "(structural) the RPC-error-message mapping must also recognize a STOCK_CHANGED exception raised at the create_order layer, not only the TS pre-check's own case"
  );

  const migrationSource = readFileSync(
    new URL("../supabase/migrations/20260906000200_step21_checkout_shipping.sql", import.meta.url),
    "utf8"
  );
  assert(
    migrationSource.includes("STOCK_CHANGED: quantity exceeds available stock for variant"),
    "(structural) create_order must itself re-check variant stock at order time and raise STOCK_CHANGED, not only rely on the client's pre-check"
  );
  assert(
    migrationSource.includes("STOCK_CHANGED: quantity exceeds available stock for product"),
    "(structural) create_order must also re-check option-less product stock at order time for TRACKED products"
  );
}

// --- 23. 빈 장바구니 checkout 진입 ----------------------------------------------------
{
  const lines = enrichCartItems([], [baseProduct()], KR_MARKET);
  assert(lines.length === 0, "an empty cart must enrich to an empty line list, never throw");
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 0 && totals.grandTotal === 0, "an empty cart's totals must all be zero, not undefined/NaN");
}

// --- 24. 전부 구매 불가한 장바구니 ----------------------------------------------------
{
  const soldOut1 = baseProduct({ id: "s1", dbId: "s1", stock: 0 });
  const restricted2 = baseProduct({ id: "s2", dbId: "s2", availableCountries: ["KR"] });
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", productId: "s1" }), cartItem({ cartItemId: "2", productId: "s2" })],
    [soldOut1, restricted2],
    IN_MARKET
  );
  assert(lines.every((l) => !l.isPurchasable || !l.isAvailable), "every line in an all-unavailable cart must be flagged unpurchasable or unavailable, never silently treated as orderable");
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 0 && totals.selectedCount === 0, "an all-unavailable cart must total to zero rather than crash or show a bogus positive amount");
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — variant checkout pricing/stock, option normalization, price-change, shipping-type grouping/separation, shipping-quote (0 vs null, unavailable, pending), item/group/checkout totals, mixed-cart, selected-items-only, and ownership/stock-change structural checks passed."
);
