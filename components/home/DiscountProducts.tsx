import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { getDiscountProducts } from "@/lib/repositories/products";

export async function DiscountProducts() {
  const products = await getDiscountProducts();

  return (
    <section>
      <SectionHeading titleKey="discountProducts" showMore />
      <div className="mt-3">
        <ProductRow products={products} />
      </div>
    </section>
  );
}
