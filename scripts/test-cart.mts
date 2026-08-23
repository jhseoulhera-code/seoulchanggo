/**
 * STEP 20 spec section 35 — framework-free test script (same convention as
 * the other scripts/test-*.mts files) covering the cart's pure business
 * logic (lib/cart/cartLogic.ts, lib/cart.ts's enrichCartItem/summary/
 * grouping) plus two structural checks (spec items 19/20): that the
 * add-to-cart Server Action never reads a client-supplied price/stock, and
 * that every cart-mutating RPC scopes to the caller's own resolved
 * identity rather than trusting a passed-in row id alone.
 *
 * Run with: node --experimental-strip-types scripts/test-cart.mts
 */
import { readFileSync } from "node:fs";
import {
  calculateCartBadgeQuantity,
  capQuantityAtStock,
  getPurchasableCartItems,
  hasPriceChanged,
  mergeQuantities,
  sameCartIdentity,
} from "../lib/cart/cartLogic.ts";
import { calculateCartSummary, enrichCartItem, enrichCartItems, groupLinesByShippingType } from "../lib/cart.ts";
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

// --- 1/2. cart identity (option-less / variant) -----------------------------
{
  assert(sameCartIdentity({ productId: "p1" }, { productId: "p1", variantId: null }), "option-less identity must be productId + null variantId, equal regardless of undefined vs null");
  assert(sameCartIdentity({ productId: "p1", variantId: "v1" }, { productId: "p1", variantId: "v1" }), "same product + same variant must be the same identity");
  assert(!sameCartIdentity({ productId: "p1", variantId: "v1" }, { productId: "p1", variantId: "v2" }), "same product + different variant must be different identities");
  assert(!sameCartIdentity({ productId: "p1" }, { productId: "p1", variantId: "v1" }), "option-less vs a specific variant of the same product must be different identities");
}

// --- 3. 동일 상품 수량 merge / 4. 다른 variant는 별도 item ---------------------
{
  assert(mergeQuantities(2, 3, null) === 5, "merging the same identity must sum quantities when unlimited");
  // "다른 variant는 별도 item" is really a consequence of sameCartIdentity
  // above already being false for different variants — nothing to merge.
}

// --- 5. quantity 최소값 -------------------------------------------------------
{
  assert(capQuantityAtStock(0, null) === 1, "quantity must never go below 1 even if requested as 0");
  assert(capQuantityAtStock(-5, 10) === 1, "a negative requested quantity must clamp up to 1, not stay negative");
}

// --- 6. quantity 재고 초과 거부(=capped) ---------------------------------------
{
  // spec section 11's exact example: existing 3 + requested 4, stock 5 -> must not reach 7.
  assert(mergeQuantities(3, 4, 5) === 5, `existing 3 + incoming 4 capped at stock 5 must be 5, matches spec section 11's example`);
  assert(capQuantityAtStock(999, 5) === 5, "a single request far above stock must clamp to stock, not overshoot");
}

// --- 15/16/17. guest/user cart merge: duplicate-sum + stock cap ---------------
// cart_merge_guest_into_user (STEP 20 migration) applies exactly this
// arithmetic per line — existing user-cart quantity + incoming guest-cart
// quantity, capped at current stock — so these pure assertions verify the
// same rule the SQL enforces, without needing a live DB in this sandbox.
{
  assert(mergeQuantities(2, 1, null) === 3, "15/16. merging a guest line into a matching user-cart line must sum quantities (2 + 1 = 3)");
  assert(mergeQuantities(4, 4, 5) === 5, "17. a merge that would exceed current stock (4 existing + 4 incoming, stock 5) must cap at 5, never overshoot");
  assert(mergeQuantities(0, 10, 3) === 3, "17. a guest line merging into an empty user cart must still respect the stock cap");
}

// --- 7. 품절 상품 추가 거부 / 9. 다른 product의 variant 사용 거부 (structural) ---
// Both are enforced inside cart_add_item itself (raises before any insert),
// verified here by inspecting the RPC body since there's no live DB in this
// sandbox to execute it against — see the STEP 20 report's own honesty note
// on what is/isn't live-verified.
{
  const migrationSourceForAdd = readFileSync(new URL("../supabase/migrations/20260906000100_step20_cart.sql", import.meta.url), "utf8");
  const addStart = migrationSourceForAdd.indexOf("function public.cart_add_item(");
  const addBody = migrationSourceForAdd.slice(addStart, addStart + 3000);
  assert(addBody.includes("raise exception 'out of stock'"), "7. cart_add_item must reject adding a sold-out product/variant rather than silently inserting a 0-purchasable line");
  assert(
    addBody.includes("v_variant.product_id <> p_product_id") && addBody.includes("raise exception 'variant does not belong to product'"),
    "9. cart_add_item must reject a variant id that belongs to a different product than the one requested"
  );
}

