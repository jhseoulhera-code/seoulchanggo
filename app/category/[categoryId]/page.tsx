import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { ListToolbar } from "@/components/product/ListToolbar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { categories } from "@/data/categories";
import { getProductsByCategory } from "@/data/products";

export function generateStaticParams() {
  return categories.map((category) => ({ categoryId: category.id }));
}

export default async function CategoryPage(props: PageProps<"/category/[categoryId]">) {
  const { categoryId } = await props.params;
  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    notFound();
  }

  const products = getProductsByCategory(categoryId);

  return (
    <>
      <ListHeader title={category.label} />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col">
          <div className="border-b border-border py-3">
            <span className="text-sm text-text-secondary">총 {products.length}개</span>
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
