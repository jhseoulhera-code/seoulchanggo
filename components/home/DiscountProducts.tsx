import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { discountProducts } from "@/data/products";

export function DiscountProducts() {
  return (
    <section>
      <SectionHeading title="할인상품" showMore />
      <div className="mt-3">
        <ProductRow products={discountProducts} />
      </div>
    </section>
  );
}
