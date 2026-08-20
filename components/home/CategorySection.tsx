import { SectionHeading } from "@/components/common/SectionHeading";
import { categories } from "@/data/categories";

export function CategorySection() {
  return (
    <section>
      <SectionHeading title="카테고리" />
      <div className="mt-3 grid grid-cols-5 gap-y-4 md:grid-cols-10">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              type="button"
              className="flex cursor-not-allowed flex-col items-center gap-1.5 py-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <span className="text-center text-[11px] leading-tight text-text-secondary">
                {category.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
