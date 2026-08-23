// Relative + extensioned imports within this subtree (rather than this
// app's usual @/ alias) are deliberate: it keeps every pure piece of the AI
// assistant (config/prompt/sanitize/checkMissingFields) plain-Node
// importable by scripts/test-ai-product-assistant.mts without a bundler —
// moduleResolution:"bundler" (tsconfig.json) allows extensioned relative TS
// imports, so this compiles identically to an @/ import either way.
import { checkMissingFields as sharedCheckMissingFields } from "../checkMissingFields.ts";
import { getOpenAiModel, OPENAI_MAX_OUTPUT_TOKENS, OPENAI_REQUEST_TIMEOUT_MS } from "../config.ts";
import { PRODUCT_ASSISTANT_SYSTEM_PROMPT, wrapUntrustedData } from "../prompt.ts";
import {
  matchCategory,
  sanitizeProductDraftResponse,
  sanitizeSeoResponse,
  sanitizeTranslateResponse,
} from "../sanitize.ts";
import type {
  AiProductAssistantAdapter,
  CheckMissingFieldsResult,
  GenerateSeoInput,
  GenerateSeoResult,
  MissingFieldCheckInput,
  ProductDraftInput,
  ProductDraftResult,
  ProductTranslateInput,
  ProductTranslateResult,
  SuggestCategoryInput,
  SuggestCategoryResult,
} from "@/lib/ai/productAssistant/types";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const GENERIC_ERROR_MESSAGE = "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도하거나 직접 입력해주세요.";

type OpenAiCallResult = { ok: true; data: unknown } | { ok: false; error: string };

/**
 * The one place every OpenAI Chat Completions call in this adapter goes
 * through — timeout, JSON-mode request, defensive parsing of whatever
 * comes back. Never throws: a network error, timeout, non-2xx response,
 * or unparseable body all become `{ ok: false }` so every adapter method
 * below can degrade to an honest "AI 생성 실패" result instead of a 500
 * that would take the whole product save flow down with it (STEP 17
 * section 1: "provider 오류가 나도 상품등록 전체가 깨지지 않도록").
 */
async function callOpenAiJson(userPrompt: string): Promise<OpenAiCallResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, error: "OPENAI_API_KEY가 설정되지 않았습니다." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getOpenAiModel(),
        temperature: 0.3,
        max_tokens: OPENAI_MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PRODUCT_ASSISTANT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Never echo the raw response body — it can include request details
      // in error messages; a generic, status-coded message is enough here.
      return { ok: false, error: `OpenAI API 오류 (status ${response.status})` };
    }

    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "OpenAI 응답에 내용이 없습니다." };

    const stripped = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      return { ok: true, data: JSON.parse(stripped) };
    } catch {
      return { ok: false, error: "OpenAI 응답을 JSON으로 해석하지 못했습니다." };
    }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return { ok: false, error: isAbort ? "OpenAI 응답 시간이 초과되었습니다." : "OpenAI 호출 중 오류가 발생했습니다." };
  } finally {
    clearTimeout(timeout);
  }
}

