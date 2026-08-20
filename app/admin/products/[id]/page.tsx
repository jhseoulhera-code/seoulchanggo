import { notFound } from "next/navigation";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { ImageManager } from "@/components/admin/products/ImageManager";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { VariantManager } from "@/components/admin/products/VariantManager";
import { listAdminCategories } from "@/lib/repositories/admin/categories";
import { getAdminProductDetail } from "@/lib/repositories/admin/products";

export default async function EditAdminProductPage(props: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-lg font-bold text-text-main">상품 수정</h1>
      <ProductForm initialDetail={detail} categories={categories} />
      <VariantManager productId={id} variants={detail.variants} />
      <ImageManager productId={id} images={detail.images} />
    </div>
  );
}
