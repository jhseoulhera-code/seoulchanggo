import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { overseasProducts } from "@/data/products";

export function OverseasProducts() {
  return (
    <section>
      <SectionHeading title="해외 인기상품" showMore />
      <div className="mt-3">
        <ProductRow products={overseasProducts} />
      </div>
    </section>
  );
}
