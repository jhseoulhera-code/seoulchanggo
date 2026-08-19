import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRowPlaceholder } from "@/components/product/ProductRowPlaceholder";

export function BestProducts() {
  return (
    <section className="mt-6">
      <SectionHeading title="베스트 상품" />
      <div className="mt-3">
        <ProductRowPlaceholder />
      </div>
    </section>
  );
}
