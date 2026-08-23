"use client";

import { useState } from "react";
import { deleteVariantAction, replaceVariantsAction, updateVariantAction } from "@/lib/actions/adminProducts";
import { formatCurrency } from "@/lib/currency";
import { isVariantSoldOut, suggestSkuForCombination } from "@/lib/admin/productOptions";
import type { AdminProductVariant } from "@/types/admin";

type ProductVariantTableProps = {
  productId: string;
  baseSku: string;
  krwSalePrice: number;
  variants: AdminProductVariant[];
  onVariantsChange: (variants: AdminProductVariant[]) => void;
};

/**
 * STEP 18 spec section 14 — the per-combination edit table (SKU/판매가/재고/
 * 상태), plus section 15's bulk apply actions. A single field edit on an
 * already-saved row (id present) goes through the existing single-row
 * updateVariantAction/deleteVariantAction — already atomic, no need to
 * change. Bulk price/stock apply and SKU regeneration touch every row at
 * once, so those go through replaceVariantsAction (one round trip) instead
 * of looping N single-row calls.
 *
 * "판매가" here means each combination's *own* additionalPrice added on top
 * of the product's KRW sale price (product_variants.additional_price,
 * unchanged since STEP 08) — the table shows the resulting absolute KRW
 * price for clarity, but only the delta is ever stored, so this keeps
 * working exactly as it always has if the base KRW price changes later.
 */
