"use client";

import { useState } from "react";
import {
  addHomeSectionProductAction,
  removeHomeSectionItemAction,
  reorderHomeSectionItemAction,
  searchProductsForPickerAction,
  setHomeSectionActiveAction,
} from "@/lib/actions/adminCategories";
import type { AdminHomeSection } from "@/types/admin";
import type { AdminProductPickerItem } from "@/lib/repositories/admin/products";

export function HomeCurationManager({ sections }: { sections: AdminHomeSection[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">HOME 상품 큐레이션</h2>
      {sections.length === 0 ? (
        <p className="border border-border p-4 text-sm text-text-secondary">등록된 HOME 섹션이 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <HomeSectionCard key={section.id} section={section} />
          ))}
        </div>
      )}
    </section>
  );
}

function HomeSectionCard({ section }: { section: AdminHomeSection }) {
  const [active, setActive] = useState(section.isActive);
  const items = [...section.items].sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleToggleActive() {
    const next = !active;
    setActive(next);
    await setHomeSectionActiveAction(section.id, next);
  }

  async function handleMove(itemId: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.itemId === itemId);
    const target = items[index + direction];
    if (!target) return;
    const current = items[index];
    await Promise.all([
      reorderHomeSectionItemAction(current.itemId, target.sortOrder),
      reorderHomeSectionItemAction(target.itemId, current.sortOrder),
    ]);
  }

  return (
    <div className="border border-border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-text-main">{section.titleKo}</p>
          <p className="text-xs text-text-secondary">{section.sectionKey}</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={active} onChange={handleToggleActive} className="h-4 w-4 accent-primary" />
          활성
        </label>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-xs text-text-secondary">등록된 상품이 없습니다.</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border border border-border">
          {items.map((item, index) => (
            <li key={item.itemId} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-text-main">{item.productNameKo}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMove(item.itemId, -1)}
                  disabled={index === 0}
                  className="text-xs text-text-secondary disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(item.itemId, 1)}
                  disabled={index === items.length - 1}
                  className="text-xs text-text-secondary disabled:opacity-30"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => removeHomeSectionItemAction(item.itemId)}
                  className="text-xs text-red-600"
                >
                  제거
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductPicker sectionId={section.id} nextSortOrder={items.length} />
    </div>
  );
}

function ProductPicker({ sectionId, nextSortOrder }: { sectionId: string; nextSortOrder: number }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminProductPickerItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    const result = await searchProductsForPickerAction(query);
    setSearching(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResults(result.data);
  }

  async function handleAdd(productId: string) {
    await addHomeSectionProductAction(sectionId, productId, nextSortOrder);
    setResults([]);
    setQuery("");
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          상품 검색(이름/SKU)
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-56 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="h-[34px] border border-primary px-3 text-sm font-bold text-primary disabled:opacity-50"
        >
          검색
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
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
    </div>
  );
}
