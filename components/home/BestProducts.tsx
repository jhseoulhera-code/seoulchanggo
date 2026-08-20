import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getBestProducts } from "@/lib/repositories/products";

export async function BestProducts() {
  const products = await getBestProducts();

  return (
    <section>
      <SectionHeading title="베스트 상품" showMore />
      <div className="mt-3">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
