import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { SearchKeywordManager } from "@/components/admin/searchKeywords/SearchKeywordManager";
import { listAdminSearchKeywords } from "@/lib/repositories/admin/searchKeywords";

export default async function AdminSearchKeywordsPage() {
  let keywords: Awaited<ReturnType<typeof listAdminSearchKeywords>> | null = null;
  let errorMessage: string | null = null;
  try {
    keywords = await listAdminSearchKeywords();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "검색어 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !keywords) {
    return <AdminErrorScreen message={errorMessage ?? "검색어 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">검색어관리</h1>
      <SearchKeywordManager keywords={keywords} />
    </div>
  );
}
