"use client";

import { useState } from "react";
import { cancelUnpaidOrderAction } from "@/lib/actions/adminOrders";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PAYMENT_ATTEMPT_STATUS_LABEL, PAYMENT_PROVIDER_LABEL } from "@/lib/adminLabels";
import { formatCurrency } from "@/lib/currency";
import type { AdminPaymentAttempt } from "@/types/admin";
import type { PaymentStatusEnum } from "@/types/database";

type PaymentHistoryPanelProps = {
  orderId: string;
  paymentStatus: PaymentStatusEnum;
  payments: AdminPaymentAttempt[];
};

/**
 * Read-only by design (STEP 11 spec section 24): there is no button here
 * that sets a payment to PAID — only the confirm_payment/
 * process_webhook_payment_event RPCs can do that, and neither is reachable
 * from this admin UI. The one write action this panel offers is
 * cancel_unpaid_order, which never touches payment status either — it only
 * closes out an order that never got paid.
 */
export function PaymentHistoryPanel({ orderId, paymentStatus, payments }: PaymentHistoryPanelProps) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleCancel() {
    if (!reason.trim()) {
      setError("취소 사유를 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await cancelUnpaidOrderAction(orderId, reason.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">결제 내역</h2>

      {payments.length === 0 ? (
        <p className="border border-border p-4 text-sm text-text-secondary">결제 시도 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">금액</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">결제시각</th>
                <th className="px-3 py-2">실패 사유</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-secondary">{PAYMENT_PROVIDER_LABEL[payment.provider]}</td>
                  <td className="px-3 py-2 text-text-main">{formatCurrency(payment.amount, payment.currencyCode)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={PAYMENT_ATTEMPT_STATUS_LABEL[payment.status]}
                      tone={payment.status === "PAID" ? "primary" : payment.status === "FAILED" ? "warning" : "default"}
                    />
                  </td>
                  <td className="px-3 py-2 text-text-secondary">
                    {payment.paidAt ? new Date(payment.paidAt).toLocaleString("ko-KR") : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-text-secondary">{payment.failureMessage ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paymentStatus === "UNPAID" && !done && (
        <div className="flex flex-wrap items-end gap-2 border border-border p-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            미결제 주문 취소 사유
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-64 border border-border px-2 py-1.5 text-sm outline-none"
              placeholder="예: 결제 포기, 재고 소진 등"
            />
          </label>
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="h-[34px] border border-red-600 px-3 text-xs font-bold text-red-700 disabled:opacity-50"
          >
            {pending ? "처리 중..." : "미결제 주문 취소"}
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      )}
      {done && <p className="text-xs text-primary">주문이 취소되었습니다. 사용된 쿠폰/포인트가 환원되었습니다.</p>}
    </section>
  );
}
