import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listAdminCoupons } from "@/lib/repositories/admin/coupons";
import { formatCurrency } from "@/lib/currency";

const DISCOUNT_TYPE_LABEL: Record<string, string> = { FIXED: "정액", PERCENT: "정률" };

export default async function AdminCouponsPage() {
  let coupons: Awaited<ReturnType<typeof listAdminCoupons>> | null = null;
  let errorMessage: string | null = null;
  try {
    coupons = await listAdminCoupons();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "쿠폰 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !coupons) {
    return <AdminErrorScreen message={errorMessage ?? "쿠폰 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-main">쿠폰관리</h1>
        <Link href="/admin/coupons/new" className="flex items-center gap-1.5 bg-primary px-4 py-2 text-sm font-bold text-white">
          <Plus size={16} />
          쿠폰 생성
        </Link>
      </div>

      {coupons.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">등록된 쿠폰이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">코드</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">할인</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">기간</th>
                <th className="px-3 py-2">사용/한도</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">수정</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-mono text-xs text-text-main">{coupon.code}</td>
                  <td className="px-3 py-2 text-text-main">{coupon.name}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {DISCOUNT_TYPE_LABEL[coupon.discountType]}{" "}
                    {coupon.discountType === "PERCENT"
                      ? `${coupon.discountValue}%`
                      : formatCurrency(coupon.discountValue, coupon.marketCode === "IN" ? "INR" : "KRW")}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{coupon.marketCode ?? "전체"}</td>
                  <td className="px-3 py-2 text-xs text-text-secondary">
                    {new Date(coupon.validFrom).toLocaleDateString("ko-KR")} ~{" "}
                    {new Date(coupon.validUntil).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-text-main">
                    {coupon.usedCount}
                    {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge label={coupon.isActive ? "활성" : "비활성"} tone={coupon.isActive ? "primary" : "default"} />
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/coupons/${coupon.id}`} className="text-primary underline">
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
