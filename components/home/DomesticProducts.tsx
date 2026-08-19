import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRowPlaceholder } from "@/components/product/ProductRowPlaceholder";

export function DomesticProducts() {
  return (
    <section className="mt-6">
      <SectionHeading title="국내배송 상품" />
      <div className="mt-3">
        <ProductRowPlaceholder />
      </div>
    </section>
  );
}
