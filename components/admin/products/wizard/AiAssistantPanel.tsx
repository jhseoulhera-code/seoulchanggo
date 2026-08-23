"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import type {
  AiSuggestion,
  CheckMissingFieldsResult,
  GenerateSeoResult,
  ProductDraftResult,
  ProductTranslateResult,
  SuggestCategoryResult,
} from "@/lib/ai/productAssistant/types";
import type { AdminCategory, AdminProductDetail } from "@/types/admin";

type AiAssistantPanelProps = {
  detail: AdminProductDetail;
  categories: AdminCategory[];
  onPatch: (patch: Partial<AdminProductDetail>) => void;
};

const CONFIDENCE_LABEL: Record<AiSuggestion["confidence"], string> = {
  recommended: "추천",
  draft: "초안",
  needs_review: "확인 필요",
};

const CONFIDENCE_CLASS: Record<AiSuggestion["confidence"], string> = {
  recommended: "border-primary text-primary",
  draft: "border-amber-400 text-amber-700",
  needs_review: "border-red-400 text-red-600",
};

function SuggestionRow({ suggestion, onApply }: { suggestion: AiSuggestion; onApply: () => void }) {
  return (
    <div className="flex flex-col gap-1 border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`inline-flex w-fit border px-1.5 py-0.5 text-[10px] font-bold ${CONFIDENCE_CLASS[suggestion.confidence]}`}>
          {CONFIDENCE_LABEL[suggestion.confidence]}
        </span>
        <button type="button" onClick={onApply} className="shrink-0 bg-primary px-2.5 py-1 text-xs font-bold text-white">
          적용
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm text-text-main">{suggestion.value}</p>
      {suggestion.note && <p className="text-[11px] text-text-secondary">{suggestion.note}</p>}
    </div>
  );
}

const PROVIDER_LABEL: Record<string, string> = { MOCK: "Mock", OPENAI: "OpenAI" };

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 border border-border px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
      AI: {PROVIDER_LABEL[provider] ?? provider}
    </span>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await response.json()) as { ok: boolean; data?: T; error?: string };
    if (!response.ok || !json.ok) return { ok: false, error: json.error ?? "요청에 실패했습니다." };
    return { ok: true, data: json.data as T };
  } catch {
    return { ok: false, error: "AI 도우미 서버에 연결하지 못했습니다." };
  }
}

/**
 * STEP 16 spec section 3 — assistive only. Every suggestion needs an
 * explicit "적용" click before it touches wizard state; nothing here ever
 * writes to price/originalPrice/originCountry/stockQuantity/supplyType/
 * shippingType/customs/regulatory fields, because the AI layer
 * (lib/ai/productAssistant) has no suggestion type for any of them.
 */
