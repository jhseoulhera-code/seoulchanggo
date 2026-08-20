import Link from "next/link";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { StatTile } from "@/components/admin/StatTile";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminDashboardStats, getAdminLowStockItems, getAdminRecentOrders } from "@/lib/repositories/admin/dashboard";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";

async function loadDashboardData() {
  const [stats, lowStock, recentOrders] = await Promise.all([
    getAdminDashboardStats(),
    getAdminLowStockItems(),
    getAdminRecentOrders(),
  ]);
  return { stats, lowStock, recentOrders };
}

export default async function AdminDashboardPage() {
  let data: Awaited<ReturnType<typeof loadDashboardData>> | null = null;
  let errorMessage: string | null = null;
  try {
    data = await loadDashboardData();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "대시보드를 불러오지 못했습니다.";
  }

  if (errorMessage || !data) {
    return <AdminErrorScreen message={errorMessage ?? "대시보드를 불러오지 못했습니다."} />;
  }

  const { stats, lowStock, recentOrders } = data;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-lg font-bold text-text-main">대시보드</h1>
        <p className="mt-1 text-sm text-text-secondary">
          오늘 주문{" "}
          {stats.todayRevenueByCurrency.length > 0
            ? stats.todayRevenueByCurrency.map((r) => formatCurrency(r.amount, r.currencyCode)).join(" · ")
            : "0원"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="오늘 주문수" value={`${stats.todayOrderCount}건`} />
        <StatTile label="결제대기" value={`${stats.paymentPendingCount}건`} />
        <StatTile label="상품준비중" value={`${stats.preparingCount}건`} />
        <StatTile label="배송중" value={`${stats.shippingCount}건`} />
        <StatTile label="취소/반품 요청" value={`${stats.cancelReturnRequestCount}건`} />
        <StatTile label="재고부족 상품" value={`${stats.lowStockCount}건`} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-main">재고 경고</h2>
          <Link href="/admin/inventory" className="text-xs text-primary underline">
            재고관리 전체보기
          </Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="border border-border p-4 text-sm text-text-secondary">재고 부족 상품이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">상품</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">재고</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((item) => (
                  <tr key={`${item.productId}-${item.variantId ?? "base"}`} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-text-main">{item.label}</td>
                    <td className="px-3 py-2 text-text-secondary">{item.sku}</td>
                    <td className="px-3 py-2 text-text-main">{item.stockQuantity}개</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={item.status === "OUT" ? "품절" : "재고 부족"} tone="warning" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-main">최근 주문</h2>
          <Link href="/admin/orders" className="text-xs text-primary underline">
            주문관리 전체보기
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="border border-border p-4 text-sm text-text-secondary">아직 주문이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">주문번호</th>
                  <th className="px-3 py-2">주문일</th>
                  <th className="px-3 py-2">고객</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">총금액</th>
                  <th className="px-3 py-2">결제상태</th>
                  <th className="px-3 py-2">주문상태</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {new Date(order.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-3 py-2 text-text-main">{order.customerName}</td>
                    <td className="px-3 py-2 text-text-secondary">{order.marketCode}</td>
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
      </section>
    </div>
  );
}
