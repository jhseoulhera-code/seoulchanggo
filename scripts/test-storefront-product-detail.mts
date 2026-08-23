/**
 * STEP 19 spec section 25 — framework-free test script (same convention as
 * scripts/check-i18n.mts and the other scripts/test-*.mts files) for the
 * pure option/variant selection logic behind the customer product detail
 * page: lib/storefront/productVariants.ts. Covers matching, availability,
 * price, stock, and the PurchaseSelection handoff STEP 20 will build on,
 * including the data-anomaly cases STEP 19 explicitly requires the page
 * to survive without crashing.
 *
 * Run with: node --experimental-strip-types scripts/test-storefront-product-detail.mts
 */
import {
  calculateVariantPrice,
  findMatchingVariant,
  getAvailableOptionValues,
  getEffectiveStock,
  getOptionValueStatus,
  isOptionCombinationAvailable,
  isProductSoldOut,
  normalizePurchaseSelection,
} from "../lib/storefront/productVariants.ts";
import type { ProductVariant } from "../types";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

function variant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return { id: "v1", sku: "SKU-1", optionValues: {}, additionalPrice: 0, stockQuantity: 5, isActive: true, ...overrides };
}

const blackS = variant({ id: "bs", sku: "BLK-S", optionValues: { 색상: "블랙", 사이즈: "S" }, stockQuantity: 3 });
const blackM = variant({ id: "bm", sku: "BLK-M", optionValues: { 색상: "블랙", 사이즈: "M" }, stockQuantity: 0 }); // sold out
const whiteM = variant({ id: "wm", sku: "WHT-M", optionValues: { 색상: "화이트", 사이즈: "M" }, stockQuantity: 5 });
const inactiveWhiteS = variant({ id: "ws-inactive", sku: "WHT-S", optionValues: { 색상: "화이트", 사이즈: "S" }, stockQuantity: 10, isActive: false });
const catalog = [blackS, blackM, whiteM, inactiveWhiteS];
const groupNames = ["색상", "사이즈"];

// --- 1/2. 옵션 없는 상품 판매가능/품절 판단 -----------------------------------
{
  assert(isProductSoldOut(false, [], 5) === false, "option-less product with stock > 0 must not be sold out");
  assert(isProductSoldOut(false, [], 0) === true, "option-less product with stock 0 must be sold out");
  assert(isProductSoldOut(false, [], -1) === true, "a negative stock (data glitch) must still read as sold out, never crash");
  // UNLIMITED stock_type products carry Product.stock === undefined (see mapProductRow), not 0 — must never read as sold out.
  assert(isProductSoldOut(false, [], undefined) === false, "an UNLIMITED stock_type product (stock === undefined) must never be sold out");
  assert(getEffectiveStock(false, null, undefined) === Number.POSITIVE_INFINITY, "an UNLIMITED stock_type product's effective stock must be uncapped");
}

// --- 3. variant matching -----------------------------------------------------
{
  const match = findMatchingVariant(catalog, { 색상: "블랙", 사이즈: "S" }, groupNames);
  assert(match?.id === "bs", `블랙/S must match the bs variant, got ${match?.id}`);
}

// --- 4. 존재하지 않는 조합 거부 ------------------------------------------------
{
  const match = findMatchingVariant(catalog, { 색상: "블랙", 사이즈: "L" }, groupNames);
  assert(match === null, "a combination with no corresponding variant (블랙/L) must not match anything");
  assert(getOptionValueStatus(catalog, "사이즈", "L", { 색상: "블랙" }) === "unavailable", "사이즈=L must be 'unavailable' given 색상=블랙 (no such variant exists)");
}

// --- 5. 품절 variant 거부 -----------------------------------------------------
{
  assert(isOptionCombinationAvailable(catalog, { 색상: "블랙", 사이즈: "M" }, groupNames) === false, "블랙/M exists but has 0 stock — must not be treated as available for purchase");
  assert(getOptionValueStatus(catalog, "사이즈", "M", { 색상: "블랙" }) === "soldOut", "사이즈=M under 색상=블랙 must resolve to 'soldOut', not hidden entirely");
  // section 11's explicit rule: one sold-out combination must not sell out the whole group.
  assert(getOptionValueStatus(catalog, "사이즈", "M", { 색상: "화이트" }) === "available", "사이즈=M under 색상=화이트 (in stock) must still be available even though 블랙/M is sold out");
}

// --- 6. 비활성 variant 거부 ----------------------------------------------------
{
  const match = findMatchingVariant(catalog, { 색상: "화이트", 사이즈: "S" }, groupNames);
  assert(match === null, "an inactive variant (화이트/S) must never be matched even though it technically exists with stock");
  assert(getOptionValueStatus(catalog, "사이즈", "S", { 색상: "화이트" }) === "unavailable", "an inactive variant must read as 'unavailable', not 'available' or 'soldOut'");
}

