import { PackageSearch, Search } from "lucide-react";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { SearchResultsClient } from "@/components/product/SearchResultsClient";
import { ProductGrid } from "@/components/product/ProductGrid";
import { parseSearchParams } from "@/lib/search/params";
import { getBestProducts, searchProducts } from "@/lib/repositories/products";

const SEARCH_FETCH_SIZE = 24;
const MAX_PAGES = 5;

export default async function SearchPage(props: PageProps<"/search">) {
  const rawParams = await props.searchParams;
  const queryState = parseSearchParams(rawParams);

  if (!queryState.q) {
    return (
      <>
        <ListHeader title="검색" />
        <main className="pb-24 md:pb-10">
          <PageContainer>
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <Search size={36} className="text-text-secondary" />
              <p className="text-sm text-text-secondary">검색어를 입력해주세요.</p>
            </div>
          </PageContainer>
        </main>
        <BottomNav />
      </>
    );
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
    return (
      <>
        <ListHeader title="검색결과" />
        <main className="pb-24 md:pb-10">
          <PageContainer className="flex flex-col">
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <PackageSearch size={36} className="text-text-secondary" />
              <p className="text-sm text-text-main">
                <strong>&quot;{queryState.q}&quot;</strong> 검색 결과가 없습니다.
              </p>
            </div>

            {recommendedProducts.length > 0 && (
              <section className="mt-4 border-t border-border pt-6">
                <h2 className="mb-3 text-sm font-bold text-text-main">이런 상품은 어떠세요?</h2>
                <ProductGrid products={recommendedProducts} />
              </section>
            )}
          </PageContainer>
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <ListHeader title="검색결과" />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col">
          <SearchResultsClient products={result.products} queryState={queryState} recommendedProducts={recommendedProducts} />
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
