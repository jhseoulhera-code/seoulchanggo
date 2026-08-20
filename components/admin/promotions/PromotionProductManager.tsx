"use client";

import { useState } from "react";
import { searchProductsForPickerAction } from "@/lib/actions/adminCategories";
import { addPromotionProductAction, removePromotionProductAction, reorderPromotionProductAction } from "@/lib/actions/adminPromotions";
import type { AdminPromotionProduct } from "@/types/admin";
import type { AdminProductPickerItem } from "@/lib/repositories/admin/products";

export function PromotionProductManager({ promotionId, products }: { promotionId: string; products: AdminPromotionProduct[] }) {
  const items = [...products].sort((a, b) => a.sortOrder - b.sortOrder);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProductPickerItem[]>([]);

  async function handleSearch() {
    if (!query.trim()) return;
    const result = await searchProductsForPickerAction(query);
    if (result.ok) setResults(result.data);
  }

  async function handleAdd(productId: string) {
    await addPromotionProductAction(promotionId, productId, items.length);
    setResults([]);
    setQuery("");
  }

  async function handleMove(productId: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.productId === productId);
    const target = items[index + direction];
    if (!target) return;
    const current = items[index];
    await Promise.all([
      reorderPromotionProductAction(promotionId, current.productId, target.sortOrder),
      reorderPromotionProductAction(promotionId, target.productId, current.sortOrder),
    ]);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">기획전 상품</h2>
      {items.length === 0 ? (
        <p className="text-xs text-text-secondary">등록된 상품이 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border border-border">
          {items.map((item, index) => (
            <li key={item.productId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-text-main">{item.productNameKo}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleMove(item.productId, -1)} disabled={index === 0} className="text-xs text-text-secondary disabled:opacity-30">
                  ▲
                </button>
                <button type="button" onClick={() => handleMove(item.productId, 1)} disabled={index === items.length - 1} className="text-xs text-text-secondary disabled:opacity-30">
                  ▼
                </button>
                <button type="button" onClick={() => removePromotionProductAction(promotionId, item.productId)} className="text-xs text-red-600">
                  제거
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          상품 검색(이름/SKU)
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="w-56 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <button type="button" onClick={handleSearch} className="h-[34px] border border-primary px-3 text-sm font-bold text-primary">
          검색
        </button>
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border border-border">
          {results.map((product) => (
            <li key={product.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {product.nameKo} <span className="text-text-secondary">({product.sku})</span>
              </span>
              <button type="button" onClick={() => handleAdd(product.id)} className="text-xs text-primary underline">
                추가
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
