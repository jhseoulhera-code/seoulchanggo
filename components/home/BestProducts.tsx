import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getBestProducts } from "@/lib/repositories/products";

export async function BestProducts() {
  const products = await getBestProducts();

  return (
    <section>
      <SectionHeading titleKey="bestProducts" showMore />
      <div className="mt-3">
        <ProductGrid products={products} />
      </div>
    </section>
  );
}
