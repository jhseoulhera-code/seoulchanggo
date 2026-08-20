import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminCustomerDetail } from "@/lib/repositories/admin/customers";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5 text-sm last:border-b-0">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-main">{value}</span>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  CUSTOMER: "일반회원",
  ADMIN: "관리자",
  SUPER_ADMIN: "최고관리자",
};

export default async function AdminCustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let customer: Awaited<ReturnType<typeof getAdminCustomerDetail>> | null = null;
  let errorMessage: string | null = null;
  try {
    customer = await getAdminCustomerDetail(id);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "회원 정보를 불러오지 못했습니다.";
  }

  if (errorMessage) {
    return <AdminErrorScreen message={errorMessage} />;
  }
  if (!customer) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-bold text-text-main">회원 상세</h1>

      <section className="border border-border p-3 md:w-96">
        <h2 className="mb-2 text-sm font-bold text-text-main">Profile</h2>
        <InfoRow label="이름" value={customer.displayName} />
        <InfoRow label="이메일" value={customer.email} />
        <InfoRow label="Provider" value={customer.authProvider} />
        <InfoRow label="Market" value={customer.marketCode} />
        <InfoRow label="언어" value={customer.localeCode} />
        <InfoRow label="마케팅 수신동의" value={customer.marketingOptIn ? "동의" : "미동의"} />
        <InfoRow label="권한" value={ROLE_LABEL[customer.role] ?? customer.role} />
        <InfoRow label="가입일" value={new Date(customer.createdAt).toLocaleDateString("ko-KR")} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">주문 내역 ({customer.orderCount}건)</h2>
        {customer.orders.length === 0 ? (
          <p className="border border-border p-4 text-sm text-text-secondary">주문 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">주문번호</th>
                  <th className="px-3 py-2">주문일</th>
                  <th className="px-3 py-2">총금액</th>
                  <th className="px-3 py-2">결제상태</th>
                  <th className="px-3 py-2">주문상태</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{new Date(order.createdAt).toLocaleDateString("ko-KR")}</td>
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
