import Link from "next/link";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { OrderFilterBar } from "@/components/admin/orders/OrderFilterBar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listAdminOrders } from "@/lib/repositories/admin/orders";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, SHIPPING_GROUP_STATUS_LABEL, SHIPPING_TYPE_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";

type SearchParams = Record<string, string | string[] | undefined>;

function toStr(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const PAGE_SIZE = 20;

export default async function AdminOrdersPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const filters = {
    q: toStr(searchParams.q),
    marketCode: toStr(searchParams.marketCode),
    paymentStatus: toStr(searchParams.paymentStatus),
    orderStatus: toStr(searchParams.orderStatus),
    shippingStatus: toStr(searchParams.shippingStatus),
    shippingType: toStr(searchParams.shippingType),
    dateFrom: toStr(searchParams.dateFrom),
    dateTo: toStr(searchParams.dateTo),
  };
  const page = Math.max(1, Number(toStr(searchParams.page)) || 1);

  let result: Awaited<ReturnType<typeof listAdminOrders>> | null = null;
  let errorMessage: string | null = null;
  try {
    result = await listAdminOrders({
      ...filters,
      // A plain date input's value has no time component — extending it to
      // end-of-day keeps "기간(종료)" inclusive of that whole day, not just its midnight instant.
      dateTo: filters.dateTo ? `${filters.dateTo}T23:59:59.999Z` : undefined,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "주문 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !result) {
    return <AdminErrorScreen message={errorMessage ?? "주문 목록을 불러오지 못했습니다."} />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const buildPageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">주문관리</h1>

      <OrderFilterBar current={filters} />

      <p className="text-xs text-text-secondary">
        총 {result.total}건 · {result.page}/{totalPages}페이지
      </p>

      {result.items.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">조건에 맞는 주문이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">주문번호</th>
                <th className="px-3 py-2">주문일</th>
                <th className="px-3 py-2">고객</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">배송국가</th>
                <th className="px-3 py-2">배송유형</th>
                <th className="px-3 py-2">상품수</th>
                <th className="px-3 py-2">총금액</th>
                <th className="px-3 py-2">결제상태</th>
                <th className="px-3 py-2">주문상태</th>
                <th className="px-3 py-2">배송상태</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary underline">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{new Date(order.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td className="px-3 py-2 text-text-main">
                    {order.customerName}
                    {order.isGuest && <span className="ml-1 text-xs text-text-secondary">(비회원)</span>}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{order.marketCode}</td>
                  <td className="px-3 py-2 text-text-secondary">{order.destinationCountries.join(", ") || "-"}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {(order.shippingTypes ?? []).map((type) => SHIPPING_TYPE_LABEL[type] ?? type).join(", ") || "-"}
                  </td>
                  <td className="px-3 py-2 text-text-main">{order.itemCount}개</td>
                  <td className="px-3 py-2 text-text-main">{formatCurrency(order.totalAmount, order.currencyCode)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={PAYMENT_STATUS_LABEL[order.paymentStatus]}
                      tone={order.paymentStatus === "PAID" ? "primary" : "default"}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge label={ORDER_STATUS_LABEL[order.orderStatus]} />
                  </td>
                  <td className="px-3 py-2 text-xs text-text-secondary">
                    {(order.shippingStatuses ?? []).map((status) => SHIPPING_GROUP_STATUS_LABEL[status] ?? status).join(", ") || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Link
            href={buildPageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : "text-text-main"}`}
          >
            이전
          </Link>
          <span className="text-text-secondary">
            {page} / {totalPages}
          </span>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`border border-border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none opacity-40" : "text-text-main"}`}
          >
            다음
          </Link>
        </div>
      )}
    </div>
  );
}
