import { checkMissingFields as sharedCheckMissingFields } from "../checkMissingFields.ts";
import type {
  AiProductAssistantAdapter,
  AiSuggestion,
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

const FALLBACK_MESSAGE = "AI provider가 아직 연결되지 않아 규칙 기반 초안을 보여드립니다. 반드시 검토 후 적용하세요.";

function firstSentence(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentenceEnd = cleaned.search(/[.!?\n]/);
  const candidate = sentenceEnd > 0 ? cleaned.slice(0, sentenceEnd) : cleaned;
  return candidate.length > maxLength ? `${candidate.slice(0, maxLength - 1)}…` : candidate;
}

function extractBullets(text: string): string[] {
  return text
    .split(/[\n,•·]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 2)
    .slice(0, 5);
}

/**
 * Deterministic, rule-based drafts only — no network call, no real
 * language model. Every suggestion is explicitly "draft"/"needs_review",
 * never "recommended" for anything generated from scratch (recommended is
 * reserved for close-to-mechanical matches, e.g. an exact category
 * keyword hit) — the Wizard still requires an explicit "적용" click either
 * way, this only affects the badge shown.
 */
export const mockAiProductAssistant: AiProductAssistantAdapter = {
  name: "MOCK",

  async generateProductDraft(input: ProductDraftInput): Promise<ProductDraftResult> {
    const suggestions: AiSuggestion[] = [];
    const source = input.supplierDescription?.trim() ?? "";

    const trimmedName = input.nameKo.replace(/\s+/g, " ").trim();
    if (trimmedName && trimmedName !== input.nameKo) {
      suggestions.push({ field: "nameKo", value: trimmedName, confidence: "draft", note: "중복 공백을 정리했습니다." });
    }

    if (source) {
      const short = firstSentence(source, 80);
      if (short) {
        suggestions.push({
          field: "descriptionShortKo",
          value: short,
          confidence: "draft",
          note: "공급사 설명의 첫 문장에서 추출했습니다.",
        });
      }

      const bullets = extractBullets(source);
      if (bullets.length > 0) {
        suggestions.push({
          field: "descriptionBulletsKo",
          value: bullets.map((b) => `- ${b}`).join("\n"),
          confidence: "draft",
          note: "공급사 설명을 항목별로 나눴습니다. 사실 확인이 필요합니다.",
        });
      }

      suggestions.push({
        field: "descriptionKo",
        value: source.replace(/\s+/g, " ").trim(),
        confidence: "needs_review",
        note: "공급사 설명을 그대로 다듬은 초안입니다 — 과장/허위 표현이 없는지 반드시 확인하세요.",
      });
    } else {
      suggestions.push({
        field: "descriptionKo",
        value: `${trimmedName || input.nameKo}의 상세 설명을 입력해주세요.`,
        confidence: "needs_review",
        note: "공급사 설명이 없어 빈 템플릿만 제공합니다.",
      });
    }

    suggestions.push({
      field: "nameEn",
      value: input.nameEn?.trim() || input.nameKo,
      confidence: "needs_review",
      note: "실제 영문명 생성/번역에는 AI Provider 연결이 필요합니다 — 지금은 원문을 그대로 반환합니다.",
    });

    return { provider: "MOCK", isFallback: true, message: FALLBACK_MESSAGE, suggestions };
  },

  async translateProductContent(input: ProductTranslateInput): Promise<ProductTranslateResult> {
    const text = input.text.trim();
    if (!text) {
      return { provider: "MOCK", isFallback: true, message: FALLBACK_MESSAGE, suggestion: null };
    }
    return {
      provider: "MOCK",
      isFallback: true,
      message: FALLBACK_MESSAGE,
      suggestion: {
        field: input.direction === "ko-to-en" ? "nameEn" : "nameKo",
        value: text,
        confidence: "needs_review",
        note: "실제 번역이 아닙니다 — AI Provider 연결 전까지는 원문이 그대로 반환됩니다.",
      },
    };
  },

  async suggestCategory(input: SuggestCategoryInput): Promise<SuggestCategoryResult> {
    const haystack = `${input.nameKo} ${input.descriptionKo ?? ""} ${input.brand ?? ""}`.toLowerCase();
    const matches = input.availableCategories.filter((category) => haystack.includes(category.nameKo.toLowerCase()));

    return {
      provider: "MOCK",
      isFallback: true,
      message: matches.length > 0 ? FALLBACK_MESSAGE : "상품명/설명에서 일치하는 카테고리 키워드를 찾지 못했습니다.",
      suggestions: matches.slice(0, 3).map((category) => ({
        field: "categoryId",
        categoryId: category.id,
        value: category.nameKo,
        confidence: "recommended" as const,
        note: `상품명/설명에 "${category.nameKo}"가 포함되어 있습니다.`,
      })),
    };
  },

  async generateSeo(input: GenerateSeoInput): Promise<GenerateSeoResult> {
    const name = input.nameKo.trim();
    const seoTitleValue = `${name} | 서울창고`.slice(0, 60);
    const seoDescriptionValue = firstSentence(input.descriptionKo || input.supplierDescription || name, 120);

    const tagCandidates = new Set(
      [...name.split(/\s+/), input.brand ?? "", input.categoryNameKo ?? ""]
        .map((tag) => tag.trim())
        .filter((tag) => tag.length >= 2)
    );

    return {
      provider: "MOCK",
      isFallback: true,
      message: FALLBACK_MESSAGE,
      seoTitle: { field: "seoTitle", value: seoTitleValue, confidence: "draft", note: "상품명 기반 기본 형식입니다." },
      seoDescription: seoDescriptionValue
        ? { field: "seoDescription", value: seoDescriptionValue, confidence: "draft" }
        : null,
      tags: [...tagCandidates].slice(0, 8).map((tag) => ({ field: "searchTags", value: tag, confidence: "draft" as const })),
    };
  },

  async checkMissingFields(input: MissingFieldCheckInput): Promise<CheckMissingFieldsResult> {
    return sharedCheckMissingFields(input, "MOCK");
  },
};
