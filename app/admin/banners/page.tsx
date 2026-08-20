import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { BannerManager } from "@/components/admin/banners/BannerManager";
import { listAdminBanners } from "@/lib/repositories/admin/banners";

export default async function AdminBannersPage() {
  let banners: Awaited<ReturnType<typeof listAdminBanners>> | null = null;
  let errorMessage: string | null = null;
  try {
    banners = await listAdminBanners();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "배너 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !banners) {
    return <AdminErrorScreen message={errorMessage ?? "배너 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">배너관리</h1>
      <BannerManager banners={banners} />
    </div>
  );
}
