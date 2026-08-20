"use client";

import { useState } from "react";
import { addVariantAction, deleteVariantAction, updateVariantAction } from "@/lib/actions/adminProducts";
import type { AdminProductVariant } from "@/types/admin";

type VariantManagerProps = {
  productId: string;
  variants: AdminProductVariant[];
};

export function VariantManager({ productId, variants }: VariantManagerProps) {
  const [sku, setSku] = useState("");
  const [optionText, setOptionText] = useState("");
  const [stock, setStock] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const result = await addVariantAction(productId, {
      sku,
      optionValues,
      additionalPrice: 0,
      stockQuantity: Number(stock) || 0,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSku("");
    setOptionText("");
    setStock("0");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">옵션 조합 (Variant) 재고</h2>

      {variants.length === 0 ? (
        <p className="text-xs text-text-secondary">등록된 옵션 조합이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">옵션</th>
                <th className="px-3 py-2">재고</th>
                <th className="px-3 py-2">활성</th>
                <th className="px-3 py-2">삭제</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <VariantRow key={variant.id} productId={productId} variant={variant} />
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
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-24 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending}
          className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
        >
          추가
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}

function VariantRow({ productId, variant }: { productId: string; variant: AdminProductVariant }) {
  const [stock, setStock] = useState(String(variant.stockQuantity));
  const [saving, setSaving] = useState(false);

  async function handleStockBlur() {
    const next = Number(stock) || 0;
    if (next === variant.stockQuantity) return;
    setSaving(true);
    await updateVariantAction(productId, variant.id, { stockQuantity: next });
    setSaving(false);
  }

  async function handleToggleActive() {
    await updateVariantAction(productId, variant.id, { isActive: !variant.isActive });
  }

  async function handleDelete() {
    await deleteVariantAction(productId, variant.id);
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2 text-text-secondary">{variant.sku}</td>
      <td className="px-3 py-2 text-text-main">{Object.entries(variant.optionValues).map(([k, v]) => `${k}:${v}`).join(", ")}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={handleStockBlur}
          disabled={saving}
          className="w-20 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input type="checkbox" checked={variant.isActive} onChange={handleToggleActive} className="h-4 w-4 accent-primary" />
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={handleDelete} className="text-xs text-red-600">
          삭제
        </button>
      </td>
    </tr>
  );
}
