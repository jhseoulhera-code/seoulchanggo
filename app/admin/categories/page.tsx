import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { CategoryManager } from "@/components/admin/categories/CategoryManager";
import { HomeCurationManager } from "@/components/admin/categories/HomeCurationManager";
import { listAdminCategories } from "@/lib/repositories/admin/categories";
import { listAdminHomeSections } from "@/lib/repositories/admin/homeSections";

export default async function AdminCategoriesPage() {
  let categories: Awaited<ReturnType<typeof listAdminCategories>> | null = null;
  let sections: Awaited<ReturnType<typeof listAdminHomeSections>> | null = null;
  let errorMessage: string | null = null;
  try {
    [categories, sections] = await Promise.all([listAdminCategories(), listAdminHomeSections()]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "카테고리 정보를 불러오지 못했습니다.";
  }

  if (errorMessage || !categories || !sections) {
    return <AdminErrorScreen message={errorMessage ?? "카테고리 정보를 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-lg font-bold text-text-main">카테고리 관리</h1>
      <CategoryManager categories={categories} />
      <HomeCurationManager sections={sections} />
    </div>
  );
}
