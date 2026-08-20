import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { DetailTabs } from "@/components/product/DetailTabs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { getAllProducts, getProductBySlug } from "@/lib/repositories/products";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ id: product.id }));
}

export default async function ProductDetailPage(props: PageProps<"/product/[id]">) {
  const { id } = await props.params;
  const product = await getProductBySlug(id);

  if (!product) {
    notFound();
  }

  return (
    <>
      <DetailHeader />
      <main className="pb-24 md:pb-12">
        <PageContainer className="pt-4">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="md:w-1/2">
              <ProductGallery product={product} />
            </div>

            <div className="md:w-1/2">
              <ProductPurchasePanel product={product} />
            </div>
          </div>

          <div className="mt-10">
            <DetailTabs product={product} />
          </div>
        </PageContainer>
      </main>
    </>
  );
}
