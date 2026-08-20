import { notFound } from "next/navigation";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { PaymentHistoryPanel } from "@/components/admin/orders/PaymentHistoryPanel";
import { ShippingGroupEditor } from "@/components/admin/orders/ShippingGroupEditor";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminOrderDetail } from "@/lib/repositories/admin/orders";
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

export default async function AdminOrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  let order: Awaited<ReturnType<typeof getAdminOrderDetail>> | null = null;
  let errorMessage: string | null = null;
  try {
    order = await getAdminOrderDetail(id);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "주문 정보를 불러오지 못했습니다.";
  }

  if (errorMessage) {
    return <AdminErrorScreen message={errorMessage} />;
  }
  if (!order) notFound();

  const address = order.shippingAddress as {
    recipientName?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    deliveryMemo?: string;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-text-main">주문 상세</h1>
          <p className="text-sm text-text-secondary">{order.orderNumber}</p>
        </div>
        <div className="flex gap-2">
          <StatusBadge label={PAYMENT_STATUS_LABEL[order.paymentStatus]} tone={order.paymentStatus === "PAID" ? "primary" : "default"} />
          <StatusBadge label={ORDER_STATUS_LABEL[order.orderStatus]} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-border p-3">
          <h2 className="mb-2 text-sm font-bold text-text-main">주문정보</h2>
          <InfoRow label="주문번호" value={order.orderNumber} />
          <InfoRow label="주문일" value={new Date(order.createdAt).toLocaleString("ko-KR")} />
          <InfoRow label="결제수단" value={order.paymentMethod} />
          <InfoRow label="결제상태" value={PAYMENT_STATUS_LABEL[order.paymentStatus]} />
          <InfoRow label="주문상태" value={ORDER_STATUS_LABEL[order.orderStatus]} />
          <InfoRow label="Market" value={order.marketCode} />
        </section>

        <section className="border border-border p-3">
          <h2 className="mb-2 text-sm font-bold text-text-main">고객정보</h2>
          <InfoRow label="고객명" value={order.customerName} />
          <InfoRow label="이메일" value={order.customerEmail} />
          <InfoRow label="연락처" value={order.customerPhone} />
          <InfoRow label="회원구분" value={order.isGuest ? "비회원" : "회원"} />
        </section>

        <section className="border border-border p-3 md:col-span-2">
          <h2 className="mb-2 text-sm font-bold text-text-main">배송정보</h2>
          <InfoRow label="수령인" value={address.recipientName ?? "-"} />
          <InfoRow label="연락처" value={address.phone ?? "-"} />
          <InfoRow label="주소" value={[address.line1, address.line2, address.city, address.postalCode].filter(Boolean).join(" ") || "-"} />
          <InfoRow label="배송메모" value={address.deliveryMemo ?? "-"} />
          {order.customsCode && <InfoRow label="개인통관고유부호" value={order.customsCode} />}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">주문 상품</h2>
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">상품명</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">옵션</th>
                <th className="px-3 py-2">수량</th>
                <th className="px-3 py-2">단가</th>
                <th className="px-3 py-2">합계</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-main">{item.productNameSnapshot}</td>
                  <td className="px-3 py-2 text-text-secondary">{item.skuSnapshot}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {Object.values(item.optionSnapshot).join(" / ") || "-"}
                  </td>
                  <td className="px-3 py-2 text-text-main">{item.quantity}개</td>
                  <td className="px-3 py-2 text-text-main">{formatCurrency(item.unitPrice, order.currencyCode)}</td>
                  <td className="px-3 py-2 text-text-main">{formatCurrency(item.unitPrice * item.quantity, order.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2 border border-border p-3 md:w-80 md:self-end">
        <h2 className="text-sm font-bold text-text-main">금액</h2>
        <InfoRow label="상품금액" value={formatCurrency(order.subtotal, order.currencyCode)} />
        <InfoRow label="할인금액" value={formatCurrency(-order.discountAmount, order.currencyCode)} />
        <InfoRow label="배송비" value={formatCurrency(order.shippingAmount, order.currencyCode)} />
        <div className="flex justify-between pt-1.5 text-sm font-bold">
          <span className="text-text-main">총 결제금액</span>
          <span className="text-primary">{formatCurrency(order.totalAmount, order.currencyCode)}</span>
        </div>
      </section>

      <PaymentHistoryPanel orderId={order.id} paymentStatus={order.paymentStatus} payments={order.payments} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">배송그룹</h2>
        {order.shippingGroups.length === 0 ? (
          <p className="border border-border p-4 text-sm text-text-secondary">배송그룹이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {order.shippingGroups.map((group) => (
              <ShippingGroupEditor key={group.id} orderId={order.id} group={group} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
