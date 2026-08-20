import { notFound } from "next/navigation";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { CouponForm } from "@/components/admin/coupons/CouponForm";
import { listAdminCategories } from "@/lib/repositories/admin/categories";
import { getAdminCouponDetail } from "@/lib/repositories/admin/coupons";
import { getAdminProductNamesByIds } from "@/lib/repositories/admin/products";

export default async function EditAdminCouponPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let coupon: Awaited<ReturnType<typeof getAdminCouponDetail>> | null = null;
  let categories: Awaited<ReturnType<typeof listAdminCategories>> | null = null;
  let productNamesById: Record<string, string> = {};
  let errorMessage: string | null = null;
  try {
    [coupon, categories] = await Promise.all([getAdminCouponDetail(id), listAdminCategories()]);
    if (coupon) productNamesById = await getAdminProductNamesByIds(coupon.productIds);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "쿠폰 정보를 불러오지 못했습니다.";
  }

  if (errorMessage || !categories) {
    return <AdminErrorScreen message={errorMessage ?? "쿠폰 정보를 불러오지 못했습니다."} />;
  }
  if (!coupon) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">쿠폰 수정</h1>
      <CouponForm initial={coupon} categories={categories} productNamesById={productNamesById} />
    </div>
  );
}
