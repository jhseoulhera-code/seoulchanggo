"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import type { SearchQueryState } from "@/lib/search/params";
import type { ShippingType, SortOption } from "@/types";

const SHIPPING_OPTIONS: { value: ShippingType; label: string }[] = [
  { value: "domestic", label: "국내배송" },
  { value: "overseas_direct", label: "해외직배송" },
  { value: "overseas_agent", label: "해외구매대행" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "추천순" },
  { value: "popular", label: "인기순" },
  { value: "priceLow", label: "낮은 가격순" },
  { value: "priceHigh", label: "높은 가격순" },
  { value: "reviews", label: "리뷰 많은순" },
  { value: "latest", label: "최신순" },
];

type SearchFilterSortBarProps = {
  state: SearchQueryState;
  onApply: (next: Partial<SearchQueryState>) => void;
};

/**
 * The /search-specific counterpart to components/product/ListToolbar.tsx —
 * same BottomSheet/button visual language (STEP 12 spec section 37: no
 * redesign), but URL-controlled instead of local-only state, and numeric
 * min/max price instead of ListToolbar's fixed KRW brackets (which don't
 * make sense once a search can be viewed in INR too). ListToolbar itself is
 * untouched — /category keeps its existing uncontrolled behavior.
 */
export function SearchFilterSortBar({ state, onApply }: SearchFilterSortBarProps) {
  const { market } = useMarket();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [shipping, setShipping] = useState<Set<ShippingType>>(new Set(state.shipping));
  const [minPrice, setMinPrice] = useState(state.minPrice != null ? String(state.minPrice) : "");
  const [maxPrice, setMaxPrice] = useState(state.maxPrice != null ? String(state.maxPrice) : "");
  const [discountOnly, setDiscountOnly] = useState(state.discount);

  const filterCount = state.shipping.length + (state.minPrice != null || state.maxPrice != null ? 1 : 0) + (state.discount ? 1 : 0);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === state.sort)?.label;

  function toggleShipping(value: ShippingType) {
    setShipping((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function handleApplyFilters() {
    onApply({
      shipping: Array.from(shipping),
      minPrice: minPrice ? Number(minPrice) : null,
      maxPrice: maxPrice ? Number(maxPrice) : null,
      discount: discountOnly,
      page: 1,
    });
    setFilterOpen(false);
  }

  function handleResetFilters() {
    setShipping(new Set());
    setMinPrice("");
    setMaxPrice("");
    setDiscountOnly(false);
  }

  return (
    <>
      <div className="flex items-center gap-2 py-3">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium text-text-main"
        >
          <SlidersHorizontal size={13} />
          필터
          {filterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[10px] font-bold text-white">
              {filterCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          className="flex items-center gap-1 border border-border px-3 py-1.5 text-xs font-medium text-text-main"
        >
          {sortLabel}
          <ChevronDown size={13} />
        </button>
      </div>

      <BottomSheet open={filterOpen} title="필터" onClose={() => setFilterOpen(false)}>
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-3 text-xs font-bold text-text-secondary">배송방식</h4>
            <div className="flex flex-col gap-3">
              {SHIPPING_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-text-main">
                  <input
                    type="checkbox"
                    checked={shipping.has(option.value)}
                    onChange={() => toggleShipping(option.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h4 className="mb-3 text-xs font-bold text-text-secondary">가격 ({market.currency})</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="최소"
                className="w-full border border-border px-3 py-2 text-sm outline-none"
              />
              <span className="text-text-secondary">~</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="최대"
                className="w-full border border-border px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <label className="flex items-center gap-2 text-sm text-text-main">
              <input
                type="checkbox"
                checked={discountOnly}
                onChange={(e) => setDiscountOnly(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              할인상품만 보기
            </label>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={handleResetFilters} className="flex-1 border border-border py-2.5 text-sm font-medium text-text-main">
            초기화
          </button>
          <button type="button" onClick={handleApplyFilters} className="flex-1 bg-primary py-2.5 text-sm font-bold text-white">
            적용
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sortOpen} title="정렬" onClose={() => setSortOpen(false)}>
        <div className="flex flex-col">
          {SORT_OPTIONS.map((option) => {
            const isActive = option.value === state.sort;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onApply({ sort: option.value, page: 1 });
                  setSortOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between border-b border-border py-3 text-left text-sm last:border-b-0",
                  isActive ? "font-bold text-primary" : "text-text-main"
                )}
              >
                {option.label}
                {isActive && <Check size={16} />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
