"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { SearchFilterSortBar } from "@/components/product/SearchFilterSortBar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useMarket } from "@/contexts/MarketContext";
import { getProductMarketPrice } from "@/lib/currency";
import { isProductAvailableInMarket } from "@/lib/shipping";
import { buildSearchQueryString } from "@/lib/search/params";
import type { SearchQueryState } from "@/lib/search/params";
import { logSearchClickAction, logSearchEventAction } from "@/lib/actions/searchEvents";
import type { Product } from "@/types";

const PAGE_SIZE = 24;

type SearchResultsClientProps = {
  products: Product[];
  queryState: SearchQueryState;
  recommendedProducts: Product[];
};

/**
 * Applies the Market-dependent slice of filtering/sorting on top of what the
 * server already narrowed by q/category/shipping-type/sort (STEP 12 spec
 * section 11-13) — price range, discount-only, availability-only, and
 * priceLow/priceHigh sort all need the current Market's resolved price,
 * which has no server-side representation in this app (see
 * contexts/MarketContext.tsx). "더보기" reveals more of the already-fetched
 * set client-side; see app/search/page.tsx for the fetch-size/page tradeoff
 * this implies at larger catalog scale.
 */
export function SearchResultsClient({ products, queryState, recommendedProducts }: SearchResultsClientProps) {
  const router = useRouter();
  const { market } = useMarket();
  const [availableOnly, setAvailableOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchEventId, setSearchEventId] = useState<string | null>(null);

  const resetKey = `${queryState.q}|${queryState.sort}|${queryState.minPrice}|${queryState.maxPrice}|${queryState.discount}|${availableOnly}`;
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setVisibleCount(PAGE_SIZE);
  }

  useEffect(() => {
    let cancelled = false;
    logSearchEventAction(queryState.q, market.countryCode, market.locale, products.length).then((id) => {
      if (!cancelled) setSearchEventId(id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryState.q, market.countryCode, market.locale]);

  const filteredSorted = useMemo(() => {
    let list = products.map((product) => ({ product, ...getProductMarketPrice(product, market) }));

    if (queryState.minPrice != null) list = list.filter((entry) => entry.salePrice >= queryState.minPrice!);
    if (queryState.maxPrice != null) list = list.filter((entry) => entry.salePrice <= queryState.maxPrice!);
    if (queryState.discount) list = list.filter((entry) => Boolean(entry.product.discountRate));
    if (availableOnly) list = list.filter((entry) => isProductAvailableInMarket(entry.product, market.countryCode));

    if (queryState.sort === "priceLow") list = [...list].sort((a, b) => a.salePrice - b.salePrice);
    if (queryState.sort === "priceHigh") list = [...list].sort((a, b) => b.salePrice - a.salePrice);

    return list.map((entry) => entry.product);
  }, [products, queryState.minPrice, queryState.maxPrice, queryState.discount, queryState.sort, availableOnly, market]);

  function applyQueryChange(next: Partial<SearchQueryState>) {
    const qs = buildSearchQueryString({ ...queryState, ...next });
    router.push(`/search?${qs}`);
  }

  function handleProductClick(productId: string, position: number) {
    if (searchEventId) void logSearchClickAction(searchEventId, productId, position);
  }

  const visible = filteredSorted.slice(0, visibleCount);

  return (
    <div className="flex flex-col">
      <div className="border-b border-border py-3 text-sm">
        <strong className="font-bold text-text-main">&quot;{queryState.q}&quot;</strong>{" "}
        <span className="text-text-secondary">검색 결과 {filteredSorted.length}개</span>
      </div>

      <SearchFilterSortBar state={queryState} onApply={applyQueryChange} />

      <label className="flex items-center gap-2 border-b border-border pb-3 text-xs text-text-secondary">
        <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
        {market.countryName}로 배송 가능한 상품만 보기
      </label>

      {filteredSorted.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <PackageSearch size={36} className="text-text-secondary" />
          <p className="text-sm text-text-secondary">조건에 맞는 검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="pt-4" onClickCapture={(event) => {
          const link = (event.target as HTMLElement).closest("a[href^='/product/']");
          if (!link) return;
          const productId = link.getAttribute("href")?.replace("/product/", "");
          const index = productId ? visible.findIndex((p) => p.id === productId) : -1;
          if (productId && index >= 0) handleProductClick(productId, index);
        }}>
          <ProductGrid products={visible} />
        </div>
      )}

      {visibleCount < filteredSorted.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
          className="mt-4 h-11 border border-border text-sm font-bold text-text-main"
        >
          더보기
        </button>
      )}

      {filteredSorted.length === 0 && recommendedProducts.length > 0 && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-3 text-sm font-bold text-text-main">이런 상품은 어떠세요?</h2>
          <ProductGrid products={recommendedProducts} />
        </section>
      )}
    </div>
  );
}
