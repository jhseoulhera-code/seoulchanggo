/**
 * STEP 16 spec section 8 ("가능하면 admin product create/edit 관련 최소 test
 * 추가") — this repo has no test framework installed (see package.json),
 * so this follows the exact same framework-free convention as
 * scripts/check-i18n.mts: plain assertions, non-zero exit on failure.
 * Covers the two riskiest pure-logic pieces added in this step — the
 * Step 5 registration gate and CSV bulk-import row validation — since
 * both run ahead of a real DB write and a bug here would either block a
 * legitimate product or (worse) silently let an invalid one through.
 *
 * Run with: node --experimental-strip-types scripts/test-admin-product-wizard.mts
 */
import { validateProductForRegistration, hasNoPrimaryImage } from "../components/admin/products/wizard/validation.ts";
import { parseCsv, validateCsvRows, buildCsvTemplate } from "../lib/admin/csvImport.ts";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

function baseDetail() {
  return {
    id: null,
    sku: "SKU-1",
    categoryId: "cat-1",
    slug: "test",
    brand: "",
    nameKo: "테스트 상품",
    nameEn: "",
    descriptionKo: "",
    descriptionEn: "",
    originCountry: "",
    supplyType: "DOMESTIC_STOCK" as const,
    shippingType: "DOMESTIC" as const,
    defaultShippingMethod: null,
    stockType: "TRACKED" as const,
    stockQuantity: 5,
    optionGroups: [],
    isActive: true,
    status: "DRAFT" as const,
    freeShipping: false,
    discountRate: null,
    shortDescriptionKo: "",
    seoTitle: "",
    seoDescription: "",
    searchTags: [],
    prices: [{ marketCode: "KR" as const, currencyCode: "KRW" as const, originalPrice: 10000, salePrice: 9000 }],
    shippingMarkets: [],
    variants: [],
    images: [],
  };
}

// --- validateProductForRegistration ---------------------------------------
{
  const issues = validateProductForRegistration(baseDetail());
  assert(issues.length === 0, `a fully valid draft should have no issues, got: ${JSON.stringify(issues)}`);
}
{
  const issues = validateProductForRegistration({ ...baseDetail(), nameKo: "" });
  assert(issues.some((i) => i.field === "nameKo"), "empty nameKo should be flagged");
}
{
  const issues = validateProductForRegistration({ ...baseDetail(), categoryId: "" });
  assert(issues.some((i) => i.field === "categoryId"), "empty categoryId should be flagged");
}
{
  const issues = validateProductForRegistration({ ...baseDetail(), prices: [] });
  assert(issues.some((i) => i.field === "prices"), "no prices at all should be flagged");
}
{
  const issues = validateProductForRegistration({
    ...baseDetail(),
    prices: [{ marketCode: "KR", currencyCode: "KRW", originalPrice: 1000, salePrice: 0 }],
  });
  assert(issues.some((i) => i.field === "prices"), "salePrice=0 on every price row should count as no price");
}
{
  const issues = validateProductForRegistration({ ...baseDetail(), stockType: "TRACKED", stockQuantity: 0 });
  assert(issues.some((i) => i.field === "stockQuantity"), "TRACKED with stockQuantity=0 must block registration");
}
{
  const issues = validateProductForRegistration({ ...baseDetail(), stockType: "UNLIMITED", stockQuantity: 0 });
  assert(!issues.some((i) => i.field === "stockQuantity"), "UNLIMITED with stockQuantity=0 must NOT be blocked");
}
{
  assert(hasNoPrimaryImage(baseDetail()), "a draft with zero images should report no primary image");
  const withImage = { ...baseDetail(), images: [{ id: "1", imageUrl: "x", altKo: null, sortOrder: 0, isPrimary: true }] };
  assert(!hasNoPrimaryImage(withImage), "a draft with a primary image should not report missing");
}

// --- CSV import: parseCsv --------------------------------------------------
{
  const rows = parseCsv('a,b,c\n1,"two, with comma",3\n');
  assert(rows.length === 2, `expected 2 rows, got ${rows.length}`);
  assert(rows[1][1] === "two, with comma", `quoted comma field not parsed correctly: ${JSON.stringify(rows[1])}`);
}
{
  const rows = parseCsv('a,"say ""hi""",c\n');
  assert(rows[0][1] === 'say "hi"', `escaped quote not parsed correctly: ${JSON.stringify(rows[0])}`);
}

// --- CSV import: buildCsvTemplate round-trips through validateCsvRows -----
{
  const [header, ...dataRows] = parseCsv(buildCsvTemplate());
  const categories = new Map([["kitchen", "cat-kitchen-id"]]);
  const validated = validateCsvRows(header, dataRows, categories);
  assert(validated.length === 1, `template should produce exactly 1 example row, got ${validated.length}`);
  assert(validated[0].errors.length === 0, `template's own example row should validate cleanly: ${validated[0].errors.join("; ")}`);
  assert(validated[0].parsed?.shipping.shippingType === "DOMESTIC", "DOMESTIC_PARCEL should resolve to shippingType DOMESTIC");
}

// --- CSV import: validateCsvRows catches real mistakes ---------------------
{
  const header = ["sku", "name_ko", "name_en", "category", "supply_type", "shipping_method", "price_krw", "price_inr", "price_usd", "stock_mode", "stock_quantity"];
  const categories = new Map([["kitchen", "cat-kitchen-id"]]);

  const missingSku = validateCsvRows(header, [["", "이름", "", "kitchen", "DOMESTIC_STOCK", "DOMESTIC_PARCEL", "1000", "", "", "UNLIMITED", "0"]], categories);
  assert(missingSku[0].errors.length > 0 && missingSku[0].parsed === null, "missing sku must fail validation");

  const badCategory = validateCsvRows(header, [["SKU-1", "이름", "", "does-not-exist", "DOMESTIC_STOCK", "DOMESTIC_PARCEL", "1000", "", "", "UNLIMITED", "0"]], categories);
  assert(badCategory[0].errors.some((e) => e.includes("카테고리")), "unknown category slug must fail validation");

  const noPrice = validateCsvRows(header, [["SKU-1", "이름", "", "kitchen", "DOMESTIC_STOCK", "DOMESTIC_PARCEL", "0", "0", "0", "UNLIMITED", "0"]], categories);
  assert(noPrice[0].errors.some((e) => e.includes("price")), "all-zero prices must fail validation");

  const trackedNoStock = validateCsvRows(header, [["SKU-1", "이름", "", "kitchen", "DOMESTIC_STOCK", "DOMESTIC_PARCEL", "1000", "", "", "TRACKED", "0"]], categories);
  assert(trackedNoStock[0].errors.some((e) => e.includes("stock_quantity")), "TRACKED with stock_quantity=0 must fail validation");

  const validRow = validateCsvRows(header, [["SKU-1", "이름", "Name", "kitchen", "OVERSEAS_DIRECT", "OVERSEAS_SEA", "0", "500", "0", "TRACKED", "10"]], categories);
  assert(validRow[0].errors.length === 0, `a genuinely valid row should pass: ${validRow[0].errors.join("; ")}`);
  assert(validRow[0].parsed?.shipping.defaultShippingMethod === "SEA", "OVERSEAS_SEA should resolve to defaultShippingMethod SEA");
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("OK — admin product wizard validation + CSV import validation checks passed.");
