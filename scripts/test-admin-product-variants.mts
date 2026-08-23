/**
 * STEP 18 spec section 25 — framework-free test script (same convention as
 * scripts/check-i18n.mts / scripts/test-admin-product-wizard.mts), covering
 * the pure option/variant/image logic added for this step: Cartesian
 * combination generation, the stable combination key used to preserve
 * SKU/price/stock across regeneration, SKU duplicate/price/stock
 * validation, image primary-image validation, backward compatibility with
 * pre-STEP-18 data, and (spec item 10) a structural check that this step
 * never widened what the STEP 17 AI Product Assistant is allowed to output.
 *
 * Run with: node --experimental-strip-types scripts/test-admin-product-variants.mts
 */
import { readFileSync } from "node:fs";
import {
  buildCombinationKey,
  generateCombinations,
  hasDuplicateSkus,
  isVariantSoldOut,
  reconcileVariants,
  reconstructOptionGroupsFromVariants,
  suggestSkuForCombination,
  MAX_GENERATED_VARIANTS,
} from "../lib/admin/productOptions.ts";
import { validateProductImageFile, PRODUCT_IMAGE_MAX_COUNT, PRODUCT_IMAGE_MAX_SIZE_BYTES } from "../lib/admin/productImages.ts";
import {
  hasMultiplePrimaryImages,
  hasNoPrimaryImage,
  normalizeImageSortOrder,
  validateProductForRegistration,
} from "../components/admin/products/wizard/validation.ts";
import type { AdminProductDetail, AdminProductVariant } from "../types/admin";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

function baseDetail(): AdminProductDetail {
  return {
    id: "product-1",
    sku: "SKU-1",
    categoryId: "cat-1",
    slug: "test",
    brand: "",
    nameKo: "테스트 상품",
    nameEn: "",
    descriptionKo: "",
    descriptionEn: "",
    originCountry: "",
    supplyType: "DOMESTIC_STOCK",
    shippingType: "DOMESTIC",
    defaultShippingMethod: null,
    stockType: "TRACKED",
    stockQuantity: 5,
    optionGroups: [],
    isActive: true,
    status: "DRAFT",
    freeShipping: false,
    discountRate: null,
    shortDescriptionKo: "",
    shortDescriptionEn: "",
    seoTitle: "",
    seoDescription: "",
    searchTags: [],
    prices: [{ marketCode: "KR", currencyCode: "KRW", originalPrice: 10000, salePrice: 9000 }],
    shippingMarkets: [],
    variants: [],
    images: [],
  };
}

function variant(overrides: Partial<AdminProductVariant> = {}): AdminProductVariant {
  return { id: "v1", sku: "SKU-1-A", optionValues: { 색상: "블랙" }, additionalPrice: 0, stockQuantity: 5, isActive: true, ...overrides };
}

// --- 1. 옵션 없음 상품 normalization ----------------------------------------
{
  const issues = validateProductForRegistration(baseDetail());
  assert(issues.length === 0, `an option-less product with valid sku/price/stock should have no issues, got: ${JSON.stringify(issues)}`);
  const empty = generateCombinations([]);
  assert(empty.ok && empty.combinations.length === 0, "no option groups must generate zero combinations, not throw");
  assert(reconstructOptionGroupsFromVariants([]).length === 0, "reconstructing groups from zero variants must yield zero groups");
}

// --- 2/3. 옵션 조합 생성 + Cartesian product ---------------------------------
{
  const result = generateCombinations([
    { name: "색상", choices: ["블랙", "화이트"] },
    { name: "사이즈", choices: ["S", "M", "L"] },
  ]);
  assert(result.ok, "a normal 2-group generation must succeed");
  if (result.ok) {
    assert(result.combinations.length === 6, `2 x 3 must produce 6 combinations, got ${result.combinations.length}`);
    assert(
      result.combinations.some((c) => c["색상"] === "블랙" && c["사이즈"] === "M"),
      "블랙/M combination must be present"
    );
  }
}
{
  // A 3rd group (spec section 8's "최소 지원 그룹 수: 3개") must work exactly like 2 groups do, not need special-casing.
  const result = generateCombinations([
    { name: "색상", choices: ["블랙", "화이트"] },
    { name: "사이즈", choices: ["S", "M"] },
    { name: "용량", choices: ["250ml", "500ml"] },
  ]);
  assert(result.ok && result.combinations.length === 8, `3-group Cartesian product must be 2x2x2=8, got ${result.ok ? result.combinations.length : result.error}`);
}
{
  // Safety cap — an absurd combination count must be rejected, not silently generated.
  const groups = Array.from({ length: 5 }, (_, i) => ({ name: `g${i}`, choices: ["a", "b", "c", "d", "e", "f"] }));
  const result = generateCombinations(groups);
  assert(!result.ok, `6^5 combinations must exceed the ${MAX_GENERATED_VARIANTS} cap and be rejected`);
}

