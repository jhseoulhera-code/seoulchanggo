import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { CsvImportWizard } from "@/components/admin/products/CsvImportWizard";
import { listAdminCategories } from "@/lib/repositories/admin/categories";

export default async function AdminProductImportPage() {
  let categories: Awaited<ReturnType<typeof listAdminCategories>> | null = null;
  let errorMessage: string | null = null;
  try {
    categories = await listAdminCategories();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "카테고리를 불러오지 못했습니다.";
  }

  if (errorMessage || !categories) {
    return <AdminErrorScreen message={errorMessage ?? "카테고리를 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">상품 CSV 일괄등록</h1>
      <CsvImportWizard categories={categories} />
    </div>
  );
}
