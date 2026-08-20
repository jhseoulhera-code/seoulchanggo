"use client";

import { useState } from "react";
import { updateInventoryQuantityAction } from "@/lib/actions/adminInventory";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminInventoryItem } from "@/types/admin";

const STATUS_LABEL: Record<AdminInventoryItem["status"], string> = {
  OK: "정상",
  LOW: "재고 부족",
  OUT: "품절",
};

export function InventoryTable({ items }: { items: AdminInventoryItem[] }) {
  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
          <tr>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">상품</th>
            <th className="px-3 py-2">옵션</th>
            <th className="px-3 py-2">현재재고</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2">수정</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <InventoryRow key={`${item.productId}-${item.variantId ?? "base"}`} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryRow({ item }: { item: AdminInventoryItem }) {
  const [stock, setStock] = useState(String(item.stockQuantity));
  const [status, setStatus] = useState(item.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function commit(next: number) {
    if (next === Number(stock) && next === item.stockQuantity) return;
    setSaving(true);
    setError(null);
    const result = await updateInventoryQuantityAction({ productId: item.productId, variantId: item.variantId }, next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      setStock(String(item.stockQuantity));
      return;
    }
    setStatus(next <= 0 ? "OUT" : next <= 5 ? "LOW" : "OK");
  }

  function handleStep(delta: number) {
    const next = Math.max(0, (Number(stock) || 0) + delta);
    setStock(String(next));
    void commit(next);
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2 text-text-secondary">{item.sku}</td>
      <td className="px-3 py-2 text-text-main">{item.productNameKo}</td>
      <td className="px-3 py-2 text-text-secondary">{item.variantLabel ?? "-"}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            disabled={saving}
            className="h-7 w-7 border border-border text-text-secondary disabled:opacity-50"
            aria-label="재고 1 감소"
          >
            -
          </button>
          <input
            type="number"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            onBlur={() => void commit(Number(stock) || 0)}
            disabled={saving}
            className="w-16 border border-border px-2 py-1 text-center text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => handleStep(1)}
            disabled={saving}
            className="h-7 w-7 border border-border text-text-secondary disabled:opacity-50"
            aria-label="재고 1 증가"
          >
            +
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-3 py-2">
        <StatusBadge
          label={STATUS_LABEL[status]}
          tone={status === "OK" ? "primary" : status === "LOW" ? "warning" : "default"}
        />
      </td>
      <td className="px-3 py-2 text-xs text-text-secondary">{saving ? "저장 중..." : "-"}</td>
    </tr>
  );
}
