"use client";

import { useMemo, useState } from "react";
import { processRefundAction } from "@/lib/actions/refunds";
import { computeTotalRefundAmount, isOverRefundAmount, remainingRefundableQuantity } from "@/lib/refunds/calculation";
import { isValidShippingRefundAmount } from "@/lib/refunds/shippingPolicy";
import { REFUND_REASON_CODES, REFUND_REASON_LABEL } from "@/lib/refunds/types";
import type { RefundReasonCode } from "@/lib/refunds/types";
import { formatCurrency } from "@/lib/currency";
import type { AdminOrderItem, AdminPaymentAttempt, AdminShippingGroup } from "@/types/admin";

type RefundPanelProps = {
  orderId: string;
  payments: AdminPaymentAttempt[];
  items: AdminOrderItem[];
  shippingGroups: AdminShippingGroup[];
  shippingAmount: number;
  alreadyRefundedShippingAmount: number;
};

const PRE_SHIPMENT_STATUSES = new Set(["PREPARING", "PURCHASING", "READY_TO_SHIP"]);

/**
 * STEP 26 spec sections 6/29/30 — item-level quantities and an admin-typed
 * shipping-refund amount only; the expected total is computed and shown
 * client-side purely as a fail-fast preview (via lib/refunds/calculation.ts,
 * the same pure functions admin_create_refund's SQL mirrors). The RPC, not
 * this component, is the real amount/over-refund boundary. Execution goes
 * through a plain browser confirm() (spec section 30 — no new UI framework).
 */
export function RefundPanel({ orderId, payments, items, shippingGroups, shippingAmount, alreadyRefundedShippingAmount }: RefundPanelProps) {
  const refundablePayment = useMemo(() => payments.find((p) => p.status === "PAID" || p.status === "PARTIALLY_REFUNDED"), [payments]);

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [shippingRefund, setShippingRefund] = useState(0);
  const [reasonCode, setReasonCode] = useState<RefundReasonCode>("CUSTOMER_REQUEST");
  const [reasonNote, setReasonNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!refundablePayment) return null;
  const payment = refundablePayment;

  const hasPostShipmentGroup = shippingGroups.some((group) => !PRE_SHIPMENT_STATUSES.has(group.status));
  const remainingShipping = Math.max(0, shippingAmount - alreadyRefundedShippingAmount);
  const alreadyRefundedTotal = payment.refundedAmount + payment.pendingRefundAmount;

  const selectedLines = items
    .filter((item) => (quantities[item.id] ?? 0) > 0)
    .map((item) => ({ orderItemId: item.id, quantity: quantities[item.id], unitPrice: item.unitPrice }));
  const expectedAmount = computeTotalRefundAmount(selectedLines, shippingRefund);

  function setQuantity(itemId: string, value: number, max: number) {
    const clamped = Math.max(0, Math.min(max, Math.floor(value) || 0));
    setQuantities((prev) => ({ ...prev, [itemId]: clamped }));
  }

  async function handleSubmit() {
    setError(null);
    setDone(false);

    if (selectedLines.length === 0 && shippingRefund <= 0) {
      setError("환불할 상품 또는 배송비를 선택하세요.");
      return;
    }
    if (!isValidShippingRefundAmount({ requestedShippingRefundAmount: shippingRefund, alreadyRefundedShippingAmount, orderShippingAmount: shippingAmount })) {
      setError("배송비 환불 금액이 남은 배송비를 초과합니다.");
      return;
    }
    if (isOverRefundAmount(alreadyRefundedTotal, expectedAmount, payment.amount)) {
      setError("환불 가능한 금액을 초과했습니다.");
      return;
    }

    const confirmed = window.confirm(
      `${formatCurrency(expectedAmount, payment.currencyCode)}을(를) 환불하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    setPending(true);
    const result = await processRefundAction({
      orderId,
      paymentId: payment.id,
      providerPaymentId: payment.providerPaymentId ?? "",
      lines: selectedLines.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })),
      reasonCode,
      reasonNote,
      refundShippingAmount: shippingRefund,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuantities({});
    setShippingRefund(0);
    setReasonNote("");
    setDone(true);
  }

  return (
    <section className="flex flex-col gap-3 border border-border p-3">
      <h2 className="text-sm font-bold text-text-main">환불 처리</h2>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="flex justify-between border border-border p-2 sm:flex-col sm:gap-1">
          <span className="text-text-secondary">결제금액</span>
          <span className="font-bold text-text-main">{formatCurrency(payment.amount, payment.currencyCode)}</span>
        </div>
        <div className="flex justify-between border border-border p-2 sm:flex-col sm:gap-1">
          <span className="text-text-secondary">이미 환불된 금액</span>
          <span className="text-text-main">{formatCurrency(alreadyRefundedTotal, payment.currencyCode)}</span>
        </div>
        <div className="flex justify-between border border-border p-2 sm:flex-col sm:gap-1">
          <span className="text-text-secondary">환불 가능 금액</span>
          <span className="font-bold text-primary">
            {formatCurrency(Math.max(0, payment.amount - alreadyRefundedTotal), payment.currencyCode)}
          </span>
        </div>
      </div>

      {hasPostShipmentGroup && (
        <p className="border border-red-500 bg-red-50 p-2 text-xs text-red-700">
          이미 발송된 주문입니다. 환불 후 재고는 자동 복원되지 않습니다.
        </p>
      )}

      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">상품명</th>
              <th className="px-3 py-2">주문수량</th>
              <th className="px-3 py-2">기환불수량</th>
              <th className="px-3 py-2">환불수량</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const max = remainingRefundableQuantity(item.quantity, item.refundedQuantity);
              return (
                <tr key={item.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-main">{item.productNameSnapshot}</td>
                  <td className="px-3 py-2 text-text-secondary">{item.quantity}개</td>
                  <td className="px-3 py-2 text-text-secondary">{item.refundedQuantity}개</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={quantities[item.id] ?? 0}
                      onChange={(e) => setQuantity(item.id, Number(e.target.value), max)}
                      disabled={max === 0}
                      className="w-20 border border-border px-2 py-1 text-sm outline-none disabled:bg-primary-light/30"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          배송비 환불(남은 배송비 {formatCurrency(remainingShipping, payment.currencyCode)})
          <input
            type="number"
            min={0}
            max={remainingShipping}
            value={shippingRefund}
            onChange={(e) => setShippingRefund(Math.max(0, Math.min(remainingShipping, Number(e.target.value) || 0)))}
            className="w-40 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          환불 사유
          <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as RefundReasonCode)} className="border border-border px-2 py-1.5 text-sm">
            {REFUND_REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {REFUND_REASON_LABEL[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
          메모(선택)
          <input
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            maxLength={500}
            className="min-w-[160px] border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
        <span className="text-text-secondary">예상 환불금액</span>
        <span className="font-bold text-text-main">{formatCurrency(expectedAmount, payment.currencyCode)}</span>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending}
        className="h-[38px] self-end border border-red-600 px-4 text-sm font-bold text-red-700 disabled:opacity-50"
      >
        {pending ? "처리 중..." : "환불 실행"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {done && <p className="text-xs text-primary">환불이 완료되었습니다.</p>}
    </section>
  );
}
