/**
 * STEP 17 spec section 10 test list. No test framework exists in this repo
 * (see package.json); follows the exact same framework-free convention as
 * check-i18n.mts / test-admin-product-wizard.mts.
 *
 * Run with: node --experimental-strip-types scripts/test-ai-product-assistant.mts
 *
 * What this can and can't actually verify, honestly:
 * - Provider selection/fallback logic, response sanitization, dangerous-key
 *   stripping, category matching, and input-length clamping are pure
 *   functions — genuinely exercised here with real inputs/outputs.
 * - "admin auth guard" and "customer AI route 접근 차단" are checked
 *   structurally (the route source actually calls requireAdminApi() before
 *   doing anything else) rather than by hitting a live server, since that
 *   needs a real Supabase session this script doesn't have. A structural
 *   regression here would still catch someone accidentally removing the
 *   guard call.
 */
import { readFileSync } from "node:fs";
import { resolveAiProductAssistant } from "../lib/ai/productAssistant/registry.ts";
import {
  matchCategory,
  sanitizeProductDraftResponse,
  sanitizeSupplierText,
  sanitizeText,
} from "../lib/ai/productAssistant/sanitize.ts";
import { MAX_SHORT_FIELD_LENGTH, MAX_SUPPLIER_TEXT_LENGTH } from "../lib/ai/productAssistant/config.ts";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const ENV_KEYS = ["AI_PRODUCT_PROVIDER", "OPENAI_API_KEY", "NODE_ENV"] as const;
function withEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  for (const key of ENV_KEYS) {
    const value = overrides[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

// --- provider selection / fallback -----------------------------------------
withEnv({ AI_PRODUCT_PROVIDER: undefined, OPENAI_API_KEY: undefined, NODE_ENV: "development" }, () => {
  const resolved = resolveAiProductAssistant();
  assert(resolved.adapter?.name === "MOCK", "no config at all must resolve to MOCK");
});

withEnv({ AI_PRODUCT_PROVIDER: undefined, OPENAI_API_KEY: "sk-test-key", NODE_ENV: "development" }, () => {
  const resolved = resolveAiProductAssistant();
  assert(resolved.adapter?.name === "OPENAI", "unset provider + a real-looking key present should auto-select OPENAI");
});

withEnv({ AI_PRODUCT_PROVIDER: "mock", OPENAI_API_KEY: "sk-test-key", NODE_ENV: "development" }, () => {
  const resolved = resolveAiProductAssistant();
  assert(resolved.adapter?.name === "MOCK", "explicit AI_PRODUCT_PROVIDER=mock must win even with a key present");
});

withEnv({ AI_PRODUCT_PROVIDER: "openai", OPENAI_API_KEY: undefined, NODE_ENV: "development" }, () => {
  const resolved = resolveAiProductAssistant();
  assert(resolved.adapter?.name === "MOCK", "openai requested but no key, in development, must fall back to MOCK");
  assert(Boolean(resolved.forcedFallbackReason), "a forced fallback must always carry a reason");
});

withEnv({ AI_PRODUCT_PROVIDER: "openai", OPENAI_API_KEY: undefined, NODE_ENV: "production" }, () => {
  const resolved = resolveAiProductAssistant();
  assert(resolved.adapter === null, "openai requested but no key, in production, must refuse rather than silently mock");
});

withEnv({ AI_PRODUCT_PROVIDER: "openai", OPENAI_API_KEY: "sk-test-key", NODE_ENV: "production" }, () => {
  const resolved = resolveAiProductAssistant();
  assert(resolved.adapter?.name === "OPENAI", "openai requested with a key present, in production, should resolve to OPENAI");
});

// --- structured response validation + dangerous-key stripping -------------
{
  const draft = sanitizeProductDraftResponse({
    name_ko: "테스트 상품",
    name_en: "Test Product",
    short_description_ko: "짧은 설명",
    search_tags: ["a", "b", "c"],
    category_suggestion: "주방용품",
    // A model hallucinating these must never leak into the sanitized shape.
    price: 999999,
    sale_price: 1,
    original_price: 100,
    origin_country: "CN",
    stock_quantity: 9999,
    supply_type: "OVERSEAS_AGENCY",
    shipping_method: "AIR",
    customs_info: { fake: true },
    certification: "FDA approved",
  });
  assert(draft.nameKo === "테스트 상품", "a valid name_ko must survive sanitization");
  assert(draft.searchTags.length === 3, "a valid search_tags array must survive sanitization");
  const draftKeys = Object.keys(draft);
  for (const dangerous of ["price", "originCountry", "stockQuantity", "supplyType", "shippingMethod", "customsInfo", "certification"]) {
    assert(!draftKeys.includes(dangerous), `sanitized draft must never carry a "${dangerous}" key`);
  }
  assert(JSON.stringify(draft).includes("999999") === false, "a forged price value must not appear anywhere in the sanitized output");
}
{
  const draftFromGarbage = sanitizeProductDraftResponse("not even an object");
  assert(draftFromGarbage.nameKo === "", "a non-object AI response must degrade to an all-empty draft, not throw");
}
{
  const draftWithHtml = sanitizeProductDraftResponse({ name_ko: "<script>alert(1)</script>정상 이름" });
  assert(!draftWithHtml.nameKo.includes("<script>"), "HTML/script tags must be stripped from AI text output");
}

// --- category matching: never trust a model-invented id --------------------
{
  const categories = [
    { id: "cat-1", nameKo: "주방용품", slug: "kitchen" },
    { id: "cat-2", nameKo: "가전디지털", slug: "digital" },
  ];
  const exact = matchCategory("주방용품", categories);
  assert(exact?.id === "cat-1", "an exact category name match must resolve");
  const bySlug = matchCategory("kitchen", categories);
  assert(bySlug?.id === "cat-1", "a slug match must resolve");
  const invalid = matchCategory("존재하지않는카테고리이름", categories);
  assert(invalid === null, "a category suggestion with no real match must be rejected (null), never guessed");
  const empty = matchCategory("", categories);
  assert(empty === null, "an empty suggestion must never match anything");
}

// --- long input limits ------------------------------------------------------
{
  const longText = "가".repeat(MAX_SHORT_FIELD_LENGTH + 500);
  const truncated = sanitizeText(longText);
  assert(truncated.length === MAX_SHORT_FIELD_LENGTH, `sanitizeText must clamp to ${MAX_SHORT_FIELD_LENGTH} chars, got ${truncated.length}`);
}
{
  const longSupplierText = "x".repeat(MAX_SUPPLIER_TEXT_LENGTH + 1000);
  const truncated = sanitizeSupplierText(longSupplierText);
  assert(truncated.length === MAX_SUPPLIER_TEXT_LENGTH, `sanitizeSupplierText must clamp to ${MAX_SUPPLIER_TEXT_LENGTH} chars, got ${truncated.length}`);
}

// --- admin auth guard present in every AI route (structural check) --------
{
  const routeFiles = [
    "app/api/admin/ai/product-draft/route.ts",
    "app/api/admin/ai/product-translate/route.ts",
    "app/api/admin/ai/product-seo/route.ts",
    "app/api/admin/ai/product-check/route.ts",
  ];
  for (const file of routeFiles) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf-8");
    const guardIndex = source.indexOf("requireAdminApi()");
    assert(guardIndex !== -1, `${file} must call requireAdminApi()`);
    const deniedCheckIndex = source.indexOf("guard.denied");
    assert(deniedCheckIndex !== -1 && deniedCheckIndex > guardIndex, `${file} must check guard.denied right after calling requireAdminApi()`);
    // The guard check must appear before the request body is even parsed —
    // a customer session must be rejected before any input is processed.
    const bodyParseIndex = source.indexOf("request.json()");
    assert(bodyParseIndex === -1 || guardIndex < bodyParseIndex, `${file} must check admin access before parsing the request body`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("OK — AI product assistant provider selection + sanitization + category matching + route guard checks passed.");
