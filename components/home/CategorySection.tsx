import Link from "next/link";
import { SectionHeading } from "@/components/common/SectionHeading";
import { getHomeCategories } from "@/lib/repositories/categories";

export async function CategorySection() {
  const categories = await getHomeCategories();

  return (
    <section>
      <SectionHeading title="카테고리" />
      <div className="mt-3 grid grid-cols-5 gap-y-4 md:grid-cols-10">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              key={category.id}
              href={`/category/${category.id}`}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
                <Icon size={22} strokeWidth={1.5} />
              </span>
              <span className="text-center text-[11px] leading-tight text-text-secondary">
                {category.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
