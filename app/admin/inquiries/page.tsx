import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { InquiryAnswerRow } from "@/components/admin/inquiries/InquiryAnswerRow";
import { listAdminInquiries, type AdminInquiryFilters } from "@/lib/repositories/admin/inquiries";

type SearchParams = Record<string, string | string[] | undefined>;

function toStr(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminInquiriesPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const filters: AdminInquiryFilters = {
    status: toStr(searchParams.status) as AdminInquiryFilters["status"],
    q: toStr(searchParams.q),
  };

  let inquiries: Awaited<ReturnType<typeof listAdminInquiries>> | null = null;
  let errorMessage: string | null = null;
  try {
    inquiries = await listAdminInquiries(filters);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "상품문의 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !inquiries) {
    return <AdminErrorScreen message={errorMessage ?? "상품문의 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">상품문의관리</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2 border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          검색(질문 내용)
          <input type="text" name="q" defaultValue={filters.q} className="w-56 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          상태
          <select name="status" defaultValue={filters.status ?? ""} className="border border-border px-2 py-1.5 text-sm">
            <option value="">전체</option>
            <option value="PENDING">답변대기</option>
            <option value="ANSWERED">답변완료</option>
          </select>
        </label>
        <button type="submit" className="h-[34px] bg-primary px-4 text-sm font-bold text-white">
          검색
        </button>
      </form>

      <p className="text-xs text-text-secondary">총 {inquiries.length}건</p>

      {inquiries.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">문의가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">작성자</th>
                <th className="px-3 py-2">질문/답변</th>
                <th className="px-3 py-2">작성일</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">처리</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <InquiryAnswerRow key={inquiry.id} inquiry={inquiry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
