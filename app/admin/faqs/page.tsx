import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { FaqManager } from "@/components/admin/faqs/FaqManager";
import { listAdminFaqs } from "@/lib/repositories/admin/faqs";

export default async function AdminFaqsPage() {
  let faqs: Awaited<ReturnType<typeof listAdminFaqs>> | null = null;
  let errorMessage: string | null = null;
  try {
    faqs = await listAdminFaqs();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "FAQ 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !faqs) {
    return <AdminErrorScreen message={errorMessage ?? "FAQ 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">FAQ관리</h1>
      <FaqManager faqs={faqs} />
    </div>
  );
}
