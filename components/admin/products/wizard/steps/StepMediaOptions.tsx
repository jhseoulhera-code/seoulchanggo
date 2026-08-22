"use client";

import { ImageUploadManager } from "@/components/admin/products/wizard/ImageUploadManager";
import { WizardVariantManager } from "@/components/admin/products/wizard/WizardVariantManager";
import type { AdminOptionGroup, AdminProductDetail } from "@/types/admin";

type StepMediaOptionsProps = {
  detail: AdminProductDetail;
  onChange: (patch: Partial<AdminProductDetail>) => void;
  onSaveDraft: () => Promise<void>;
  saving: boolean;
};

export function StepMediaOptions({ detail, onChange, onSaveDraft, saving }: StepMediaOptionsProps) {
  function addOptionGroup() {
    onChange({ optionGroups: [...detail.optionGroups, { name: "", choices: [] }] });
  }
  function updateOptionGroup(index: number, patch: Partial<AdminOptionGroup>) {
    onChange({ optionGroups: detail.optionGroups.map((group, i) => (i === index ? { ...group, ...patch } : group)) });
  }
  function removeOptionGroup(index: number) {
    onChange({ optionGroups: detail.optionGroups.filter((_, i) => i !== index) });
  }

  return (
    <div className="flex flex-col gap-6">
      {!detail.id ? (
        <div className="flex flex-col items-start gap-2 border border-primary bg-primary-light/30 p-4">
          <p className="text-sm text-text-main">이미지 업로드와 옵션 조합(Variant) 관리는 임시저장 후 이용할 수 있습니다.</p>
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="bg-primary px-4 py-2 text-sm font-bold text-white disabled:bg-border"
          >
            {saving ? "저장 중..." : "임시저장하고 계속하기"}
          </button>
        </div>
      ) : (
        <ImageUploadManager productId={detail.id} images={detail.images} onImagesChange={(images) => onChange({ images })} />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-main">옵션 그룹 (색상/사이즈/용량 등 선택지)</h2>
          <button type="button" onClick={addOptionGroup} className="text-xs font-bold text-primary underline">
            + 옵션 그룹 추가
          </button>
        </div>
        {detail.optionGroups.length === 0 && <p className="text-xs text-text-secondary">옵션이 없는 상품입니다.</p>}
        {detail.optionGroups.map((group, index) => (
          <div key={index} className="flex flex-col gap-2 border border-border p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="옵션명 (예: 색상)"
                value={group.name}
                onChange={(e) => updateOptionGroup(index, { name: e.target.value })}
                className="flex-1 border border-border px-2 py-1.5 text-sm text-text-main outline-none"
              />
              <button type="button" onClick={() => removeOptionGroup(index)} className="text-xs text-red-600">
                삭제
              </button>
            </div>
            <input
              type="text"
              placeholder="선택지를 쉼표로 구분 (예: 화이트, 블랙)"
              value={group.choices.join(", ")}
              onChange={(e) => updateOptionGroup(index, { choices: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
              className="border border-border px-2 py-1.5 text-sm text-text-main outline-none"
            />
          </div>
        ))}
        <p className="text-xs text-text-secondary">
          위 옵션은 고객 화면 표시용 선택지입니다. 조합별 SKU/재고/추가금액은 아래 옵션 조합(Variant)에서 관리합니다.
        </p>
      </section>

      {detail.id && (
        <WizardVariantManager productId={detail.id} variants={detail.variants} onVariantsChange={(variants) => onChange({ variants })} />
      )}
    </div>
  );
}
