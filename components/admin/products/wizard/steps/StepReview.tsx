"use client";

import { hasNoPrimaryImage, validateProductForRegistration } from "@/components/admin/products/wizard/validation";
import { formatCurrency } from "@/lib/currency";
import type { AdminCategory, AdminProductDetail } from "@/types/admin";

type StepReviewProps = {
  detail: AdminProductDetail;
  categories: AdminCategory[];
  mode: "create" | "edit";
  saving: boolean;
  message: { tone: "success" | "error"; text: string } | null;
  onSaveDraft: () => Promise<void>;
  onRegister: () => Promise<void>;
};

export function StepReview({ detail, categories, mode, saving, message, onSaveDraft, onRegister }: StepReviewProps) {
  const issues = validateProductForRegistration(detail);
  const noPrimaryImage = hasNoPrimaryImage(detail);
  const categoryName = categories.find((c) => c.id === detail.categoryId)?.nameKo ?? "미선택";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-bold text-text-main">검토/등록</h2>

      {issues.length > 0 && (
        <div className="flex flex-col gap-1 border border-red-400 bg-red-50 p-3">
          <p className="text-xs font-bold text-red-700">등록 전 아래 항목을 확인해주세요.</p>
          {issues.map((issue) => (
            <p key={issue.field} className="text-xs text-red-600">
              · {issue.message}
            </p>
          ))}
        </div>
      )}
      {noPrimaryImage && (
        <p className="border border-amber-400 bg-amber-50 p-2.5 text-xs text-amber-700">
          대표 이미지가 없습니다 — 등록은 가능하지만 고객 화면 노출 품질을 위해 권장합니다.
        </p>
      )}

      <div className="grid gap-3 border border-border p-4 text-sm md:grid-cols-2">
        <SummaryRow label="상품명" value={detail.nameKo || "-"} />
        <SummaryRow label="영문 상품명" value={detail.nameEn || "-"} />
        <SummaryRow label="SKU" value={detail.sku || "-"} />
        <SummaryRow label="카테고리" value={categoryName} />
        <SummaryRow label="판매 상태" value={detail.status} />
        <SummaryRow
          label="공급형태 / 배송방식"
          value={`${detail.supplyType} / ${detail.shippingType}`}
        />
        <SummaryRow
          label="가격"
          value={
            detail.prices
              .filter((p) => p.salePrice > 0)
              .map((p) => formatCurrency(p.salePrice, p.currencyCode))
              .join(", ") || "미설정"
          }
        />
        <SummaryRow
          label="재고"
          value={detail.stockType === "TRACKED" ? `${detail.stockQuantity}개 (TRACKED)` : "무제한 (UNLIMITED)"}
        />
        <SummaryRow label="이미지" value={`${detail.images.length}장${noPrimaryImage ? " (대표 이미지 없음)" : ""}`} />
        <SummaryRow label="옵션 조합" value={`${detail.variants.length}개`} />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="h-11 border border-primary px-5 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:border-border disabled:text-text-secondary"
        >
          임시저장
        </button>
        <button
          type="button"
          onClick={onRegister}
          disabled={saving || issues.length > 0}
          className="h-11 bg-primary px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
        >
          {saving ? "저장 중..." : mode === "edit" ? "수정 저장" : "상품 등록"}
        </button>
        {message && <span className={`text-sm ${message.tone === "success" ? "text-primary" : "text-red-600"}`}>{message.text}</span>}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="font-medium text-text-main">{value}</span>
    </div>
  );
}
