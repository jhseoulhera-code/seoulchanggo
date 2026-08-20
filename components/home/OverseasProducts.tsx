import { SectionHeading } from "@/components/common/SectionHeading";
import { ProductRow } from "@/components/product/ProductRow";
import { getOverseasProducts } from "@/lib/repositories/products";

export async function OverseasProducts() {
  const products = await getOverseasProducts();

  return (
    <section>
      <SectionHeading title="해외 인기상품" showMore />
      <div className="mt-3">
        <ProductRow products={products} />
      </div>
    </section>
  );
}
