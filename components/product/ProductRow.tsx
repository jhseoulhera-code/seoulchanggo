import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types";

type ProductRowProps = {
  products: Product[];
};

export function ProductRow({ products }: ProductRowProps) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
      {products.map((product) => (
        <div key={product.id} className="w-36 flex-shrink-0 md:w-44">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}
