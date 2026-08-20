import { notFound } from "next/navigation";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { PromotionForm } from "@/components/admin/promotions/PromotionForm";
import { PromotionProductManager } from "@/components/admin/promotions/PromotionProductManager";
import { getAdminPromotionDetail } from "@/lib/repositories/admin/promotions";

export default async function EditAdminPromotionPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let promotion: Awaited<ReturnType<typeof getAdminPromotionDetail>> | null = null;
  let errorMessage: string | null = null;
  try {
    promotion = await getAdminPromotionDetail(id);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "기획전 정보를 불러오지 못했습니다.";
  }

  if (errorMessage) {
    return <AdminErrorScreen message={errorMessage} />;
  }
  if (!promotion) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-text-main">기획전 수정</h1>
      <PromotionForm initial={promotion} />
      <PromotionProductManager promotionId={id} products={promotion.products} />
    </div>
  );
}