export function ProductVariantTable({ productId, baseSku, krwSalePrice, variants, onVariantsChange }: ProductVariantTableProps) {
  const [error, setError] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [pending, setPending] = useState(false);

  async function handleFieldUpdate(variant: AdminProductVariant, patch: Partial<{ sku: string; additionalPrice: number; stockQuantity: number; isActive: boolean }>) {
    setError(null);
    const result = await updateVariantAction(productId, variant.id, patch);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onVariantsChange(variants.map((v) => (v.id === variant.id ? { ...v, ...patch } : v)));
  }

  async function handleDelete(variant: AdminProductVariant) {
    setError(null);
    const result = await deleteVariantAction(productId, variant.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onVariantsChange(variants.filter((v) => v.id !== variant.id));
  }

  async function handleBulkApplyPrice() {
    const target = Number(bulkPrice);
    if (!Number.isFinite(target) || target < 0) {
      setError("전체 적용할 판매가를 0 이상의 숫자로 입력해주세요.");
      return;
    }
    const delta = target - krwSalePrice;
    setPending(true);
    setError(null);
    const result = await replaceVariantsAction(productId, variants.map((v) => ({ ...v, additionalPrice: delta })));
    setPending(false);
    if (!result.ok) return setError(result.error);
    onVariantsChange(result.data);
    setBulkPrice("");
  }

  async function handleBulkApplyStock() {
    const target = Number(bulkStock);
    if (!Number.isFinite(target) || target < 0) {
      setError("전체 적용할 재고를 0 이상의 숫자로 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await replaceVariantsAction(productId, variants.map((v) => ({ ...v, stockQuantity: target })));
    setPending(false);
    if (!result.ok) return setError(result.error);
    onVariantsChange(result.data);
    setBulkStock("");
  }

  async function handleRegenerateSkus() {
    const used = new Set<string>();
    const next = variants.map((v) => {
      const sku = suggestSkuForCombination(baseSku, v.optionValues, used);
      used.add(sku);
      return { ...v, sku };
    });
    setPending(true);
    setError(null);
    const result = await replaceVariantsAction(productId, next);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onVariantsChange(result.data);
  }

  if (variants.length === 0) {
    return <p className="text-xs text-text-secondary">아직 생성된 옵션 조합이 없습니다. 위에서 옵션 그룹을 입력하고 조합을 생성해주세요.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2 border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          전체 판매가 적용 (KRW)
          <input
            type="number"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            className="w-32 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <button type="button" onClick={handleBulkApplyPrice} disabled={pending || !bulkPrice} className="h-[34px] border border-primary px-3 text-xs font-bold text-primary disabled:opacity-40">
          전체 적용
        </button>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          전체 재고 적용
          <input
            type="number"
            value={bulkStock}
            onChange={(e) => setBulkStock(e.target.value)}
            className="w-24 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <button type="button" onClick={handleBulkApplyStock} disabled={pending || !bulkStock} className="h-[34px] border border-primary px-3 text-xs font-bold text-primary disabled:opacity-40">
          전체 적용
        </button>
        <button type="button" onClick={handleRegenerateSkus} disabled={pending} className="h-[34px] border border-border px-3 text-xs font-bold text-text-secondary disabled:opacity-40">
          SKU 자동 재생성
        </button>
      </div>

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">옵션</th>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">판매가 (KRW)</th>
              <th className="px-3 py-2">재고</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">삭제</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <VariantRow key={variant.id} variant={variant} krwSalePrice={krwSalePrice} onUpdate={handleFieldUpdate} onDelete={handleDelete} />
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function VariantRow({
  variant,
  krwSalePrice,
  onUpdate,
  onDelete,
}: {
  variant: AdminProductVariant;
  krwSalePrice: number;
  onUpdate: (variant: AdminProductVariant, patch: Partial<{ sku: string; additionalPrice: number; stockQuantity: number; isActive: boolean }>) => void;
  onDelete: (variant: AdminProductVariant) => void;
}) {
  const [sku, setSku] = useState(variant.sku);
  const [absolutePrice, setAbsolutePrice] = useState(String(krwSalePrice + variant.additionalPrice));
  const [stock, setStock] = useState(String(variant.stockQuantity));
  const soldOut = isVariantSoldOut(variant.stockQuantity);

  return (
    <tr className="border-b border-border last:border-b-0 align-top">
      <td className="px-3 py-2 text-text-main">{Object.entries(variant.optionValues).map(([k, v]) => `${k}:${v}`).join(" / ")}</td>
      <td className="px-3 py-2">
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          onBlur={() => {
            const trimmed = sku.trim();
            if (trimmed && trimmed !== variant.sku) onUpdate(variant, { sku: trimmed });
            else setSku(variant.sku);
          }}
          className="w-36 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={absolutePrice}
          onChange={(e) => setAbsolutePrice(e.target.value)}
          onBlur={() => {
            const next = Number(absolutePrice);
            if (!Number.isFinite(next) || next < 0) {
              setAbsolutePrice(String(krwSalePrice + variant.additionalPrice));
              return;
            }
            const nextAdditional = next - krwSalePrice;
            if (nextAdditional !== variant.additionalPrice) onUpdate(variant, { additionalPrice: nextAdditional });
          }}
          className="w-28 border border-border px-2 py-1 text-sm outline-none"
        />
        <p className="mt-0.5 text-[11px] text-text-secondary">{formatCurrency(krwSalePrice + variant.additionalPrice, "KRW")}</p>
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          onBlur={() => {
            const next = Number(stock);
            if (!Number.isFinite(next) || next < 0) {
              setStock(String(variant.stockQuantity));
              return;
            }
            if (next !== variant.stockQuantity) onUpdate(variant, { stockQuantity: next });
          }}
          className="w-20 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <span className={`w-fit px-1.5 py-0.5 text-[11px] font-bold ${soldOut ? "bg-red-50 text-red-600" : "bg-primary-light/40 text-primary"}`}>
            {soldOut ? "품절" : "판매중"}
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <input type="checkbox" checked={variant.isActive} onChange={() => onUpdate(variant, { isActive: !variant.isActive })} className="h-3.5 w-3.5 accent-primary" />
            노출
          </label>
        </div>
      </td>
      <td className="px-3 py-2">
        <button type="button" onClick={() => onDelete(variant)} className="text-xs text-red-600">
          삭제
        </button>
      </td>
    </tr>
  );
}
