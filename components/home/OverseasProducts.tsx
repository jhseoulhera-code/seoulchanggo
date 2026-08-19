import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRowPlaceholder } from "@/components/product/ProductRowPlaceholder";

export function OverseasProducts() {
  return (
    <section className="mt-6">
      <SectionHeading title="해외 상품" />
      <div className="mt-3">
        <ProductRowPlaceholder />
      </div>
    </section>
  );
}
