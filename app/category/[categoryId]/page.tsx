import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { CategoryPageHeader } from "@/components/product/CategoryPageHeader";
import { CategoryProductCount } from "@/components/product/CategoryProductCount";
import { ListToolbar } from "@/components/product/ListToolbar";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getCategories } from "@/lib/repositories/categories";
import { getProductsByCategory } from "@/lib/repositories/products";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ categoryId: category.id }));
}

/** See app/product/[id]/page.tsx for why this is always ko-default. */
export async function generateMetadata(props: PageProps<"/category/[categoryId]">): Promise<Metadata> {
  const { categoryId } = await props.params;
  const categories = await getCategories();
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return { title: "카테고리를 찾을 수 없습니다" };
  return { title: `${category.label} | 서울창고` };
}

export default async function CategoryPage(props: PageProps<"/category/[categoryId]">) {
  const { categoryId } = await props.params;
  const categories = await getCategories();
  const category = categories.find((item) => item.id === categoryId);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategory(categoryId);

  return (
    <>
      <CategoryPageHeader label={category.label} labelEn={category.labelEn} />
      <main className="pb-24 md:pb-10">
        <PageContainer className="flex flex-col">
          <CategoryProductCount count={products.length} />
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
