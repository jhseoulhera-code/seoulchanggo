"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { createRefundReservation, finalizeRefund } from "@/lib/repositories/admin/refunds";
import { getPaymentAdapter } from "@/lib/payments/registry";
import type { RefundLineInput, RefundReasonCode } from "@/lib/refunds/types";

export type ProcessRefundInput = {
  orderId: string;
  paymentId: string;
  providerPaymentId: string;
  lines: RefundLineInput[];
  reasonCode: RefundReasonCode;
  reasonNote: string;
  refundShippingAmount: number;
};

export type ProcessRefundResult = { ok: true; status: string } | { ok: false; error: string };

/**
 * STEP 26 spec sections 6-25 — the full reserve → provider-call → finalize
 * pipeline, mirroring the prepare_payment/confirm_payment split already
 * established for payments. Every amount comes back from
 * admin_create_refund's own server-side computation (order_items snapshot ×
 * quantity, capped against remaining refundable quantity/amount) — this
 * action never trusts a client-sent refund amount, only which order items
 * and how much quantity to refund.
 */
export async function processRefundAction(input: ProcessRefundInput): Promise<ProcessRefundResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }

  // STEP 26 spec section 12 — one idempotency key per button click. A true
  // double-submit (two clicks, two keys) is still caught by
  // admin_create_refund's own quantity/amount caps — this key only protects
  // against the SAME request being retried (e.g. a network retry).
  const idempotencyKey = randomUUID();

  const reservation = await createRefundReservation({
    paymentId: input.paymentId,
    lines: input.lines,
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote,
    refundShippingAmount: input.refundShippingAmount,
    idempotencyKey,
  });
  if (!reservation.ok) return reservation;

  const adapter = getPaymentAdapter(reservation.provider);
  const providerResult = await adapter.refundPayment({
    refundId: reservation.refundId,
    providerPaymentId: input.providerPaymentId,
    amount: reservation.amount,
    currencyCode: reservation.currencyCode,
    reason: input.reasonNote || input.reasonCode,
  });

  const finalized = await finalizeRefund({
    refundId: reservation.refundId,
    success: providerResult.ok,
    providerRefundId: providerResult.ok ? providerResult.providerRefundId : null,
    amount: providerResult.ok ? providerResult.amount : null,
    currencyCode: providerResult.ok ? providerResult.currencyCode : null,
    failureCode: providerResult.ok ? null : providerResult.failureCode,
    failureMessage: providerResult.ok ? null : providerResult.error,
  });

  revalidatePath(`/admin/orders/${input.orderId}`);
  revalidatePath("/admin/orders");

  if (!finalized.ok) return finalized;
  if (!providerResult.ok) return { ok: false, error: providerResult.error };
  if (finalized.status !== "COMPLETED") {
    return { ok: false, error: "환불 결과를 확정하지 못했습니다. 금액/통화를 다시 확인해주세요." };
  }

  return { ok: true, status: finalized.status };
}
