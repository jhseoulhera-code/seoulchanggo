import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { DetailTabs } from "@/components/product/DetailTabs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { getAllProducts, getProductBySlug } from "@/lib/repositories/products";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ id: product.id }));
}

/**
 * Server-rendered metadata always reflects the ko default (see lib/seo.ts)
 * — the visible page itself is still locale-reactive client-side.
 *
 * STEP 19 spec section 24 — uses only the STEP 17 AI SEO Assistant's
 * already-saved seo_title/seo_description (via Product.seoTitle/
 * seoDescription) when present; never calls OpenAI or any AI route from
 * this customer-facing request. Falls back to name/description exactly as
 * before when an admin never ran or applied that suggestion.
 */
export async function generateMetadata(props: PageProps<"/product/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const product = await getProductBySlug(id);
  if (!product) return { title: "상품을 찾을 수 없습니다" };

  const title = product.seoTitle || `${product.name} | 서울창고`;
  const description = product.seoDescription || product.shortDescription || product.description || product.name;
  return {
    title,
    description,
    openGraph: product.image ? { images: [{ url: product.image }] } : undefined,
  };
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
