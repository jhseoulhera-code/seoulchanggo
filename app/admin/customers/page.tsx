import Link from "next/link";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { listAdminCustomers } from "@/lib/repositories/admin/customers";
import { formatCurrency } from "@/lib/currency";

export default async function AdminCustomersPage() {
  let customers: Awaited<ReturnType<typeof listAdminCustomers>> | null = null;
  let errorMessage: string | null = null;
  try {
    customers = await listAdminCustomers();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "회원 목록을 불러오지 못했습니다.";
  }

  if (errorMessage || !customers) {
    return <AdminErrorScreen message={errorMessage ?? "회원 목록을 불러오지 못했습니다."} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-text-main">회원관리</h1>
      <p className="text-xs text-text-secondary">총 {customers.length}명</p>

      {customers.length === 0 ? (
        <p className="border border-border p-6 text-center text-sm text-text-secondary">가입한 회원이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">이메일</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">가입일</th>
                <th className="px-3 py-2">주문수</th>
                <th className="px-3 py-2">총 주문금액</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <Link href={`/admin/customers/${customer.id}`} className="font-medium text-primary underline">
                      {customer.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{customer.email}</td>
                  <td className="px-3 py-2 text-text-secondary">{customer.authProvider}</td>
                  <td className="px-3 py-2 text-text-secondary">{customer.marketCode}</td>
                  <td className="px-3 py-2 text-text-secondary">{new Date(customer.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td className="px-3 py-2 text-text-main">{customer.orderCount}건</td>
                  <td className="px-3 py-2 text-text-main">
                    {customer.totalSpentByCurrency.length > 0
                      ? customer.totalSpentByCurrency.map((t) => formatCurrency(t.amount, t.currencyCode)).join(" · ")
                      : "-"}
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
