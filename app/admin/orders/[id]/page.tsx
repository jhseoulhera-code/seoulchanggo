import { AlertTriangle } from "lucide-react";
import { notFound } from "next/navigation";
import { AdminErrorScreen } from "@/components/admin/AdminBlockerScreen";
import { AdminNoteEditor } from "@/components/admin/orders/AdminNoteEditor";
import { PaymentHistoryPanel } from "@/components/admin/orders/PaymentHistoryPanel";
import { RefundPanel } from "@/components/admin/orders/RefundPanel";
import { ShippingGroupEditor } from "@/components/admin/orders/ShippingGroupEditor";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getAdminOrderDetail } from "@/lib/repositories/admin/orders";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";
import { REFUND_REASON_LABEL } from "@/lib/refunds/types";

const RECONCILIATION_ISSUE_LABEL: Record<string, string> = {
  PROVIDER_PAID_LOCAL_STOCK_FAILURE: "결제는 승인되었으나 재고 부족으로 확정 실패 — 결제/이행 상태 확인 필요",
  AMOUNT_MISMATCH: "결제 금액 불일치 감지 — 확인 필요",
  CURRENCY_MISMATCH: "결제 통화 불일치 감지 — 확인 필요",
  PROVIDER_REFUNDED_LOCAL_PENDING: "환불 요청이 오래 처리 중입니다 — provider에서 실제로 환불되었는지 확인 필요",
  REFUND_AMOUNT_MISMATCH: "환불 금액/통화 불일치로 실패한 환불 건이 있습니다 — 확인 필요",
};

const REFUND_STATUS_LABEL: Record<string, string> = {
  PENDING: "처리중",
  COMPLETED: "완료",
  FAILED: "실패",
};

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

      {order.reconciliationWarnings.length > 0 && (
        <section className="flex flex-col gap-2 border border-red-500 bg-red-50 p-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-red-700">
            <AlertTriangle className="h-4 w-4" />
            결제 상태 확인 필요
          </h2>
          <ul className="flex flex-col gap-1 text-xs text-red-700">
            {order.reconciliationWarnings.map((warning) => (
              <li key={warning.paymentId}>{RECONCILIATION_ISSUE_LABEL[warning.issue] ?? warning.issue}</li>
            ))}
          </ul>
        </section>
      )}

      <PaymentHistoryPanel orderId={order.id} paymentStatus={order.paymentStatus} payments={order.payments} />

      {order.paymentStatus === "PAID" && (
        <RefundPanel
          orderId={order.id}
          payments={order.payments}
          items={order.items}
          shippingGroups={order.shippingGroups}
          shippingAmount={order.shippingAmount}
          alreadyRefundedShippingAmount={order.refunds
            .filter((refund) => refund.status === "PENDING" || refund.status === "COMPLETED")
            .reduce((sum, refund) => sum + refund.refundShippingAmount, 0)}
        />
      )}

      {order.refunds.length > 0 && (
        <section className="flex flex-col gap-2 border border-border p-3">
          <h2 className="text-sm font-bold text-text-main">환불 이력</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-border text-text-secondary">
                <tr>
                  <th className="px-2 py-1.5">요청일시</th>
                  <th className="px-2 py-1.5">상태</th>
                  <th className="px-2 py-1.5">금액</th>
                  <th className="px-2 py-1.5">사유</th>
                  <th className="px-2 py-1.5">완료일시</th>
                </tr>
              </thead>
              <tbody>
                {order.refunds.map((refund) => (
                  <tr key={refund.id} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-1.5 text-text-secondary">{new Date(refund.createdAt).toLocaleString("ko-KR")}</td>
                    <td className="px-2 py-1.5 text-text-main">{REFUND_STATUS_LABEL[refund.status] ?? refund.status}</td>
                    <td className="px-2 py-1.5 text-text-main">{formatCurrency(refund.amount, refund.currencyCode)}</td>
                    <td className="px-2 py-1.5 text-text-secondary">
                      {REFUND_REASON_LABEL[refund.reasonCode]}
                      {refund.reason ? ` · ${refund.reason}` : ""}
                    </td>
                    <td className="px-2 py-1.5 text-text-secondary">
                      {refund.completedAt ? new Date(refund.completedAt).toLocaleString("ko-KR") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold text-text-main">배송그룹</h2>
        {order.shippingGroups.length === 0 ? (
          <p className="border border-border p-4 text-sm text-text-secondary">배송그룹이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {order.shippingGroups.map((group) => (
              <ShippingGroupEditor
                key={group.id}
                orderId={order.id}
                group={group}
                orderPaid={order.paymentStatus === "PAID"}
              />
            ))}
          </div>
        )}
      </section>

      <AdminNoteEditor orderId={order.id} initialNote={order.adminNote} />

      {order.statusHistory.length > 0 && (
        <section className="flex flex-col gap-2 border border-border p-3">
          <h2 className="text-sm font-bold text-text-main">상태 변경 이력 (관리자 전용)</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-border text-text-secondary">
                <tr>
                  <th className="px-2 py-1.5">일시</th>
                  <th className="px-2 py-1.5">대상</th>
                  <th className="px-2 py-1.5">이전 상태</th>
                  <th className="px-2 py-1.5">변경 상태</th>
                </tr>
              </thead>
              <tbody>
                {order.statusHistory.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-1.5 text-text-secondary">{new Date(entry.createdAt).toLocaleString("ko-KR")}</td>
                    <td className="px-2 py-1.5 text-text-secondary">{entry.shippingGroupId ? "배송그룹" : "주문 전체"}</td>
                    <td className="px-2 py-1.5 text-text-main">{entry.fromStatus ?? "-"}</td>
                    <td className="px-2 py-1.5 text-text-main">{entry.toStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
