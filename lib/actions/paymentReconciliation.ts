"use server";

import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { buildReconciliationResult } from "@/lib/payments/reconciliation";
import { createClient } from "@/lib/supabase/server";
import type { ReconciliationResult } from "@/lib/payments/reconciliation";
import type { CurrencyCodeEnum, OrderStatusEnum, PaymentAttemptStatusEnum, PaymentProviderEnum } from "@/types/database";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult<never> | null> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };
  return null;
}

export type StalePendingPayment = {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentAttemptStatusEnum;
  orderStatus: OrderStatusEnum;
  amount: number;
  currencyCode: CurrencyCodeEnum;
  provider: PaymentProviderEnum;
  providerPaymentId: string | null;
  createdAt: string;
  reconciliation: ReconciliationResult;
};

/**
 * STEP 24 spec section 19/20 — the protected, UI-facing entry point for a
 * human to run the stale-pending diagnostic on demand today; written so a
 * future cron/scheduled task can call the same underlying RPC
 * (list_stale_pending_payments — server-only reconciliation function) on a
 * timer instead. This NEVER mutates anything, matching that RPC's own
 * comment: a stale PAYMENT_PENDING is flagged for re-checking against the
 * provider, never auto-cancelled (section 21) — the provider may have
 * actually completed it.
 */
export async function listStalePendingPaymentsAction(thresholdMinutes?: number): Promise<ActionResult<StalePendingPayment[]>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<StalePendingPayment[]>;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_stale_pending_payments", {
    p_threshold_minutes: thresholdMinutes,
  } as never);

  if (error) {
    console.error("[paymentReconciliation] listStalePendingPaymentsAction failed:", error.message);
    return { ok: false, error: "결제 대기 목록을 불러오지 못했습니다." };
  }

  type Row = {
    payment_id: string;
    order_id: string;
    order_number: string;
    payment_status: PaymentAttemptStatusEnum;
    order_status: OrderStatusEnum;
    amount: number;
    currency_code: CurrencyCodeEnum;
    provider: PaymentProviderEnum;
    provider_payment_id: string | null;
    created_at: string;
  };

  return {
    ok: true,
    data: ((data ?? []) as unknown as Row[]).map((row) => ({
      paymentId: row.payment_id,
      orderId: row.order_id,
      orderNumber: row.order_number,
      paymentStatus: row.payment_status,
      orderStatus: row.order_status,
      amount: row.amount,
      currencyCode: row.currency_code,
      provider: row.provider,
      providerPaymentId: row.provider_payment_id,
      createdAt: row.created_at,
      // The RPC's own WHERE clause already guarantees every returned row is
      // stale-pending — this just carries that classification through in
      // the shared ReconciliationResult shape (STEP 24 spec section 39)
      // rather than the caller re-deriving it.
      reconciliation: buildReconciliationResult(
        row.payment_id,
        row.order_id,
        { status: row.payment_status, amount: row.amount, currencyCode: row.currency_code },
        null,
        "STALE_PENDING"
      ),
    })),
  };
}
