// Pure, Node-testable (no "server-only" import, no DB access) — the actual
// DB query (stale-pending lookup, adapter.getPaymentStatus calls) lives in a
// server-only action that calls these functions with plain data. Kept
// separate from lib/payments/types.ts since these are STEP 24's own
// reconciliation-specific concepts, not part of the Provider Adapter
// interface every adapter implements.

/**
 * STEP 24 spec section 17 — real naming, not from any single PG's own
 * vocabulary. PROVIDER_PAID_LOCAL_STOCK_FAILURE is the case the spec's
 * section 36/37 specifically calls out: the provider actually charged the
 * customer, but our own stock check failed at finalize time (payments.status
 * ends up FAILED/STOCK_CHANGED per STEP 23) — that must never be confused
 * with a genuine payment decline, since money changed hands and fulfillment
 * now needs human attention, not a "customer can just retry" message.
 */
export type PaymentReconciliationIssue =
  | "STALE_PENDING"
  | "PROVIDER_PAID_LOCAL_PENDING"
  | "PROVIDER_PAID_LOCAL_STOCK_FAILURE"
  | "LOCAL_PAID_PROVIDER_UNKNOWN"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "PROVIDER_UNAVAILABLE";

export type ReconciliationResult = {
  paymentId: string;
  orderId: string;
  localStatus: string;
  providerStatus?: string;
  issue?: PaymentReconciliationIssue;
  actionRequired: boolean;
};

/** STEP 24 spec section 20 — the time threshold, stated once instead of a magic number scattered across callers. */
export const STALE_PAYMENT_PENDING_THRESHOLD_MINUTES = 30;

const NON_TERMINAL_STATUSES = new Set(["CREATED", "READY", "PENDING", "AUTHORIZED"]);

/**
 * A payment is "stale pending" purely by elapsed time in a non-terminal
 * status — this NEVER concludes the payment failed or should be cancelled
 * (STEP 24 spec section 21): it only flags "worth re-checking against the
 * provider", since the provider may have actually completed it already.
 */
export function isStalePendingPayment(
  paymentStatus: string,
  paymentCreatedAt: string,
  now: Date = new Date(),
  thresholdMinutes: number = STALE_PAYMENT_PENDING_THRESHOLD_MINUTES
): boolean {
  if (!NON_TERMINAL_STATUSES.has(paymentStatus)) return false;
  const ageMinutes = (now.getTime() - new Date(paymentCreatedAt).getTime()) / 60000;
  return ageMinutes >= thresholdMinutes;
}

export type LocalPaymentSnapshot = {
  status: string;
  amount: number;
  currencyCode: string;
};

export type ProviderPaymentSnapshot = {
  status: string;
  amount: number | null;
  currencyCode: string | null;
};

/**
 * Compares OUR record against what the provider reports for the SAME
 * payment (via a real future getPaymentStatus() call, or a webhook's own
 * reported values) and classifies the mismatch, if any. `provider === null`
 * means the lookup itself failed/isn't supported (PROVIDER_UNAVAILABLE for
 * a local PAID row we can no longer verify — otherwise not itself an issue,
 * since a still-pending local payment with no provider answer yet is
 * ordinary, not evidence of anything wrong).
 */
export function classifyReconciliationIssue(
  local: LocalPaymentSnapshot,
  provider: ProviderPaymentSnapshot | null
): PaymentReconciliationIssue | null {
  if (provider === null) {
    return local.status === "PAID" ? "PROVIDER_UNAVAILABLE" : null;
  }
  if (provider.status === "PAID" && local.status !== "PAID") {
    return "PROVIDER_PAID_LOCAL_PENDING";
  }
  if (local.status === "PAID" && provider.status !== "PAID" && provider.status !== "UNKNOWN") {
    return "LOCAL_PAID_PROVIDER_UNKNOWN";
  }
  if (provider.amount != null && provider.amount !== local.amount) {
    return "AMOUNT_MISMATCH";
  }
  if (provider.currencyCode != null && provider.currencyCode !== local.currencyCode) {
    return "CURRENCY_MISMATCH";
  }
  return null;
}

export function buildReconciliationResult(
  paymentId: string,
  orderId: string,
  local: LocalPaymentSnapshot,
  provider: ProviderPaymentSnapshot | null,
  overrideIssue?: PaymentReconciliationIssue
): ReconciliationResult {
  const issue = overrideIssue ?? classifyReconciliationIssue(local, provider) ?? undefined;
  return {
    paymentId,
    orderId,
    localStatus: local.status,
    providerStatus: provider?.status,
    issue,
    actionRequired: issue !== undefined,
  };
}
