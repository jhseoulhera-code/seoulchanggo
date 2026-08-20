import { Package } from "lucide-react";
import { categories } from "@/data/categories";
import { cn } from "@/lib/utils";

type ProductImagePlaceholderProps = {
  category: string;
  className?: string;
};

export function ProductImagePlaceholder({
  category,
  className,
}: ProductImagePlaceholderProps) {
  const Icon = categories.find((item) => item.id === category)?.icon ?? Package;

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-primary-light text-primary/40",
        className
      )}
    >
      <Icon size={28} strokeWidth={1.5} />
    </div>
  );
}
