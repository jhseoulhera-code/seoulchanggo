import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { ListToolbar } from "@/components/product/ListToolbar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { searchProducts } from "@/data/products";

export default async function SearchPage(props: PageProps<"/search">) {
  const searchParams = await props.searchParams;
  const rawQuery = searchParams.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery) || "텀블러";
  const products = searchProducts(query);

  return (
    <>
      <ListHeader title="검색결과" />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col">
          <div className="border-b border-border py-3 text-sm">
            <strong className="font-bold text-text-main">&quot;{query}&quot;</strong>{" "}
            <span className="text-text-secondary">검색 결과 {products.length}개</span>
          </div>
          <ListToolbar />
          <div className="border-b border-border" />
          <div className="pt-4">
            <ProductGrid products={products} />
          </div>
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
