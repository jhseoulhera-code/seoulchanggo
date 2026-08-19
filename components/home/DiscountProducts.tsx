import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRowPlaceholder } from "@/components/product/ProductRowPlaceholder";

export function DiscountProducts() {
  return (
    <section className="mt-6">
      <SectionHeading title="할인 상품" />
      <div className="mt-3">
        <ProductRowPlaceholder />
      </div>
    </section>
  );
}
