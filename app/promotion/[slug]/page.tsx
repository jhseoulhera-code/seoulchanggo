import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getPromotionBySlug } from "@/lib/repositories/promotions";

export default async function PromotionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const promotion = await getPromotionBySlug(slug);

  if (!promotion) {
    notFound();
  }

  return (
    <>
      <ListHeader title={promotion.titleKo} />
      <main className="pb-24 md:pb-10">
        {promotion.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={promotion.imageUrl} alt={promotion.titleKo} className="aspect-[16/9] w-full object-cover md:aspect-[21/9]" />
        )}
        <PageContainer className="flex flex-col gap-4 pt-4">
          <div>
            <h1 className="text-lg font-bold text-text-main">{promotion.titleKo}</h1>
            {promotion.descriptionKo && <p className="mt-1 text-sm text-text-secondary">{promotion.descriptionKo}</p>}
          </div>

          {promotion.products.length === 0 ? (
            <p className="py-16 text-center text-sm text-text-secondary">진행 중인 상품이 없습니다.</p>
          ) : (
            <ProductGrid products={promotion.products} />
          )}
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
