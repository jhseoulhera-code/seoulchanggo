/**
 * Provider Adapter for the admin Product Wizard's "AI 상품등록 도우미" (STEP 16
 * spec section 3-4) — mirrors lib/imageSearch/types.ts and
 * lib/payments/types.ts exactly: one adapter interface, a name union that
 * already includes the real provider this will eventually become, and every
 * result honestly flags whether it came from a real model or the mock.
 *
 * Hard safety rule baked into every result shape below: nothing here ever
 * returns a final, ready-to-save value for price, original price, origin
 * country, stock quantity, supply type, shipping type/method, customs
 * info, or regulatory/certification status — those fields simply have no
 * corresponding suggestion type. The Wizard cannot wire an "적용" button to
 * something this module never produces.
 */

export type AiProviderName = "MOCK" | "FUTURE_LLM_PROVIDER";

/** How sure the suggestion is meant to be taken — the Wizard renders this as a badge, never auto-applies it. */
export type AiConfidence = "recommended" | "draft" | "needs_review";

export type AiSuggestion = {
  /** AdminProductDetail field this suggestion targets, e.g. "nameKo", "descriptionKo", "seoTitle". */
  field: string;
  value: string;
  confidence: AiConfidence;
  /** Short human-readable reason, e.g. "공급사 설명에서 핵심 특징을 추출했습니다." */
  note?: string;
};

export type AiProductContext = {
  nameKo: string;
  nameEn?: string;
  brand?: string;
  categoryNameKo?: string;
  descriptionKo?: string;
  /** Raw text pasted in from a supplier listing — the richest signal the mock/real provider has to work with. */
  supplierDescription?: string;
};

export type AiResultBase = {
  provider: AiProviderName;
  /** true whenever this did not come from a real language model — always true until FUTURE_LLM_PROVIDER exists. */
  isFallback: boolean;
  /** User-facing, honest explanation shown above the suggestions (e.g. "AI provider가 설정되지 않아 규칙 기반 초안을 보여드립니다."). */
  message: string;
};

export type ProductDraftInput = AiProductContext;
export type ProductDraftResult = AiResultBase & { suggestions: AiSuggestion[] };

export type TranslateDirection = "ko-to-en" | "en-to-ko";
export type ProductTranslateInput = { text: string; direction: TranslateDirection };
export type ProductTranslateResult = AiResultBase & { suggestion: AiSuggestion | null };

export type CategoryOption = { id: string; nameKo: string };
export type SuggestCategoryInput = AiProductContext & { availableCategories: CategoryOption[] };
export type SuggestCategoryResult = AiResultBase & { suggestions: (AiSuggestion & { categoryId: string })[] };

export type GenerateSeoInput = AiProductContext;
export type GenerateSeoResult = AiResultBase & {
  seoTitle: AiSuggestion | null;
  seoDescription: AiSuggestion | null;
  tags: AiSuggestion[];
};

export type MissingFieldCheckInput = {
  nameKo: string;
  nameEn: string;
  descriptionKo: string;
  categoryId: string;
  hasAnyPrice: boolean;
  hasPrimaryImage: boolean;
  stockType: "TRACKED" | "UNLIMITED";
  stockQuantity: number;
};
export type MissingFieldFinding = { field: string; message: string };
export type CheckMissingFieldsResult = AiResultBase & { findings: MissingFieldFinding[] };

export interface AiProductAssistantAdapter {
  readonly name: AiProviderName;
  generateProductDraft(input: ProductDraftInput): Promise<ProductDraftResult>;
  translateProductContent(input: ProductTranslateInput): Promise<ProductTranslateResult>;
  suggestCategory(input: SuggestCategoryInput): Promise<SuggestCategoryResult>;
  generateSeo(input: GenerateSeoInput): Promise<GenerateSeoResult>;
  checkMissingFields(input: MissingFieldCheckInput): Promise<CheckMissingFieldsResult>;
}
