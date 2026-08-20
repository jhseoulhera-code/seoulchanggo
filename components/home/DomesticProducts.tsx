import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { getDomesticProducts } from "@/lib/repositories/products";

export async function DomesticProducts() {
  const products = await getDomesticProducts();

  return (
    <section>
      <SectionHeading title="빠른 국내배송" showMore />
      <div className="mt-3">
        <ProductRow products={products} />
      </div>
    </section>
  );
}
