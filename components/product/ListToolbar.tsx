"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { cn } from "@/lib/utils";
import type { PriceRangeId, ShippingType, SortOption } from "@/types";

const SHIPPING_OPTIONS: { value: ShippingType; label: string }[] = [
  { value: "domestic", label: "국내배송" },
  { value: "overseas_direct", label: "해외직배송" },
  { value: "overseas_agent", label: "해외구매대행" },
];

const PRICE_OPTIONS: { value: PriceRangeId; label: string }[] = [
  { value: "under10k", label: "1만원 이하" },
  { value: "10kTo30k", label: "1만~3만원" },
  { value: "30kTo50k", label: "3만~5만원" },
  { value: "over50k", label: "5만원 이상" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recommended", label: "추천순" },
  { value: "popular", label: "인기순" },
  { value: "priceLow", label: "낮은 가격순" },
  { value: "priceHigh", label: "높은 가격순" },
  { value: "reviews", label: "리뷰순" },
];

export function ListToolbar() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [shipping, setShipping] = useState<Set<ShippingType>>(new Set());
  const [priceRange, setPriceRange] = useState<PriceRangeId | null>(null);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("recommended");

  const filterCount = shipping.size + (priceRange ? 1 : 0) + (discountOnly ? 1 : 0);
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortOption)?.label;

  function toggleShipping(value: ShippingType) {
    setShipping((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function resetFilters() {
    setShipping(new Set());
    setPriceRange(null);
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
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-text-main"
                >
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
            <h4 className="mb-3 text-xs font-bold text-text-secondary">가격대</h4>
            <div className="flex flex-col gap-3">
              {PRICE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-text-main"
                >
                  <input
                    type="radio"
                    name="price-range"
                    checked={priceRange === option.value}
                    onChange={() => setPriceRange(option.value)}
                    className="h-4 w-4 accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <label className="flex items-center gap-2 text-sm text-text-main">
              <input
                type="checkbox"
                checked={discountOnly}
                onChange={(event) => setDiscountOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              할인상품만 보기
            </label>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="flex-1 border border-border py-2.5 text-sm font-medium text-text-main"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="flex-1 bg-primary py-2.5 text-sm font-bold text-white"
          >
            적용
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sortOpen} title="정렬" onClose={() => setSortOpen(false)}>
        <div className="flex flex-col">
          {SORT_OPTIONS.map((option) => {
            const isActive = option.value === sortOption;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSortOption(option.value);
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