// --- 4. stable combination key ----------------------------------------------
{
  const a = buildCombinationKey({ 색상: "블랙", 사이즈: "S" });
  const b = buildCombinationKey({ 사이즈: "S", 색상: "블랙" });
  assert(a === b, `key must be independent of object key order: "${a}" vs "${b}"`);
}
{
  // Regenerating combinations after only reordering groups (not renaming/removing values) must preserve the existing variant's id/sku/price/stock.
  const existing = [variant({ id: "kept-1", sku: "CUSTOM-SKU", optionValues: { 색상: "블랙", 사이즈: "S" }, additionalPrice: 1000, stockQuantity: 7 })];
  const combos = generateCombinations([
    { name: "사이즈", choices: ["S"] },
    { name: "색상", choices: ["블랙"] },
  ]);
  assert(combos.ok, "regeneration input must be valid");
  if (combos.ok) {
    const reconciled = reconcileVariants(existing, combos.combinations, "SKU-1");
    assert(reconciled.length === 1, "one combination in, one variant out");
    assert(reconciled[0].id === "kept-1" && reconciled[0].sku === "CUSTOM-SKU" && reconciled[0].additionalPrice === 1000 && reconciled[0].stockQuantity === 7, "existing SKU/price/stock must survive regeneration when option VALUES are unchanged");
  }
}
{
  // A genuinely new combination gets a fresh (unsaved) id and an auto-generated sku, never reusing another combination's row.
  const existing = [variant({ id: "kept-1", optionValues: { 색상: "블랙" }, sku: "SKU-1-BLACK" })];
  const combos = generateCombinations([{ name: "색상", choices: ["블랙", "화이트"] }]);
  assert(combos.ok);
  if (combos.ok) {
    const reconciled = reconcileVariants(existing, combos.combinations, "SKU-1");
    const white = reconciled.find((v) => v.optionValues["색상"] === "화이트");
    assert(Boolean(white) && white!.id === "" && white!.sku !== "SKU-1-BLACK", "a new combination must not inherit another row's id or sku");
  }
}

// --- 5. SKU 중복 검증 --------------------------------------------------------
{
  assert(hasDuplicateSkus([{ sku: "A" }, { sku: "A" }]), "identical SKUs must be flagged as duplicates");
  assert(!hasDuplicateSkus([{ sku: "A" }, { sku: "B" }]), "distinct SKUs must not be flagged");
  assert(!hasDuplicateSkus([{ sku: "" }, { sku: "" }]), "blank SKUs are a separate 'missing SKU' concern, not counted as duplicates of each other");
}
{
  const used = new Set(["SKU-1-BLACK"]);
  const suggested = suggestSkuForCombination("SKU-1", { 색상: "블랙" }, used);
  assert(suggested !== "SKU-1-BLACK", `a colliding suggestion must be disambiguated, got ${suggested}`);
}

// --- 6/7. price/stock validation via validateProductForRegistration --------
{
  const withOptions = { ...baseDetail(), optionGroups: [{ name: "색상", choices: ["블랙"] }], variants: [variant({ additionalPrice: -100000 })] };
  const issues = validateProductForRegistration(withOptions);
  assert(issues.some((i) => i.field === "variants" && i.message.includes("판매가")), "a variant whose absolute price (base + additionalPrice) goes negative must be flagged");
}
{
  const withOptions = { ...baseDetail(), optionGroups: [{ name: "색상", choices: ["블랙"] }], variants: [variant({ stockQuantity: -1 })] };
  const issues = validateProductForRegistration(withOptions);
  assert(issues.some((i) => i.field === "variants" && i.message.includes("재고")), "negative variant stock must be flagged");
}
{
  const withOptions = { ...baseDetail(), optionGroups: [{ name: "색상", choices: ["블랙"] }], variants: [] };
  const issues = validateProductForRegistration(withOptions);
  assert(issues.some((i) => i.field === "variants"), "옵션 있음 with zero generated variants must be blocked");
}
{
  const withOptions = {
    ...baseDetail(),
    optionGroups: [{ name: "색상", choices: ["블랙"] }],
    variants: [variant({ id: "v1", sku: "DUP" }), variant({ id: "v2", sku: "DUP" })],
  };
  const issues = validateProductForRegistration(withOptions);
  assert(issues.some((i) => i.field === "variants" && i.message.includes("SKU")), "duplicate variant SKUs must block registration");
}
{
  assert(isVariantSoldOut(0), "stock 0 must be sold out");
  assert(!isVariantSoldOut(1), "stock 1 must not be sold out");
}

