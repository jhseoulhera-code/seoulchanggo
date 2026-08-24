import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { ProductDetailSections } from "@/components/product/ProductDetailSections";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { getAllProducts, getProductBySlug, getProductsByCategory } from "@/lib/repositories/products";
import type { Metadata } from "next";

const RELATED_PRODUCTS_LIMIT = 8;

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

  // STEP 26.7 — reuses the existing same-category listing (no new
  // recommendation system): excludes this product itself and caps at a
  // grid-friendly count.
  const relatedProducts = (await getProductsByCategory(product.category))
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, RELATED_PRODUCTS_LIMIT);

  return (
    <>
      <DetailHeader />
      <main className="pb-24 md:pb-12">
        <PageContainer className="pt-4">
          {/*
            STEP 26.7 — CSS Grid, not flex: a flex row can't reorder mobile
            content that's nested inside a sibling (Gallery and
            ProductDetailSections would have to live in the SAME flex item
            to visually stack in one desktop column, which then forces them
            to render back-to-back on mobile too, pushing the purchase panel
            to the very bottom instead of right after the gallery). Grid's
            explicit md:col-start/md:row-start placement lets all three
            blocks be plain DOM siblings — mobile (grid-cols-1) just stacks
            them in that same Gallery → Purchase → Sections DOM order, while
            desktop repositions them into 2 columns without touching order.
            Purchase spans both md:row-start-1 rows (md:row-span-2) so its
            containing block covers the FULL left-column height (Gallery +
            Sections combined) — that's what gives md:sticky room to travel
            as the page scrolls, not just across the Gallery's own height.
          */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[64%_1fr] md:items-start md:gap-x-10 lg:grid-cols-[65%_1fr]">
            <div className="min-w-0 md:col-start-1 md:row-start-1">
              <ProductGallery product={product} />
            </div>

            <div className="md:col-start-2 md:row-start-1 md:row-span-2 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto">
              <ProductPurchasePanel product={product} />
            </div>

            <div className="min-w-0 md:col-start-1 md:row-start-2">
              <ProductDetailSections product={product} relatedProducts={relatedProducts} />
            </div>
          </div>
        </PageContainer>
      </main>
    </>
  );
}
