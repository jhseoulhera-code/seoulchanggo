import {
  MAX_ARRAY_ITEMS,
  MAX_LONG_FIELD_LENGTH,
  MAX_SHORT_FIELD_LENGTH,
  MAX_SUPPLIER_TEXT_LENGTH,
} from "./config.ts";
import type { CategoryOption } from "@/lib/ai/productAssistant/types";

/**
 * STEP 17 spec section 3: "AI 응답을 절대 그대로 trust하지 말 것." Every
 * string/array the real OpenAI provider reads out of a parsed JSON response
 * goes through these before it's allowed anywhere near an AiSuggestion —
 * strips tags, clamps length, clamps array size. Pure, no network/DOM
 * dependency, so it's unit-testable with hand-crafted "what if the model
 * returned this" fixtures (scripts/test-ai-product-assistant.mts).
 */

/** Strips anything that looks like a tag (`<...>`) rather than trying to allow-list a safe HTML subset — this content is never rendered as HTML, only as plain text, so no tag should ever survive. */
export function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function sanitizeText(value: unknown, maxLength: number = MAX_SHORT_FIELD_LENGTH): string {
  if (typeof value !== "string") return "";
  const cleaned = stripTags(value);
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function sanitizeLongText(value: unknown): string {
  return sanitizeText(value, MAX_LONG_FIELD_LENGTH);
}

export function sanitizeSupplierText(value: unknown): string {
  return sanitizeText(value, MAX_SUPPLIER_TEXT_LENGTH);
}

export function sanitizeStringArray(value: unknown, maxItems: number = MAX_ARRAY_ITEMS, maxItemLength: number = MAX_SHORT_FIELD_LENGTH): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeText(item, maxItemLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

/**
 * Keys an AI JSON response is allowed to carry for the product-draft
 * feature. Anything else — including a model hallucinating a `price`,
 * `stock_quantity`, `origin_country`, `shipping_method`, `customs_info`,
 * or `certification` key — is silently dropped by construction: the
 * parser below only ever reads these named keys, nothing else, from the
 * parsed object. This list exists so that guarantee is explicit and
 * reviewable rather than merely "true because we didn't write code to
 * read anything else."
 */
export const DRAFT_ALLOWED_KEYS = [
  "name_ko",
  "name_en",
  "short_description_ko",
  "short_description_en",
  "detail_description_ko",
  "detail_description_en",
  "feature_bullets_ko",
  "feature_bullets_en",
  "search_tags",
  "category_suggestion",
  "review_notes",
] as const;

/** Field names that must NEVER be read from an AI response even if present — the fields this whole module is legally/financially not allowed to decide. */
export const FORBIDDEN_DRAFT_KEYS = [
  "price",
  "sale_price",
  "original_price",
  "salePrice",
  "originalPrice",
  "origin_country",
  "originCountry",
  "stock_quantity",
  "stockQuantity",
  "supply_type",
  "supplyType",
  "shipping_type",
  "shippingType",
  "shipping_method",
  "shippingMethod",
  "customs_info",
  "customsInfo",
  "certification",
  "regulatory",
] as const;

export type SanitizedProductDraft = {
  nameKo: string;
  nameEn: string;
  shortDescriptionKo: string;
  shortDescriptionEn: string;
  detailDescriptionKo: string;
  detailDescriptionEn: string;
  featureBulletsKo: string[];
  featureBulletsEn: string[];
  searchTags: string[];
  categorySuggestionText: string;
  reviewNotes: string;
};

/**
 * Parses+sanitizes a raw (untrusted, possibly malformed) JSON value from
 * the model into a fixed, fully-typed shape. Never throws — a response
 * that isn't even an object at all just becomes an all-empty draft, which
 * the caller reports as "AI가 유효한 응답을 생성하지 못했습니다" rather than
 * a 500.
 */
export function sanitizeProductDraftResponse(raw: unknown): SanitizedProductDraft {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    nameKo: sanitizeText(obj.name_ko),
    nameEn: sanitizeText(obj.name_en),
    shortDescriptionKo: sanitizeText(obj.short_description_ko, MAX_LONG_FIELD_LENGTH),
    shortDescriptionEn: sanitizeText(obj.short_description_en, MAX_LONG_FIELD_LENGTH),
    detailDescriptionKo: sanitizeLongText(obj.detail_description_ko),
    detailDescriptionEn: sanitizeLongText(obj.detail_description_en),
    featureBulletsKo: sanitizeStringArray(obj.feature_bullets_ko),
    featureBulletsEn: sanitizeStringArray(obj.feature_bullets_en),
    searchTags: sanitizeStringArray(obj.search_tags, MAX_ARRAY_ITEMS, 40),
    categorySuggestionText: sanitizeText(obj.category_suggestion),
    reviewNotes: sanitizeLongText(obj.review_notes),
  };
}

export type SanitizedSeoResponse = { seoTitle: string; seoDescription: string; tags: string[] };

export function sanitizeSeoResponse(raw: unknown): SanitizedSeoResponse {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    seoTitle: sanitizeText(obj.seo_title, 60),
    seoDescription: sanitizeText(obj.seo_description, 160),
    tags: sanitizeStringArray(obj.search_tags, MAX_ARRAY_ITEMS, 40),
  };
}

export function sanitizeTranslateResponse(raw: unknown): string {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return sanitizeLongText(obj.translated_text);
}

/**
 * STEP 17 spec section 7: the model may only ever propose a category by
 * slug or display name — it never sees or invents a categoryId. This
 * matches purely against the real category list the caller already has
 * (never a network call, never trusts an ID from the model), and returns
 * null on no match — the Wizard must not auto-apply anything in that case.
 */
export function matchCategory(suggestionText: string, availableCategories: CategoryOption[]): CategoryOption | null {
  const needle = suggestionText.trim().toLowerCase();
  if (!needle) return null;

  const bySlugOrExactName = availableCategories.find(
    (category) => category.nameKo.toLowerCase() === needle || category.slug?.toLowerCase() === needle
  );
  if (bySlugOrExactName) return bySlugOrExactName;

  const byPartialName = availableCategories.find(
    (category) => needle.includes(category.nameKo.toLowerCase()) || category.nameKo.toLowerCase().includes(needle)
  );
  return byPartialName ?? null;
}