// --- 8. image primary validation --------------------------------------------
{
  assert(hasNoPrimaryImage(baseDetail()), "zero images must report no primary");
  const oneImage = { ...baseDetail(), images: [{ id: "1", imageUrl: "x", altKo: null, sortOrder: 0, isPrimary: true }] };
  assert(!hasNoPrimaryImage(oneImage), "a single primary image must satisfy the check");
  const twoPrimary = {
    ...baseDetail(),
    images: [
      { id: "1", imageUrl: "x", altKo: null, sortOrder: 0, isPrimary: true },
      { id: "2", imageUrl: "y", altKo: null, sortOrder: 1, isPrimary: true },
    ],
  };
  assert(hasMultiplePrimaryImages(twoPrimary), "two images both marked primary must be flagged");
  assert(!hasMultiplePrimaryImages(oneImage), "exactly one primary image must not be flagged");
}
{
  const reordered = normalizeImageSortOrder([
    { id: "a", sortOrder: 9 },
    { id: "b", sortOrder: 2 },
  ]);
  assert(reordered[0].sortOrder === 0 && reordered[1].sortOrder === 1, "normalizeImageSortOrder must collapse to a gap-free 0..n-1 sequence in list order");
}
{
  const okType = validateProductImageFile({ type: "image/webp", size: 1024 });
  assert(okType.ok, "an allowed MIME type under the size limit must pass");
  const badType = validateProductImageFile({ type: "image/gif", size: 1024 });
  assert(!badType.ok, "a disallowed MIME type (gif) must be rejected");
  const tooBig = validateProductImageFile({ type: "image/png", size: PRODUCT_IMAGE_MAX_SIZE_BYTES + 1 });
  assert(!tooBig.ok, "a file over the size limit must be rejected");
  assert(PRODUCT_IMAGE_MAX_COUNT === 10, "spec section 6's example count limit (10) must match the constant used across client + server checks");
}

// --- 9. existing product data compatibility ---------------------------------
{
  // A pre-STEP-18 product: variants exist (hand-typed via the old
  // free-text WizardVariantManager) but option_groups was never populated.
  const legacyVariants = [variant({ id: "legacy-1", optionValues: { 색상: "블랙", 용량: "500ml" } })];
  const reconstructed = reconstructOptionGroupsFromVariants(legacyVariants);
  assert(reconstructed.length === 2, `legacy variants must backfill 2 groups (색상, 용량), got ${reconstructed.length}`);
  assert(reconstructed.every((g) => g.choices.length > 0), "every backfilled group must carry at least one choice");
}
{
  // A product with zero variants and zero images must still validate/normalize without throwing.
  const bare = baseDetail();
  assert(normalizeImageSortOrder(bare.images).length === 0, "normalizing an empty image list must not throw");
  assert(validateProductForRegistration(bare).length === 0, "a bare valid option-less product must still register cleanly");
}

// --- 10. AI sanitize allow-list must never have grown to include SKU/price/stock ---
{
  const sanitizeSource = readFileSync(new URL("../lib/ai/productAssistant/sanitize.ts", import.meta.url), "utf8");
  const dangerousTokens = ["sku", "price", "stock", "quantity", "origin_country", "shipping_method", "customs", "certification"];
  for (const token of dangerousTokens) {
    const allowedKeysBlock = sanitizeSource.slice(sanitizeSource.indexOf("DRAFT_ALLOWED_KEYS"), sanitizeSource.indexOf("FORBIDDEN_DRAFT_KEYS"));
    assert(!allowedKeysBlock.toLowerCase().includes(token), `DRAFT_ALLOWED_KEYS must still never mention "${token}" — STEP 18 must not have widened what the AI assistant can write`);
  }
  assert(sanitizeSource.includes('"sku"') === false, 'sanitize.ts must not read a "sku" key from any AI response');
  assert(sanitizeSource.includes("stock_quantity") && sanitizeSource.includes("FORBIDDEN_DRAFT_KEYS"), "stock_quantity must still be explicitly listed as forbidden");
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("OK — product option/variant generation, validation, image checks, and AI-sanitize-boundary checks passed.");