export function AiAssistantPanel({ detail, categories, onPatch }: AiAssistantPanelProps) {
  const [supplierText, setSupplierText] = useState("");
  const [translateText, setTranslateText] = useState("");
  const [translateDirection, setTranslateDirection] = useState<"ko-to-en" | "en-to-ko">("ko-to-en");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draftResult, setDraftResult] = useState<ProductDraftResult | null>(null);
  const [categoryResult, setCategoryResult] = useState<SuggestCategoryResult | null>(null);
  const [seoResult, setSeoResult] = useState<GenerateSeoResult | null>(null);
  const [translateResult, setTranslateResult] = useState<ProductTranslateResult | null>(null);
  const [checkResult, setCheckResult] = useState<CheckMissingFieldsResult | null>(null);

  async function handleGenerateDraft() {
    setPending("draft");
    setError(null);
    const result = await postJson<{ draft: ProductDraftResult; category: SuggestCategoryResult | null }>(
      "/api/admin/ai/product-draft",
      {
        nameKo: detail.nameKo,
        nameEn: detail.nameEn,
        brand: detail.brand,
        descriptionKo: detail.descriptionKo,
        supplierDescription: supplierText,
        availableCategories: categories.map((c) => ({ id: c.id, nameKo: c.nameKo, slug: c.slug })),
      }
    );
    setPending(null);
    if (!result.ok) return setError(result.error);
    setDraftResult(result.data.draft);
    setCategoryResult(result.data.category);
  }

  async function handleGenerateSeo() {
    setPending("seo");
    setError(null);
    const result = await postJson<GenerateSeoResult>("/api/admin/ai/product-seo", {
      nameKo: detail.nameKo,
      brand: detail.brand,
      descriptionKo: detail.descriptionKo || detail.shortDescriptionKo,
      supplierDescription: supplierText,
    });
    setPending(null);
    if (!result.ok) return setError(result.error);
    setSeoResult(result.data);
  }

  async function handleTranslate() {
    if (!translateText.trim()) return;
    setPending("translate");
    setError(null);
    const result = await postJson<ProductTranslateResult>("/api/admin/ai/product-translate", {
      text: translateText,
      direction: translateDirection,
    });
    setPending(null);
    if (!result.ok) return setError(result.error);
    setTranslateResult(result.data);
  }

  async function handleCheck() {
    setPending("check");
    setError(null);
    const result = await postJson<CheckMissingFieldsResult>("/api/admin/ai/product-check", {
      nameKo: detail.nameKo,
      nameEn: detail.nameEn,
      descriptionKo: detail.descriptionKo,
      categoryId: detail.categoryId,
      hasAnyPrice: detail.prices.some((p) => p.salePrice > 0),
      hasPrimaryImage: detail.images.some((i) => i.isPrimary),
      stockType: detail.stockType,
      stockQuantity: detail.stockQuantity,
    });
    setPending(null);
    if (!result.ok) return setError(result.error);
    setCheckResult(result.data);
  }

  function applySuggestion(field: string, value: string) {
    switch (field) {
      case "nameKo":
        return onPatch({ nameKo: value });
      case "nameEn":
        return onPatch({ nameEn: value });
      case "descriptionKo":
        return onPatch({ descriptionKo: value });
      case "descriptionShortKo":
        return onPatch({ shortDescriptionKo: value });
      case "descriptionShortEn":
        return onPatch({ shortDescriptionEn: value });
      case "descriptionBulletsKo":
        return onPatch({ descriptionKo: value });
      case "descriptionEn":
        return onPatch({ descriptionEn: value });
      case "seoTitle":
        return onPatch({ seoTitle: value });
      case "seoDescription":
        return onPatch({ seoDescription: value });
      case "searchTags":
        return onPatch({ searchTags: [...new Set([...detail.searchTags, value])] });
      default:
        return;
    }
  }

  return (
    <aside className="flex flex-col gap-4 border border-primary/30 bg-primary-light/30 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-text-main">AI 상품등록 도우미</h2>
      </div>
      <p className="w-fit border border-amber-400 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
        AI 초안 — 등록 전 확인 필요
      </p>
      <p className="text-[11px] leading-relaxed text-text-secondary">
        AI는 초안만 제안합니다. 가격·원산지·재고·배송방식·통관정보·규제정보는 절대 자동으로 채우지 않으며, 모든 제안은 &ldquo;적용&rdquo;을 눌러야
        폼에 반영됩니다.
      </p>

      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        공급사 설명 붙여넣기 (선택)
        <textarea
          value={supplierText}
          onChange={(e) => setSupplierText(e.target.value)}
          rows={4}
          placeholder="공급사에서 받은 상품 설명을 붙여넣으면 초안 품질이 좋아집니다."
          className="border border-border px-2 py-1.5 text-sm text-text-main outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={pending !== null || !detail.nameKo.trim()}
          className="bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:bg-border"
        >
          {pending === "draft" ? "생성 중..." : draftResult ? "다시 생성 (상품명/설명/카테고리)" : "상품명/설명/카테고리 초안 생성"}
        </button>
        <button
          type="button"
          onClick={handleGenerateSeo}
          disabled={pending !== null || !detail.nameKo.trim()}
          className="border border-primary px-3 py-1.5 text-xs font-bold text-primary disabled:border-border disabled:text-text-secondary"
        >
          {pending === "seo" ? "생성 중..." : seoResult ? "다시 생성 (SEO/태그)" : "SEO/태그 생성"}
        </button>
        <button
          type="button"
          onClick={handleCheck}
          disabled={pending !== null}
          className="border border-border px-3 py-1.5 text-xs font-bold text-text-main disabled:text-text-secondary"
        >
          {pending === "check" ? "점검 중..." : "누락 항목 점검"}
        </button>
      </div>

      {pending && <p className="text-xs text-text-secondary">AI 생성 중입니다...</p>}
      {error && <p className="text-xs text-red-600">오류: {error}</p>}

      {draftResult && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ProviderBadge provider={draftResult.provider} />
            <p className="text-[11px] text-text-secondary">{draftResult.message}</p>
          </div>
          {draftResult.suggestions.length === 0 && (
            <p className="text-xs text-text-secondary">AI가 유효한 초안을 생성하지 못했습니다. 다시 시도하거나 직접 입력해주세요.</p>
          )}
          {draftResult.suggestions.map((s, i) => (
            <SuggestionRow key={`${s.field}-${i}`} suggestion={s} onApply={() => applySuggestion(s.field, s.value)} />
          ))}
        </div>
      )}

      {categoryResult && categoryResult.suggestions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ProviderBadge provider={categoryResult.provider} />
            <p className="text-xs font-bold text-text-main">추천 카테고리</p>
          </div>
          {categoryResult.suggestions.map((s, i) => (
            <SuggestionRow key={`${s.categoryId}-${i}`} suggestion={s} onApply={() => onPatch({ categoryId: s.categoryId })} />
          ))}
        </div>
      )}

      {seoResult && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ProviderBadge provider={seoResult.provider} />
            <p className="text-[11px] text-text-secondary">{seoResult.message}</p>
          </div>
          {seoResult.seoTitle && <SuggestionRow suggestion={seoResult.seoTitle} onApply={() => applySuggestion("seoTitle", seoResult.seoTitle!.value)} />}
          {seoResult.seoDescription && (
            <SuggestionRow suggestion={seoResult.seoDescription} onApply={() => applySuggestion("seoDescription", seoResult.seoDescription!.value)} />
          )}
          {seoResult.tags.map((tag, i) => (
            <SuggestionRow key={`${tag.value}-${i}`} suggestion={tag} onApply={() => applySuggestion("searchTags", tag.value)} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-primary/30 pt-3">
        <p className="text-xs font-bold text-text-main">한국어 ↔ 영어 번역 (초안)</p>
        <div className="flex gap-2">
          <select
            value={translateDirection}
            onChange={(e) => setTranslateDirection(e.target.value as "ko-to-en" | "en-to-ko")}
            className="border border-border px-2 py-1.5 text-xs text-text-main"
          >
            <option value="ko-to-en">한국어 → 영어</option>
            <option value="en-to-ko">영어 → 한국어</option>
          </select>
          <input
            value={translateText}
            onChange={(e) => setTranslateText(e.target.value)}
            placeholder="번역할 텍스트"
            className="flex-1 border border-border px-2 py-1.5 text-xs text-text-main outline-none"
          />
          <button
            type="button"
            onClick={handleTranslate}
            disabled={pending !== null}
            className="bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:bg-border"
          >
            번역
          </button>
        </div>
        {translateResult?.suggestion && (
          <div className="flex flex-col gap-1.5">
            <ProviderBadge provider={translateResult.provider} />
            <SuggestionRow
              suggestion={translateResult.suggestion}
              onApply={() => applySuggestion(translateResult.suggestion!.field, translateResult.suggestion!.value)}
            />
          </div>
        )}
        {translateResult && !translateResult.suggestion && <p className="text-xs text-text-secondary">{translateResult.message}</p>}
      </div>

      {checkResult && (
        <div className="flex flex-col gap-1.5 border-t border-primary/30 pt-3">
          <div className="flex items-center gap-2">
            <ProviderBadge provider={checkResult.provider} />
            <p className="text-xs font-bold text-text-main">누락 항목 점검 결과</p>
          </div>
          {(() => {
            const realFindings = checkResult.findings.filter((f) => f.field !== "manual_review_required");
            const manualNote = checkResult.findings.find((f) => f.field === "manual_review_required");
            return (
              <>
                {realFindings.length === 0 ? (
                  <p className="text-xs text-primary">필수 항목 누락 없음.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {realFindings.map((finding) => (
                      <li key={finding.field} className="text-xs text-red-600">
                        · {finding.message}
                      </li>
                    ))}
                  </ul>
                )}
                {manualNote && <p className="text-[11px] text-text-secondary">{manualNote.message}</p>}
              </>
            );
          })()}
        </div>
      )}
    </aside>
  );
}
