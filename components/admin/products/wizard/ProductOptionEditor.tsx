"use client";

import { useState } from "react";
import { ProductVariantTable } from "@/components/admin/products/wizard/ProductVariantTable";
import { replaceVariantsAction } from "@/lib/actions/adminProducts";
import { generateCombinations, reconcileVariants, reconstructOptionGroupsFromVariants } from "@/lib/admin/productOptions";
import type { AdminOptionGroup, AdminProductVariant } from "@/types/admin";

type ProductOptionEditorProps = {
  productId: string;
  baseSku: string;
  krwSalePrice: number;
  optionGroups: AdminOptionGroup[];
  variants: AdminProductVariant[];
  onOptionGroupsChange: (groups: AdminOptionGroup[]) => void;
  onVariantsChange: (variants: AdminProductVariant[]) => void;
};

/**
 * STEP 18 spec sections 7-9 — the "옵션 없음/있음" toggle, option group/value
 * editor, and Cartesian-product combination generator. Split out of
 * StepMediaOptions.tsx (which used to inline a plain option-group list with
 * no connection to the separately hand-typed variant table) so each piece
 * stays a manageable size — see this step's own component-separation
 * requirement.
 *
 * hasOptions starts true if the product already has option groups OR
 * variants (STEP 18 spec section 20: a product saved before this step, or
 * one whose variants were hand-typed via the old free-text
 * WizardVariantManager this replaces, must still open correctly) —
 * reconstructOptionGroupsFromVariants backfills a best-effort group list
 * from existing variants when option_groups itself is empty, purely so
 * editing can continue; it's never written back until the admin actually
 * changes something.
 */
export function ProductOptionEditor({
  productId,
  baseSku,
  krwSalePrice,
  optionGroups,
  variants,
  onOptionGroupsChange,
  onVariantsChange,
}: ProductOptionEditorProps) {
  const [hasOptions, setHasOptions] = useState(() => optionGroups.length > 0 || variants.length > 0);
  const [groups, setGroups] = useState<AdminOptionGroup[]>(() =>
    optionGroups.length > 0 ? optionGroups : reconstructOptionGroupsFromVariants(variants)
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGroups(next: AdminOptionGroup[]) {
    setGroups(next);
    onOptionGroupsChange(next);
  }

  function addGroup() {
    updateGroups([...groups, { name: "", choices: [] }]);
  }
  function updateGroup(index: number, patch: Partial<AdminOptionGroup>) {
    updateGroups(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }
  function removeGroup(index: number) {
    updateGroups(groups.filter((_, i) => i !== index));
  }

  async function handleSwitchToNoOptions() {
    if (variants.length > 0) {
      const confirmed = window.confirm("옵션 없음으로 전환하면 현재 등록된 모든 옵션 조합(SKU/가격/재고)이 삭제됩니다. 계속할까요?");
      if (!confirmed) return;
      const result = await replaceVariantsAction(productId, []);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onVariantsChange([]);
    }
    updateGroups([]);
    setHasOptions(false);
    setError(null);
  }

  async function handleGenerate() {
    setError(null);
    const result = generateCombinations(groups);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.combinations.length === 0) {
      setError("옵션 그룹명과 옵션값을 모두 입력한 뒤 다시 시도해주세요.");
      return;
    }
    const reconciled = reconcileVariants(variants, result.combinations, baseSku);
    setGenerating(true);
    const saveResult = await replaceVariantsAction(productId, reconciled);
    setGenerating(false);
    if (!saveResult.ok) {
      setError(saveResult.error);
      return;
    }
    onVariantsChange(saveResult.data);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">옵션</h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSwitchToNoOptions}
          className={`flex-1 border px-3 py-2 text-sm font-bold ${!hasOptions ? "border-primary bg-primary-light/30 text-primary" : "border-border text-text-secondary"}`}
        >
          옵션 없음
        </button>
        <button
          type="button"
          onClick={() => setHasOptions(true)}
          className={`flex-1 border px-3 py-2 text-sm font-bold ${hasOptions ? "border-primary bg-primary-light/30 text-primary" : "border-border text-text-secondary"}`}
        >
          옵션 있음
        </button>
      </div>

      {!hasOptions && (
        <p className="text-xs text-text-secondary">
          이 상품은 옵션 없이 단일 SKU로 판매됩니다. SKU/판매가/재고는 기본정보·가격·공급배송 단계에서 관리합니다.
        </p>
      )}

      {hasOptions && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-secondary">옵션 그룹 (예: 색상, 사이즈, 용량) — 그룹당 옵션값 1개 이상</p>
              <button type="button" onClick={addGroup} className="text-xs font-bold text-primary underline">
                + 옵션 그룹 추가
              </button>
            </div>
            {groups.length === 0 && <p className="text-xs text-amber-700">옵션 그룹을 1개 이상 추가해주세요.</p>}
            {groups.map((group, index) => (
              <div key={index} className="flex flex-col gap-2 border border-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="옵션 그룹명 (예: 색상)"
                    value={group.name}
                    onChange={(e) => updateGroup(index, { name: e.target.value })}
                    className="flex-1 border border-border px-2 py-1.5 text-sm text-text-main outline-none"
                  />
                  <button type="button" onClick={() => removeGroup(index)} className="text-xs text-red-600">
                    삭제
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="옵션값을 쉼표로 구분 (예: 블랙, 화이트)"
                  value={group.choices.join(", ")}
                  onChange={(e) =>
                    updateGroup(index, { choices: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })
                  }
                  className="border border-border px-2 py-1.5 text-sm text-text-main outline-none"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || groups.length === 0}
            className="self-start bg-primary px-4 py-2 text-sm font-bold text-white disabled:bg-border"
          >
            {generating ? "생성 중..." : variants.length > 0 ? "옵션 조합 재생성" : "옵션 조합 생성"}
          </button>
          <p className="text-xs text-text-secondary">
            기존 조합과 동일한 옵션값(예: 색상:블랙 / 사이즈:S)은 SKU·판매가·재고가 그대로 유지됩니다. 새 조합만 새로 추가되고, 사라진
            조합은 삭제됩니다.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}

          <ProductVariantTable
            productId={productId}
            baseSku={baseSku}
            krwSalePrice={krwSalePrice}
            variants={variants}
            onVariantsChange={onVariantsChange}
          />
        </>
      )}
    </section>
  );
}
