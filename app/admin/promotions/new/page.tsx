import { PromotionForm } from "@/components/admin/promotions/PromotionForm";

export default function NewAdminPromotionPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">기획전 생성</h1>
      <PromotionForm initial={null} />
      <p className="text-xs text-text-secondary">저장 후 상품을 추가할 수 있습니다.</p>
    </div>
  );
}