// --- 10. price snapshot vs current price 비교 / 11. 가격 변경 감지 -------------
{
  assert(hasPriceChanged(19900, 21900), "a real price increase must be detected");
  assert(!hasPriceChanged(19900, 19900), "an unchanged price must not be flagged");
  assert(!hasPriceChanged(19900, 19900.4), "sub-threshold float noise must not be flagged as a real change");
}

// --- enrichCartItem: option-less, price/stock/availability -------------------
{
  const product = baseProduct();
  const line = enrichCartItem(cartItem({ unitPriceSnapshot: 19900 }), [product], KR_MARKET);
  assert(line !== null, "a valid option-less cart item must enrich to a line");
  assert(line!.unitPrice === 19900, `unit price must resolve to the product's KRW sale price, got ${line!.unitPrice}`);
  assert(line!.isPurchasable, "an active, in-stock, option-less product must be purchasable");
  assert(!line!.priceChanged, "unchanged snapshot vs current price must not flag a price change");
}
{
  // 12. 판매불가 item 처리 — stock 0.
  const soldOutProduct = baseProduct({ stock: 0 });
  const line = enrichCartItem(cartItem(), [soldOutProduct], KR_MARKET);
  assert(line !== null && !line.isPurchasable, "an out-of-stock option-less product must be reported unpurchasable, not dropped or crashed on");
}
{
  // Price changed since add: snapshot 19900, current sale price now 21900.
  const product = baseProduct({ salePrice: 21900, originalPrice: 22000 });
  const line = enrichCartItem(cartItem({ unitPriceSnapshot: 19900 }), [product], KR_MARKET);
  assert(line !== null && line.priceChanged, "a raised sale price since add-to-cart must be flagged as changed");
  assert(line!.unitPrice === 21900, "the displayed price must always be the current price, never the stale snapshot");
}

// --- enrichCartItem: variant-aware -------------------------------------------
{
  const blackM = variant({ id: "bm", sku: "BLK-M", optionValues: { 색상: "블랙", 사이즈: "M" }, additionalPrice: 2000, stockQuantity: 3 });
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }, { name: "사이즈", choices: ["M"] }], variants: [blackM] });
  const line = enrichCartItem(cartItem({ variantId: "bm", unitPriceSnapshot: 21900 }), [product], KR_MARKET);
  assert(line !== null, "a variant cart item must enrich to a line");
  assert(line!.unitPrice === 21900, `base 19900 + additional 2000 must be 21900, got ${line!.unitPrice}`);
  assert(line!.optionLabel === "블랙 / M", `option label must be human-readable from the variant's own option values, got "${line!.optionLabel}"`);
  assert(line!.currentStock === 3, "current stock must come from the matched variant, not the parent product");
  assert(line!.isPurchasable, "an active in-stock variant line must be purchasable");
}
{
  // 8. 비활성 variant 거부 (line-level): a deactivated variant must never read as purchasable even with stock.
  const inactiveVariant = variant({ id: "iv", isActive: false, stockQuantity: 10 });
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }], variants: [inactiveVariant] });
  const line = enrichCartItem(cartItem({ variantId: "iv" }), [product], KR_MARKET);
  assert(line !== null && !line.isPurchasable, "a cart line pointing at a deactivated variant must be unpurchasable");
}
{
  // Legacy/anomaly: variant_id points at a variant no longer on the product (defensive — the STEP 20 migration makes this ON DELETE CASCADE, so it shouldn't happen, but must never crash if it does).
  const product = baseProduct({ options: [{ name: "색상", choices: ["블랙"] }], variants: [] });
  const line = enrichCartItem(cartItem({ variantId: "gone" }), [product], KR_MARKET);
  assert(line !== null && !line.isPurchasable, "a cart line whose variant no longer exists must degrade to unpurchasable, not throw");
}
{
  // A product removed from the catalog entirely (deleted/deactivated) — enrichCartItem must return null, not throw.
  const line = enrichCartItem(cartItem({ productId: "does-not-exist" }), [baseProduct()], KR_MARKET);
  assert(line === null, "a cart item whose product no longer exists in the fetched catalog must enrich to null");
}

