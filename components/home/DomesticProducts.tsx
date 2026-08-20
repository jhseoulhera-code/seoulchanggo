import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { getDomesticProducts } from "@/lib/repositories/products";

export async function DomesticProducts() {
  const products = await getDomesticProducts();

  return (
    <section>
      <SectionHeading titleKey="domesticProducts" showMore />
      <div className="mt-3">
        <ProductRow products={products} />
      </div>
    </section>
  );
}
