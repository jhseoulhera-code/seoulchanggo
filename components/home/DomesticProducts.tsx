import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { domesticProducts } from "@/data/products";

export function DomesticProducts() {
  return (
    <section>
      <SectionHeading title="빠른 국내배송" showMore />
      <div className="mt-3">
        <ProductRow products={domesticProducts} />
      </div>
    </section>
  );
}