// --- 13. cart subtotal 계산 ----------------------------------------------------
{
  const product = baseProduct({ salePrice: 10000, originalPrice: 10000 });
  const items: CartItem[] = [cartItem({ cartItemId: "a", quantity: 3, unitPriceSnapshot: 10000 })];
  const lines = enrichCartItems(items, [product], KR_MARKET);
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 30000, `3 x 10000 must total 30000, got ${totals.itemsTotal}`);
  assert(totals.selectedCount === 1, "one checked, purchasable line must count as 1 selected");
}
{
  // An unpurchasable (sold out) line must never contribute to the summary even if still checked.
  const soldOutProduct = baseProduct({ stock: 0 });
  const lines = enrichCartItems([cartItem({ quantity: 5, unitPriceSnapshot: 19900 })], [soldOutProduct], KR_MARKET);
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 0 && totals.selectedCount === 0, "a sold-out line must be excluded from the total even while checked=true");
}
{
  // An unchecked, otherwise-purchasable line must also not contribute.
  const lines = enrichCartItems([cartItem({ checked: false, quantity: 5 })], [baseProduct()], KR_MARKET);
  const totals = calculateCartSummary(lines);
  assert(totals.itemsTotal === 0, "an unchecked line must not contribute to the summary total");
}

// --- 14. cart quantity badge 계산 ----------------------------------------------
{
  assert(calculateCartBadgeQuantity([{ quantity: 2 }, { quantity: 3 }]) === 5, "badge must be the sum of quantities, not the row count (spec section 22's explicit A:2 + B:3 = 5 example)");
  assert(calculateCartBadgeQuantity([]) === 0, "an empty cart's badge must be 0");
}

// --- 18. shipping/fulfillment grouping helper ----------------------------------
{
  const domestic = baseProduct({ id: "d", dbId: "d", shippingType: "domestic" });
  const overseas = baseProduct({ id: "o", dbId: "o", shippingType: "overseas_direct" });
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", productId: "d" }), cartItem({ cartItemId: "2", productId: "o" })],
    [domestic, overseas],
    KR_MARKET
  );
  const groups = groupLinesByShippingType(lines);
  assert(groups.length === 2, `two distinct shipping types must produce two groups, got ${groups.length}`);
  assert(groups.find((g) => g.shippingType === "domestic")?.lines.length === 1, "the domestic group must contain exactly the domestic line");
  assert(groups.find((g) => g.shippingType === "overseas_direct")?.lines.length === 1, "the overseas_direct group must contain exactly the overseas line");
}

// --- 34. getPurchasableCartItems -----------------------------------------------
{
  const purchasable = baseProduct({ id: "ok", dbId: "ok" });
  const soldOut = baseProduct({ id: "bad", dbId: "bad", stock: 0 });
  const lines = enrichCartItems(
    [cartItem({ cartItemId: "1", productId: "ok" }), cartItem({ cartItemId: "2", productId: "bad" })],
    [purchasable, soldOut],
    KR_MARKET
  );
  const result = getPurchasableCartItems(lines);
  assert(result.length === 1 && result[0].cartItem.cartItemId === "1", "only the still-purchasable line must survive getPurchasableCartItems");
}

// --- 19. client supplied price를 신뢰하지 않는 구조 확인 (structural) -----------
{
  const actionSource = readFileSync(new URL("../lib/actions/cart.ts", import.meta.url), "utf8");
  assert(
    /addToCartAction\([\s\S]*?productId: string;\s*variantId: string \| null;\s*quantity: number;\s*\}/.test(actionSource),
    "addToCartAction's input type must be limited to productId/variantId/quantity — a widened input type is how a client-supplied price/stock could sneak back in"
  );
  assert(
    !/input\.(price|unitPrice|stock)/i.test(actionSource),
    "addToCartAction must never read a price/unitPrice/stock field off its own input — those aren't even in its input type, but this guards against the type ever being widened to include one"
  );
  const repoSource = readFileSync(new URL("../lib/repositories/cart.ts", import.meta.url), "utf8");
  assert(!/p_unit_price|p_price/.test(repoSource), "the repository must never pass a price parameter into any cart RPC — price is always resolved server-side inside the RPC itself");
}

// --- 20. unauthorized cart ownership guard (structural) -------------------------
{
  const migrationSource = readFileSync(
    new URL("../supabase/migrations/20260906000100_step20_cart.sql", import.meta.url),
    "utf8"
  );
  for (const fn of ["cart_set_quantity", "cart_remove_item"]) {
    const start = migrationSource.indexOf(`function public.${fn}(`);
    assert(start !== -1, `${fn} must exist in the STEP 20 migration`);
    const body = migrationSource.slice(start, start + 1500);
    assert(
      body.includes("coalesce(user_id, anonymous_token) = v_owner"),
      `${fn} must scope its target row to the caller's own resolved owner, not just an id the client supplied — otherwise any cart_item id would be readable/writable by anyone`
    );
  }
  assert(
    migrationSource.includes("create policy") === false,
    "cart_items/carts must have zero RLS policies (default-deny) — every access goes through the SECURITY DEFINER RPCs above, never a direct table policy"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("OK — cart identity, merge/stock-cap, price-change, subtotal/badge, fulfillment grouping, and ownership-guard checks passed.");
