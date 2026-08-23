"use client";

import { ImageUploadManager } from "@/components/admin/products/wizard/ImageUploadManager";
import { ProductOptionEditor } from "@/components/admin/products/wizard/ProductOptionEditor";
import type { AdminProductDetail } from "@/types/admin";

type StepMediaOptionsProps = {
  detail: AdminProductDetail;
  onChange: (patch: Partial<AdminProductDetail>) => void;
  onSaveDraft: () => Promise<void>;
  saving: boolean;
};

export function StepMediaOptions({ detail, onChange, onSaveDraft, saving }: StepMediaOptionsProps) {
  const krwSalePrice = detail.prices.find((p) => p.currencyCode === "KRW")?.salePrice ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {!detail.id ? (
        <div className="flex flex-col items-start gap-2 border border-primary bg-primary-light/30 p-4">
          <p className="text-sm text-text-main">이미지 업로드와 옵션(색상/사이즈 등)·SKU·재고 관리는 임시저장 후 이용할 수 있습니다.</p>
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
        <>
          <ImageUploadManager productId={detail.id} images={detail.images} onImagesChange={(images) => onChange({ images })} />
          <ProductOptionEditor
            productId={detail.id}
            baseSku={detail.sku}
            krwSalePrice={krwSalePrice}
            optionGroups={detail.optionGroups}
            variants={detail.variants}
            onOptionGroupsChange={(optionGroups) => onChange({ optionGroups })}
            onVariantsChange={(variants) => onChange({ variants })}
          />
        </>
      )}
    </div>
  );
}
