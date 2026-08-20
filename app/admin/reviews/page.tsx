import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { ReviewStatusButton } from "@/components/admin/reviews/ReviewStatusButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listAdminReviews, type AdminReviewFilters } from "@/lib/repositories/admin/reviews";

type SearchParams = Record<string, string | string[] | undefined>;

function toStr(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_LABEL: Record<string, string> = { PUBLISHED: "노출중", HIDDEN: "숨김", REPORTED: "신고됨" };

export default async function AdminReviewsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const filters: AdminReviewFilters = {
    status: toStr(searchParams.status) as AdminReviewFilters["status"],
    rating: toStr(searchParams.rating) ? Number(toStr(searchParams.rating)) : undefined,
    q: toStr(searchParams.q),
  };

  let reviews: Awaited<ReturnType<typeof listAdminReviews>> | null = null;
  let errorMessage: string | null = null;
  try {
    reviews = await listAdminReviews(filters);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "리뷰 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !reviews) {
    return <AdminErrorScreen message={errorMessage ?? "리뷰 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">리뷰관리</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2 border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          검색(내용)
          <input type="text" name="q" defaultValue={filters.q} className="w-48 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          평점
          <select name="rating" defaultValue={filters.rating ?? ""} className="border border-border px-2 py-1.5 text-sm">
            <option value="">전체</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r}점
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          상태
          <select name="status" defaultValue={filters.status ?? ""} className="border border-border px-2 py-1.5 text-sm">
            <option value="">전체</option>
            <option value="PUBLISHED">노출중</option>
            <option value="HIDDEN">숨김</option>
            <option value="REPORTED">신고됨</option>
          </select>
        </label>
        <button type="submit" className="h-[34px] bg-primary px-4 text-sm font-bold text-white">
          검색
        </button>
      </form>

      <p className="text-xs text-text-secondary">총 {reviews.length}건</p>

      {reviews.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">조건에 맞는 리뷰가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">평점</th>
                <th className="px-3 py-2">작성자</th>
                <th className="px-3 py-2">내용</th>
                <th className="px-3 py-2">작성일</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">처리</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-main">{review.productNameKo}</td>
                  <td className="px-3 py-2 text-text-secondary">{review.rating}점</td>
                  <td className="px-3 py-2 text-text-secondary">{review.authorName}</td>
                  <td className="px-3 py-2 text-text-main">
                    <span className="line-clamp-1 max-w-[280px]">{review.content}</span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{new Date(review.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td className="px-3 py-2">
                    <StatusBadge label={STATUS_LABEL[review.status]} tone={review.status === "PUBLISHED" ? "primary" : "warning"} />
                  </td>
                  <td className="px-3 py-2">
                    <ReviewStatusButton id={review.id} status={review.status} />
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
