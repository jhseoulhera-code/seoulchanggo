import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listAdminPromotions } from "@/lib/repositories/admin/promotions";

export default async function AdminPromotionsPage() {
  let promotions: Awaited<ReturnType<typeof listAdminPromotions>> | null = null;
  let errorMessage: string | null = null;
  try {
    promotions = await listAdminPromotions();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "기획전 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !promotions) {
    return <AdminErrorScreen message={errorMessage ?? "기획전 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-main">기획전관리</h1>
        <Link href="/admin/promotions/new" className="flex items-center gap-1.5 bg-primary px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          기획전 생성
        </Link>
      </div>

      {promotions.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">등록된 기획전이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">제목</th>
                <th className="px-3 py-2">slug</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">상품수</th>
                <th className="px-3 py-2">기간</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">수정</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promotion) => (
                <tr key={promotion.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-main">{promotion.titleKo}</td>
                  <td className="px-3 py-2 font-mono text-xs text-text-secondary">{promotion.slug}</td>
                  <td className="px-3 py-2 text-text-secondary">{promotion.marketCode ?? "전체"}</td>
                  <td className="px-3 py-2 text-text-main">{promotion.products.length}개</td>
                  <td className="px-3 py-2 text-xs text-text-secondary">
                    {promotion.startsAt ? new Date(promotion.startsAt).toLocaleDateString("ko-KR") : "-"} ~{" "}
                    {promotion.endsAt ? new Date(promotion.endsAt).toLocaleDateString("ko-KR") : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge label={promotion.isActive ? "활성" : "비활성"} tone={promotion.isActive ? "primary" : "default"} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/promotions/${promotion.id}`} className="text-primary underline">
                      수정
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
