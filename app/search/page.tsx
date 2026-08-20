import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { SearchResultsClient } from "@/components/product/SearchResultsClient";
import { SearchEmptyState } from "@/components/product/SearchEmptyState";
import { SearchPromptState } from "@/components/product/SearchPromptState";
import { SearchResultsHeader } from "@/components/product/SearchResultsHeader";
import { parseSearchParams } from "@/lib/search/params";
import { getBestProducts, searchProducts } from "@/lib/repositories/products";
import type { Metadata } from "next";

const SEARCH_FETCH_SIZE = 24;
const MAX_PAGES = 5;

/** See app/product/[id]/page.tsx for why this is always ko-default. */
export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const rawParams = await props.searchParams;
  const queryState = parseSearchParams(rawParams);
  if (!queryState.q) return { title: "검색 | 서울창고" };
  return { title: `"${queryState.q}" 검색결과 | 서울창고` };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const rawParams = await props.searchParams;
  const queryState = parseSearchParams(rawParams);

  if (!queryState.q) {
    return <SearchPromptState />;
  }

  const pageSize = SEARCH_FETCH_SIZE * Math.min(queryState.page, MAX_PAGES);
  const [result, recommendedProducts] = await Promise.all([
    searchProducts({
      q: queryState.q,
      category: queryState.category ?? undefined,
      shipping: queryState.shipping.length > 0 ? queryState.shipping : undefined,
      sort: queryState.sort,
      page: 1,
      pageSize,
    }),
    getBestProducts(8),
  ]);

  if (result.products.length === 0) {
    return <SearchEmptyState query={queryState.q} recommendedProducts={recommendedProducts} />;
  }

  return (
    <>
      <SearchResultsHeader />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col">
          <SearchResultsClient products={result.products} queryState={queryState} recommendedProducts={recommendedProducts} />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
