import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { RefundLineInput, RefundReasonCode } from "@/lib/refunds/types";
import type { CurrencyCodeEnum, PaymentProviderEnum } from "@/types/database";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/refunds] ${context} failed:`, error.message);
  throw new Error("환불 데이터를 처리하지 못했습니다.");
}

export type CreateRefundReservationInput = {
  paymentId: string;
  lines: RefundLineInput[];
  reasonCode: RefundReasonCode;
  reasonNote: string;
  refundShippingAmount: number;
  idempotencyKey: string;
};

export type CreateRefundReservationResult =
  | { ok: true; refundId: string; amount: number; provider: PaymentProviderEnum; currencyCode: CurrencyCodeEnum }
  | { ok: false; error: string };

/**
 * STEP 26 spec section 6-12 — the "reserve" half. Computes/validates the
 * refund amount server-side (admin_create_refund never trusts a client-sent
 * amount) and returns the payment's own provider so the caller can fetch
 * the SAME adapter that processed the original charge (never re-resolved
 * from market, which could pick a different provider later).
 */
export async function createRefundReservation(input: CreateRefundReservationInput): Promise<CreateRefundReservationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_refund", {
    p_payment_id: input.paymentId,
    p_lines: input.lines.map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity })) as never,
    p_reason_code: input.reasonCode,
    p_reason_note: input.reasonNote || null,
    p_refund_shipping_amount: input.refundShippingAmount,
    p_idempotency_key: input.idempotencyKey,
  } as never);

  if (error) {
    console.error("[admin/refunds] createRefundReservation failed:", error.message);
    if (error.message.includes("PAYMENT_NOT_REFUNDABLE")) return { ok: false, error: "환불 가능한 결제 상태가 아닙니다." };
    if (error.message.includes("OVER_REFUND_QUANTITY")) return { ok: false, error: "환불 가능한 수량을 초과했습니다." };
    if (error.message.includes("OVER_REFUND_SHIPPING_AMOUNT")) return { ok: false, error: "환불 가능한 배송비를 초과했습니다." };
    if (error.message.includes("OVER_REFUND_AMOUNT")) return { ok: false, error: "환불 가능한 금액을 초과했습니다." };
    if (error.message.includes("REFUND_AMOUNT_MUST_BE_POSITIVE")) return { ok: false, error: "환불 항목 또는 배송비 중 하나 이상을 선택해야 합니다." };
    if (error.message.includes("duplicate order item")) return { ok: false, error: "같은 상품을 두 번 선택할 수 없습니다." };
    if (error.message.includes("order item not found")) return { ok: false, error: "선택한 상품을 찾을 수 없습니다." };
    return { ok: false, error: "환불 요청을 생성하지 못했습니다." };
  }

  const result = data as unknown as { refund_id: string; amount: number; provider: PaymentProviderEnum; currency: CurrencyCodeEnum };
  return { ok: true, refundId: result.refund_id, amount: result.amount, provider: result.provider, currencyCode: result.currency };
}

export type FinalizeRefundInput = {
  refundId: string;
  success: boolean;
  providerRefundId: string | null;
  amount: number | null;
  currencyCode: CurrencyCodeEnum | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

export type FinalizeRefundResult = { ok: true; status: string } | { ok: false; error: string };

/** STEP 26 spec section 15/19/23 — the "finalize" half: verifies the provider's own amount/currency before ever marking the refund COMPLETED, then (atomically, inside the RPC) applies payment/order status changes and any eligible stock restore. */
export async function finalizeRefund(input: FinalizeRefundInput): Promise<FinalizeRefundResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_finalize_refund", {
    p_refund_id: input.refundId,
    p_success: input.success,
    p_provider_refund_id: input.providerRefundId,
    p_provider_amount: input.amount,
    p_provider_currency: input.currencyCode,
    p_failure_code: input.failureCode ?? null,
    p_failure_message: input.failureMessage ?? null,
  } as never);

  if (error) {
    console.error("[admin/refunds] finalizeRefund failed:", error.message);
    return { ok: false, error: "환불 처리 결과를 반영하지 못했습니다." };
  }

  const result = data as unknown as { status: string };
  return { ok: true, status: result.status };
}

export type StaleRefund = {
  refundId: string;
  paymentId: string;
  orderId: string;
  orderNumber: string;
  refundStatus: string;
  amount: number;
  currency: CurrencyCodeEnum;
  provider: PaymentProviderEnum;
  createdAt: string;
};

/** STEP 26 spec section 24/25 — read-only diagnostic, mirrors listStalePendingPayments; never auto-resolves anything. */
export async function listStalePendingRefunds(thresholdMinutes = 30): Promise<StaleRefund[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_stale_pending_refunds", { p_threshold_minutes: thresholdMinutes } as never);
  if (error) fail("listStalePendingRefunds", error);

  return (
    (data ?? []) as unknown as {
      refund_id: string;
      payment_id: string;
      order_id: string;
      order_number: string;
      refund_status: string;
      amount: number;
      currency: CurrencyCodeEnum;
      provider: PaymentProviderEnum;
      created_at: string;
    }[]
  ).map((row) => ({
    refundId: row.refund_id,
    paymentId: row.payment_id,
    orderId: row.order_id,
    orderNumber: row.order_number,
    refundStatus: row.refund_status,
    amount: row.amount,
    currency: row.currency,
    provider: row.provider,
    createdAt: row.created_at,
  }));
}