// --- 7. available option value 계산 -------------------------------------------
{
  const sizesForBlack = getAvailableOptionValues(catalog, { name: "사이즈", choices: ["S", "M", "L"] }, { 색상: "블랙" });
  assert(sizesForBlack.includes("S") && sizesForBlack.includes("M"), `S and M must both be selectable (existing, even if M is sold out) for 블랙, got ${JSON.stringify(sizesForBlack)}`);
  assert(!sizesForBlack.includes("L"), "L must be excluded entirely for 블랙 (never registered as a variant)");
}

// --- 8. base + additional price 계산 ------------------------------------------
{
  assert(calculateVariantPrice(19900, 2000) === 21900, "19900 + 2000 must be 21900");
  assert(calculateVariantPrice(19900, -50000) === 0, "a price that would go negative must clamp to 0, never a negative price");
  assert(calculateVariantPrice(19900, 0) === 19900, "a zero additional price must leave the base price unchanged");
}

// --- 9. 수량 <= 재고 검증 -------------------------------------------------------
{
  const overStock = normalizePurchaseSelection({ productId: "p1", productSku: "P1", quantity: 10, unitPrice: 1000, variant: blackS, maxStock: 3 });
  assert(overStock === null, "requesting more units than the matched variant's stock must be rejected");
  const withinStock = normalizePurchaseSelection({ productId: "p1", productSku: "P1", quantity: 2, unitPrice: 1000, variant: blackS, maxStock: 3 });
  assert(withinStock !== null, "a quantity within stock must be accepted");
  const zeroQty = normalizePurchaseSelection({ productId: "p1", productSku: "P1", quantity: 0, unitPrice: 1000, variant: null, maxStock: 5 });
  assert(zeroQty === null, "quantity 0 must never be accepted (min = 1)");
}

// --- 10. 옵션 상품 전체 품절 판단 ------------------------------------------------
{
  const allSoldOut = [variant({ id: "a", stockQuantity: 0 }), variant({ id: "b", stockQuantity: 0 })];
  assert(isProductSoldOut(true, allSoldOut, 999) === true, "every active variant at 0 stock must read as sold out regardless of the parent product's own stock_quantity");
  assert(isProductSoldOut(true, catalog, 0) === false, "at least one active variant with stock must NOT read as sold out even if the parent product's own stock_quantity is 0");
  assert(isProductSoldOut(true, [], 999) === true, "zero variants at all (e.g. option_groups set but nothing generated yet) must read as sold out, not purchasable");
}

// --- 11. PurchaseSelection normalization --------------------------------------
{
  const withVariant = normalizePurchaseSelection({ productId: "p1", productSku: "P1", quantity: 2, unitPrice: 21900, variant: blackS, maxStock: 3 });
  assert(withVariant?.variantId === "bs" && withVariant.sku === "BLK-S" && withVariant.quantity === 2 && withVariant.unitPrice === 21900, `variant selection must normalize sku/variantId/quantity/unitPrice correctly, got ${JSON.stringify(withVariant)}`);

  const optionLess = normalizePurchaseSelection({ productId: "p2", productSku: "P2-SKU", quantity: 1, unitPrice: 9900, variant: null, maxStock: 5 });
  assert(optionLess?.variantId === undefined && optionLess?.sku === "P2-SKU", `an option-less selection must carry the product's own sku and no variantId, got ${JSON.stringify(optionLess)}`);
}

// --- 12. 레거시/불완전 데이터 graceful handling ---------------------------------
{
  // A variant missing one of the two option group keys entirely (incomplete option_values).
  const incomplete = [variant({ id: "incomplete", optionValues: { 색상: "블랙" } })]; // no 사이즈 key at all
  const match = findMatchingVariant(incomplete, { 색상: "블랙", 사이즈: "S" }, groupNames);
  assert(match === null, "a variant missing a required option key must never match a full selection, not throw");
  assert(getOptionValueStatus(incomplete, "사이즈", "S", { 색상: "블랙" }) === "unavailable", "an incomplete variant must not make an unregistered size look available");

  // Zero variants at all — every helper must degrade gracefully, never throw.
  assert(findMatchingVariant([], { 색상: "블랙" }, ["색상"]) === null, "matching against an empty variant list must return null, not throw");
  assert(getAvailableOptionValues([], { name: "색상", choices: ["블랙", "화이트"] }, {}).length === 0, "no variants at all means no choice is available");
  assert(getEffectiveStock(true, null, 999) === 0, "an option-having product with no matched variant must report 0 effective stock regardless of the product's own stock_quantity");
  assert(getEffectiveStock(false, null, 7) === 7, "an option-less product's effective stock is just its own stock_quantity");

  // No option groups selected at all yet (customer hasn't picked anything).
  assert(findMatchingVariant(catalog, {}, groupNames) === null, "an empty selection must never accidentally match a variant");
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("OK — storefront variant matching, availability, pricing, stock, and PurchaseSelection checks passed.");
