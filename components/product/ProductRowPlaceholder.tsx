import { ProductCardPlaceholder } from "@/components/product/ProductCardPlaceholder";

type ProductRowPlaceholderProps = {
  count?: number;
};

export function ProductRowPlaceholder({ count = 5 }: ProductRowPlaceholderProps) {
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1 md:px-6">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardPlaceholder key={index} />
      ))}
    </div>
  );
}
