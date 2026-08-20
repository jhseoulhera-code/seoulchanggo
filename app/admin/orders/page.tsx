import Link from "next/link";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { OrderFilterBar } from "@/components/admin/orders/OrderFilterBar";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { listAdminOrders } from "@/lib/repositories/admin/orders";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";

type SearchParams = Record<string, string | string[] | undefined>;

function toStr(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const filters = {
    q: toStr(searchParams.q),
    marketCode: toStr(searchParams.marketCode),
    paymentStatus: toStr(searchParams.paymentStatus),
    orderStatus: toStr(searchParams.orderStatus),
  };

  let orders: Awaited<ReturnType<typeof listAdminOrders>> | null = null;
  let errorMessage: string | null = null;
  try {
    orders = await listAdminOrders(filters);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "주문 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !orders) {
    return <AdminErrorScreen message={errorMessage ?? "주문 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">주문관리</h1>

      <OrderFilterBar current={filters} />

      <p className="text-xs text-text-secondary">총 {orders.length}건</p>

      {orders.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">조건에 맞는 주문이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">주문번호</th>
                <th className="px-3 py-2">주문일</th>
                <th className="px-3 py-2">고객</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">배송국가</th>
                <th className="px-3 py-2">상품수</th>
                <th className="px-3 py-2">총금액</th>
                <th className="px-3 py-2">결제상태</th>
                <th className="px-3 py-2">주문상태</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
