import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { NoticeManager } from "@/components/admin/notices/NoticeManager";
import { listAdminNotices } from "@/lib/repositories/admin/notices";

export default async function AdminNoticesPage() {
  let notices: Awaited<ReturnType<typeof listAdminNotices>> | null = null;
  let errorMessage: string | null = null;
  try {
    notices = await listAdminNotices();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "공지사항 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !notices) {
    return <AdminErrorScreen message={errorMessage ?? "공지사항 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">공지사항관리</h1>
      <NoticeManager notices={notices} />
    </div>
  );
}