export const openAiProductAssistant: AiProductAssistantAdapter = {
  name: "OPENAI",

  async generateProductDraft(input: ProductDraftInput): Promise<ProductDraftResult> {
    const prompt = [
      "Produce a JSON object with exactly these keys: name_ko, name_en, short_description_ko, short_description_en,",
      "detail_description_ko, detail_description_en, feature_bullets_ko (array of short strings), feature_bullets_en (array of short strings),",
      "search_tags (array of short keyword strings), category_suggestion (a short category name or slug guess, or empty string if unsure),",
      "review_notes (a short note in Korean about anything the human should double check, or empty string).",
      "",
      `Product name: ${input.nameKo || "(not provided)"}`,
      input.nameEn ? `Existing English name: ${input.nameEn}` : "",
      input.brand ? `Brand: ${input.brand}` : "",
      input.categoryNameKo ? `Current category: ${input.categoryNameKo}` : "",
      input.descriptionKo ? `Existing Korean description: ${input.descriptionKo}` : "",
      input.supplierDescription ? wrapUntrustedData("SUPPLIER_DESCRIPTION", input.supplierDescription) : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callOpenAiJson(prompt);
    if (!result.ok) {
      return { provider: "OPENAI", isFallback: true, message: result.error || GENERIC_ERROR_MESSAGE, suggestions: [] };
    }

    const draft = sanitizeProductDraftResponse(result.data);
    const suggestions: ProductDraftResult["suggestions"] = [];
    if (draft.nameKo) suggestions.push({ field: "nameKo", value: draft.nameKo, confidence: "draft", note: "AI가 다듬은 상품명입니다." });
    if (draft.nameEn) suggestions.push({ field: "nameEn", value: draft.nameEn, confidence: "draft", note: "AI가 생성한 영문 상품명입니다." });
    if (draft.shortDescriptionKo) {
      suggestions.push({ field: "descriptionShortKo", value: draft.shortDescriptionKo, confidence: "draft" });
    }
    if (draft.shortDescriptionEn) {
      suggestions.push({ field: "descriptionShortEn", value: draft.shortDescriptionEn, confidence: "draft" });
    }
    if (draft.detailDescriptionKo) {
      const withBullets = draft.featureBulletsKo.length > 0
        ? `${draft.detailDescriptionKo}\n\n${draft.featureBulletsKo.map((b) => `- ${b}`).join("\n")}`
        : draft.detailDescriptionKo;
      suggestions.push({ field: "descriptionKo", value: withBullets, confidence: "needs_review", note: "AI 생성 초안 — 과장/허위 표현이 없는지 반드시 확인하세요." });
    }
    if (draft.detailDescriptionEn) {
      const withBullets = draft.featureBulletsEn.length > 0
        ? `${draft.detailDescriptionEn}\n\n${draft.featureBulletsEn.map((b) => `- ${b}`).join("\n")}`
        : draft.detailDescriptionEn;
      suggestions.push({ field: "descriptionEn", value: withBullets, confidence: "needs_review", note: "AI 생성 초안 — 과장/허위 표현이 없는지 반드시 확인하세요." });
    }
    for (const tag of draft.searchTags) {
      suggestions.push({ field: "searchTags", value: tag, confidence: "draft" });
    }

    const message = draft.reviewNotes
      ? `AI 초안 — 등록 전 확인 필요. ${draft.reviewNotes}`
      : "AI 초안 — 등록 전 확인 필요.";
    return { provider: "OPENAI", isFallback: false, message, suggestions };
  },

  async translateProductContent(input: ProductTranslateInput): Promise<ProductTranslateResult> {
    const text = input.text.trim();
    if (!text) return { provider: "OPENAI", isFallback: true, message: GENERIC_ERROR_MESSAGE, suggestion: null };

    const directionLabel = input.direction === "ko-to-en" ? "Korean to English" : "English to Korean";
    const prompt = [
      `Translate the following product-related text from ${directionLabel}.`,
      "Produce a JSON object with exactly one key: translated_text (string). Do not add anything not present in the source text.",
      "",
      wrapUntrustedData("SOURCE_TEXT", text),
    ].join("\n");

    const result = await callOpenAiJson(prompt);
    if (!result.ok) {
      return { provider: "OPENAI", isFallback: true, message: result.error || GENERIC_ERROR_MESSAGE, suggestion: null };
    }

    const translated = sanitizeTranslateResponse(result.data);
    if (!translated) {
      return { provider: "OPENAI", isFallback: true, message: "번역 결과가 비어 있습니다.", suggestion: null };
    }

    return {
      provider: "OPENAI",
      isFallback: false,
      message: "AI 초안 — 등록 전 확인 필요.",
      suggestion: {
        field: input.direction === "ko-to-en" ? "nameEn" : "nameKo",
        value: translated,
        confidence: "draft",
        note: "AI 번역 초안입니다. 전문 용어/브랜드명은 직접 확인하세요.",
      },
    };
  },

  async suggestCategory(input: SuggestCategoryInput): Promise<SuggestCategoryResult> {
    if (input.availableCategories.length === 0) {
      return { provider: "OPENAI", isFallback: true, message: "선택 가능한 카테고리가 없습니다.", suggestions: [] };
    }

    const categoryList = input.availableCategories.map((c) => c.nameKo).join(", ");
    const prompt = [
      "Suggest the single best-matching category for this product from the list below.",
      "Produce a JSON object with exactly one key: category_suggestion (a string copied EXACTLY from the list, or empty string if none fit).",
      "Never invent a category name that isn't in the list.",
      "",
      `Category list: ${categoryList}`,
      `Product name: ${input.nameKo || "(not provided)"}`,
      input.descriptionKo ? `Description: ${input.descriptionKo}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callOpenAiJson(prompt);
    if (!result.ok) {
      return { provider: "OPENAI", isFallback: true, message: result.error || GENERIC_ERROR_MESSAGE, suggestions: [] };
    }

    const raw = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
    const suggestionText = typeof raw.category_suggestion === "string" ? raw.category_suggestion : "";
    // The model may only ever propose a name/slug string — matching against
    // the real category list (never trusting a model-supplied id) happens
    // here, server-side, regardless of what the model claims.
    const matched = matchCategory(suggestionText, input.availableCategories);

    if (!matched) {
      return {
        provider: "OPENAI",
        isFallback: false,
        message: "AI가 제안한 카테고리가 실제 카테고리 목록과 일치하지 않아 추천을 표시하지 않습니다.",
        suggestions: [],
      };
    }

    return {
      provider: "OPENAI",
      isFallback: false,
      message: "AI 초안 — 등록 전 확인 필요.",
      suggestions: [
        {
          field: "categoryId",
          categoryId: matched.id,
          value: matched.nameKo,
          confidence: "recommended",
          note: "AI 제안을 실제 카테고리 목록과 대조해 확인된 항목입니다.",
        },
      ],
    };
  },

  async generateSeo(input: GenerateSeoInput): Promise<GenerateSeoResult> {
    const prompt = [
      "Produce a JSON object with exactly these keys: seo_title (max 60 chars), seo_description (max 160 chars),",
      "search_tags (array of short keyword strings).",
      "",
      `Product name: ${input.nameKo || "(not provided)"}`,
      input.brand ? `Brand: ${input.brand}` : "",
      input.categoryNameKo ? `Category: ${input.categoryNameKo}` : "",
      input.descriptionKo ? `Description: ${input.descriptionKo}` : "",
      input.supplierDescription ? wrapUntrustedData("SUPPLIER_DESCRIPTION", input.supplierDescription) : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await callOpenAiJson(prompt);
    if (!result.ok) {
      return { provider: "OPENAI", isFallback: true, message: result.error || GENERIC_ERROR_MESSAGE, seoTitle: null, seoDescription: null, tags: [] };
    }

    const seo = sanitizeSeoResponse(result.data);
    return {
      provider: "OPENAI",
      isFallback: false,
      message: "AI 초안 — 등록 전 확인 필요.",
      seoTitle: seo.seoTitle ? { field: "seoTitle", value: seo.seoTitle, confidence: "draft" } : null,
      seoDescription: seo.seoDescription ? { field: "seoDescription", value: seo.seoDescription, confidence: "draft" } : null,
      tags: seo.tags.map((tag) => ({ field: "searchTags", value: tag, confidence: "draft" as const })),
    };
  },

  async checkMissingFields(input: MissingFieldCheckInput): Promise<CheckMissingFieldsResult> {
    return sharedCheckMissingFields(input, "OPENAI");
  },
};
