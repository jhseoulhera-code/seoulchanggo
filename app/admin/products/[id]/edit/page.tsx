import { notFound } from "next/navigation";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { ProductWizard } from "@/components/admin/products/wizard/ProductWizard";
import { listAdminCategories } from "@/lib/repositories/admin/categories";
import { getAdminProductDetail } from "@/lib/repositories/admin/products";

export default async function EditAdminProductWizardPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let detail: Awaited<ReturnType<typeof getAdminProductDetail>> | null = null;
  let categories: Awaited<ReturnType<typeof listAdminCategories>> | null = null;
  let errorMessage: string | null = null;
  try {
    [detail, categories] = await Promise.all([getAdminProductDetail(id), listAdminCategories()]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "상품 정보를 불러오지 못했습니다.";
  }

  if (errorMessage || !categories) {
    return <AdminErrorScreen message={errorMessage ?? "상품 정보를 불러오지 못했습니다."} />;
  }
  if (!detail) notFound();

  return <ProductWizard initialDetail={detail} categories={categories} mode="edit" />;
}
