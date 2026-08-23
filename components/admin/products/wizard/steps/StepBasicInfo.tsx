"use client";

import { FormField } from "@/components/common/FormField";
import { AiAssistantPanel } from "@/components/admin/products/wizard/AiAssistantPanel";
import type { AdminCategory, AdminProductDetail } from "@/types/admin";

type StepBasicInfoProps = {
  detail: AdminProductDetail;
  categories: AdminCategory[];
  onChange: (patch: Partial<AdminProductDetail>) => void;
};

const STATUS_OPTIONS: { value: AdminProductDetail["status"]; label: string }[] = [
  { value: "DRAFT", label: "임시저장 (DRAFT)" },
  { value: "ACTIVE", label: "판매중 (ACTIVE)" },
  { value: "INACTIVE", label: "판매중지 (INACTIVE)" },
];

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function StepBasicInfo({ detail, categories, onChange }: StepBasicInfoProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">기본정보</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            label="상품명 (한국어)"
            value={detail.nameKo}
            onChange={(v) => onChange({ nameKo: v, slug: detail.slug || slugify(v) })}
          />
          <FormField label="상품명 (영어)" value={detail.nameEn} onChange={(v) => onChange({ nameEn: v })} optionalTag="(선택)" />
          <FormField label="브랜드" value={detail.brand} onChange={(v) => onChange({ brand: v })} optionalTag="(선택)" />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">카테고리</span>
            <select
              value={detail.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value })}
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              <option value="">선택</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameKo}
                </option>
              ))}
            </select>
          </label>
          <FormField label="SKU" value={detail.sku} onChange={(v) => onChange({ sku: v })} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-text-secondary">판매 상태</span>
            <select
              value={detail.status}
              onChange={(e) => onChange({ status: e.target.value as AdminProductDetail["status"] })}
              className="border border-border px-3 py-2.5 text-sm text-text-main"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FormField
            label="짧은 설명 (한국어)"
            value={detail.shortDescriptionKo}
            onChange={(v) => onChange({ shortDescriptionKo: v })}
            optionalTag="(선택, 목록/카드에 노출)"
          />
          <FormField
            label="짧은 설명 (영어)"
            value={detail.shortDescriptionEn}
            onChange={(v) => onChange({ shortDescriptionEn: v })}
            optionalTag="(선택)"
          />
        </div>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-text-secondary">상세 설명 (한국어)</span>
          <textarea
            value={detail.descriptionKo}
            onChange={(e) => onChange({ descriptionKo: e.target.value })}
            rows={6}
            className="border border-border px-3 py-2.5 text-sm text-text-main outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-medium text-text-secondary">상세 설명 (영어) (선택)</span>
          <textarea
            value={detail.descriptionEn}
            onChange={(e) => onChange({ descriptionEn: e.target.value })}
            rows={6}
            className="border border-border px-3 py-2.5 text-sm text-text-main outline-none"
          />
        </label>

        <FormField
          label="검색 키워드 / 태그 (쉼표로 구분)"
          value={detail.searchTags.join(", ")}
          onChange={(v) => onChange({ searchTags: v.split(",").map((tag) => tag.trim()).filter(Boolean) })}
          optionalTag="(선택)"
        />
      </section>

      <AiAssistantPanel detail={detail} categories={categories} onPatch={onChange} />
    </div>
  );
}
