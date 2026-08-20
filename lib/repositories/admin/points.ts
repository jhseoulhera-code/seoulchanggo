import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PointTransactionRow } from "@/types/database";
import type { AdminPointTransaction } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/points] ${context} failed:`, error.message);
  throw new Error("포인트 데이터를 처리하지 못했습니다.");
}

export async function getAdminPointBalance(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_point_balance", { p_user_id: userId } as never);
  if (error) fail("getAdminPointBalance", error);
  return (data as unknown as number) ?? 0;
}

export async function getAdminPointHistory(userId: string): Promise<AdminPointTransaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("point_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) fail("getAdminPointHistory", error);
  return ((data ?? []) as unknown as PointTransactionRow[]).map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    reason: row.reason,
    orderId: row.order_id,
    createdAt: row.created_at,
  }));
}

export type AdjustPointsResult = { ok: true } | { ok: false; error: string };

export async function adjustAdminPoints(userId: string, amount: number, reason: string): Promise<AdjustPointsResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_points", { p_user_id: userId, p_amount: amount, p_reason: reason } as never);
  if (error) {
    console.error("[admin/points] adjustAdminPoints failed:", error.message);
    if (error.message.includes("below zero")) return { ok: false, error: "조정 후 잔액이 0 미만이 될 수 없습니다." };
    if (error.message.includes("reason")) return { ok: false, error: "조정 사유를 입력해주세요." };
    return { ok: false, error: "포인트를 조정하지 못했습니다." };
  }
  return { ok: true };
}
