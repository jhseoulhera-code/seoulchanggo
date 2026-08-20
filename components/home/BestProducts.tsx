import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductGrid } from "@/components/product/ProductGrid";
import { bestProducts } from "@/data/products";

export function BestProducts() {
  return (
    <section>
      <SectionHeading title="베스트 상품" showMore />
      <div className="mt-3">
        <ProductGrid products={bestProducts} />
      </div>
    </section>
  );
}
