import { SectionHeading } from "@/components/common/SectionHeading";
import { categories } from "@/data/categories";

export function CategorySection() {
  return (
    <section className="mt-6">
      <SectionHeading title="카테고리" />
      <div className="mt-3 grid grid-cols-4 gap-y-4 px-4 md:grid-cols-8 md:px-6">
        {categories.map((category) => (
          <div key={category.id} className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 rounded-full bg-primary-light" />
            <span className="text-center text-xs text-text-secondary">
              {category.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
