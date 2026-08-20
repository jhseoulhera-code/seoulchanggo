/**
 * Client-side UX guard values only — mirrors the seed rows in
 * supabase/migrations/20260823000100_step10_schema.sql's app_settings table.
 * The authoritative check is always server-side (create_order RPC re-derives
 * the real balance and re-applies these same rules); this file only avoids a
 * round trip for an obviously-invalid input. Keep both in sync if the policy
 * changes.
 */
export const POINTS_EARN_RATE = 0.01;
export const POINTS_MIN_USE = 1000;
export const POINTS_MAX_USE_RATIO = 0.5;

export function maxUsablePoints(payableAmount: number, balance: number): number {
  return Math.max(0, Math.min(balance, Math.floor(payableAmount * POINTS_MAX_USE_RATIO)));
}
