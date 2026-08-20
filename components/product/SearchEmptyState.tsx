"use client";

import { PackageSearch } from "lucide-react";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";
import type { Product } from "@/types";

type SearchEmptyStateProps = {
  query: string;
  recommendedProducts: Product[];
};

/** The zero-server-results state for /search — see SearchPromptState.tsx for why this is a small client wrapper. */
export function SearchEmptyState({ query, recommendedProducts }: SearchEmptyStateProps) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <>
      <ListHeader title={messages.search.resultsFor} />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col">
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <PackageSearch size={36} className="text-text-secondary" />
            <p className="text-sm text-text-main">
              <strong>&quot;{query}&quot;</strong> {messages.search.noResults}
            </p>
          </div>

          {recommendedProducts.length > 0 && (
            <section className="mt-4 border-t border-border pt-6">
              <h2 className="mb-3 text-sm font-bold text-text-main">{messages.search.recommendedForYou}</h2>
              <ProductGrid products={recommendedProducts} />
            </section>
          )}
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
