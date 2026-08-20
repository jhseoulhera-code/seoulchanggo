import { Star } from "lucide-react";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/PageContainer";
import { DetailHeader } from "@/components/layout/DetailHeader";
import { DetailTabs } from "@/components/product/DetailTabs";
import { OptionSelector } from "@/components/product/OptionSelector";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchaseActions } from "@/components/product/PurchaseActions";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { ShippingBadge } from "@/components/product/ShippingBadge";
import { ShippingInfoPanel } from "@/components/product/ShippingInfoPanel";
import { categories } from "@/data/categories";
import { allProducts } from "@/data/products";
import { formatPrice } from "@/lib/utils";

export function generateStaticParams() {
  return allProducts.map((product) => ({ id: product.id }));
}

export default async function ProductDetailPage(props: PageProps<"/product/[id]">) {
  const { id } = await props.params;
  const product = allProducts.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  const hasDiscount = Boolean(product.discountRate);
  const eyebrow =
    product.brand ?? categories.find((item) => item.id === product.category)?.label ?? "";
  const isLowStock = typeof product.stock === "number" && product.stock < 10;

  return (
    <>
      <DetailHeader />
      <main className="pb-24 md:pb-12">
        <PageContainer className="pt-4">
          <div className="flex flex-col gap-8 md:flex-row">
            <div className="md:w-1/2">
              <ProductGallery product={product} />
            </div>

            <div className="flex flex-col gap-5 md:w-1/2">
              <div>
                {eyebrow && (
                  <p className="text-xs font-medium text-text-secondary">{eyebrow}</p>
                )}
                <h1 className="mt-1 text-lg font-bold text-text-main md:text-xl">
                  {product.name}
                </h1>
                <div className="mt-2 flex items-center gap-1 text-sm text-text-secondary">
                  <Star size={14} className="fill-primary text-primary" />
                  <span className="font-medium text-text-main">{product.rating.toFixed(1)}</span>
                  <span>({product.reviewCount.toLocaleString("ko-KR")})</span>
                </div>
              </div>

              <div className="border-t border-border pt-5">
                <div className="flex items-baseline gap-2">
                  {hasDiscount && (
                    <span className="text-xl font-bold text-primary">
                      {product.discountRate}%
                    </span>
                  )}
                  <span className="text-2xl font-bold text-text-main">
                    {formatPrice(product.salePrice)}
                  </span>
                </div>
                {hasDiscount && (
                  <span className="text-sm text-text-secondary line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ShippingBadge type={product.shippingType} label={product.shippingLabel} />
                  {product.freeShipping && (
                    <span className="text-xs font-medium text-primary">무료배송</span>
                  )}
                </div>
              </div>

              <ShippingInfoPanel product={product} />

              {product.options && product.options.length > 0 && (
                <div className="border-t border-border pt-5">
                  <OptionSelector options={product.options} />
                </div>
              )}

              <div className="border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-text-secondary">수량</h3>
                  {isLowStock && (
                    <span className="text-xs text-text-secondary">
                      재고 {product.stock}개 남음
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <QuantitySelector />
                </div>
              </div>

              <PurchaseActions variant="inline" />
            </div>
          </div>

          <div className="mt-10">
            <DetailTabs product={product} />
          </div>
        </PageContainer>
      </main>
      <PurchaseActions variant="fixed" />
    </>
  );
}
