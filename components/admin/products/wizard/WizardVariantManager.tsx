"use client";

import { useState } from "react";
import { addVariantAction, deleteVariantAction, updateVariantAction } from "@/lib/actions/adminProducts";
import type { AdminProductVariant } from "@/types/admin";

type WizardVariantManagerProps = {
  productId: string;
  variants: AdminProductVariant[];
  onVariantsChange: (variants: AdminProductVariant[]) => void;
};

/**
 * A Wizard-local counterpart to components/admin/products/VariantManager.tsx
 * with the same fields/behavior, kept as a separate component rather than
 * modified in place: that original component's list stays in sync by
 * relying on its Server Component parent re-rendering with fresh props
 * (STEP 09's original design), which doesn't apply to this fully
 * client-side Wizard tree — see ImageUploadManager's comment for the same
 * reasoning. Leaving the original untouched avoids any risk to the
 * existing /admin/products/[id] page it still serves.
 */
export function WizardVariantManager({ productId, variants, onVariantsChange }: WizardVariantManagerProps) {
  const [list, setList] = useState<AdminProductVariant[]>(variants);
  const [sku, setSku] = useState("");
  const [optionText, setOptionText] = useState("");
  const [stock, setStock] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(next: AdminProductVariant[]) {
    setList(next);
    onVariantsChange(next);
  }

  function parseOptionText(text: string): Record<string, string> {
    const entries = text
      .split(",")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => pair.split(":").map((part) => part.trim()));
    return Object.fromEntries(entries.filter(([key, value]) => key && value));
  }

  async function handleAdd() {
    const optionValues = parseOptionText(optionText);
    if (!sku || Object.keys(optionValues).length === 0) {
      setError("SKU와 옵션 조합을 입력해주세요. 예: 색상:화이트, 용량:500ml");
      return;
    }
    setPending(true);
    setError(null);
    const result = await addVariantAction(productId, { sku, optionValues, additionalPrice: 0, stockQuantity: Number(stock) || 0 });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    update([...list, result.data]);
    setSku("");
    setOptionText("");
    setStock("0");
  }

  async function handleUpdate(variantId: string, patch: Partial<{ stockQuantity: number; additionalPrice: number; isActive: boolean }>) {
    const result = await updateVariantAction(productId, variantId, patch);
    if (!result.ok) return setError(result.error);
    update(list.map((v) => (v.id === variantId ? { ...v, ...patch } : v)));
  }

  async function handleDelete(variantId: string) {
    const result = await deleteVariantAction(productId, variantId);
    if (!result.ok) return setError(result.error);
    update(list.filter((v) => v.id !== variantId));
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">옵션 조합 (Variant) 재고 · SKU · 추가금액</h2>

      {list.length === 0 ? (
        <p className="text-xs text-text-secondary">등록된 옵션 조합이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">옵션</th>
                <th className="px-3 py-2">추가금액</th>
                <th className="px-3 py-2">재고</th>
                <th className="px-3 py-2">활성</th>
                <th className="px-3 py-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {list.map((variant) => (
                <VariantRow key={variant.id} variant={variant} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          SKU
          <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-40 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          옵션 (색상:화이트, 용량:500ml)
          <input
            value={optionText}
            onChange={(e) => setOptionText(e.target.value)}
            className="w-64 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          재고
          <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-24 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <button type="button" onClick={handleAdd} disabled={pending} className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border">
          추가
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

function VariantRow({
  variant,
  onUpdate,
  onDelete,
}: {
  variant: AdminProductVariant;
  onUpdate: (variantId: string, patch: Partial<{ stockQuantity: number; additionalPrice: number; isActive: boolean }>) => void;
  onDelete: (variantId: string) => void;
}) {
  const [stock, setStock] = useState(String(variant.stockQuantity));
  const [additionalPrice, setAdditionalPrice] = useState(String(variant.additionalPrice));

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2 text-text-secondary">{variant.sku}</td>
      <td className="px-3 py-2 text-text-main">{Object.entries(variant.optionValues).map(([k, v]) => `${k}:${v}`).join(", ")}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={additionalPrice}
          onChange={(e) => setAdditionalPrice(e.target.value)}
          onBlur={() => {
            const next = Number(additionalPrice) || 0;
            if (next !== variant.additionalPrice) onUpdate(variant.id, { additionalPrice: next });
          }}
          className="w-24 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={() => {
            const next = Number(stock) || 0;
            if (next !== variant.stockQuantity) onUpdate(variant.id, { stockQuantity: next });
          }}
          className="w-20 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={variant.isActive}
          onChange={() => onUpdate(variant.id, { isActive: !variant.isActive })}
          className="h-4 w-4 accent-primary"
        />
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={() => onDelete(variant.id)} className="text-xs text-red-600">
          삭제
        </button>
      </td>
    </tr>
  );
}
