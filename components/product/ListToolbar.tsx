"use client";

import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import { getMessages } from "@/messages";
import type { PriceRangeId, ShippingType, SortOption } from "@/types";

export function ListToolbar() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const [shipping, setShipping] = useState<Set<ShippingType>>(new Set());
  const [priceRange, setPriceRange] = useState<PriceRangeId | null>(null);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("recommended");

  const shippingOptions: { value: ShippingType; label: string }[] = [
    { value: "domestic", label: messages.shipping.domestic },
    { value: "overseas_direct", label: messages.shipping.overseasDirect },
    { value: "overseas_agent", label: messages.shipping.overseasAgency },
  ];

  const priceOptions: { value: PriceRangeId; label: string }[] = [
    { value: "under10k", label: messages.search.priceUnder10k },
    { value: "10kTo30k", label: messages.search.price10kTo30k },
    { value: "30kTo50k", label: messages.search.price30kTo50k },
    { value: "over50k", label: messages.search.priceOver50k },
  ];

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "recommended", label: messages.search.sortRecommended },
    { value: "popular", label: messages.search.sortPopular },
    { value: "priceLow", label: messages.search.sortPriceLow },
    { value: "priceHigh", label: messages.search.sortPriceHigh },
    { value: "reviews", label: messages.search.sortReviews },
  ];

  const filterCount = shipping.size + (priceRange ? 1 : 0) + (discountOnly ? 1 : 0);
  const sortLabel = sortOptions.find((option) => option.value === sortOption)?.label;

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
          {messages.search.filter}
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

      <BottomSheet open={filterOpen} title={messages.search.filter} onClose={() => setFilterOpen(false)} closeLabel={messages.a11y.backButton}>
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="mb-3 text-xs font-bold text-text-secondary">{messages.search.shippingType}</h4>
            <div className="flex flex-col gap-3">
              {shippingOptions.map((option) => (
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
            <h4 className="mb-3 text-xs font-bold text-text-secondary">{messages.search.priceRange}</h4>
            <div className="flex flex-col gap-3">
              {priceOptions.map((option) => (
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
              {messages.search.discountOnly}
            </label>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="flex-1 border border-border py-2.5 text-sm font-medium text-text-main"
          >
            {messages.search.reset}
          </button>
          <button
            type="button"
            onClick={() => setFilterOpen(false)}
            className="flex-1 bg-primary py-2.5 text-sm font-bold text-white"
          >
            {messages.search.apply}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sortOpen} title={messages.search.sort} onClose={() => setSortOpen(false)} closeLabel={messages.a11y.backButton}>
        <div className="flex flex-col">
          {sortOptions.map((option) => {
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
