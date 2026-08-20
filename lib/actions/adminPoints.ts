"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { adjustAdminPoints } from "@/lib/repositories/admin/points";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function adjustPointsAction(userId: string, amount: number, reason: string): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }
  const result = await adjustAdminPoints(userId, amount, reason);
  if (!result.ok) return result;

  revalidatePath(`/admin/customers/${userId}`);
  return { ok: true };
}
