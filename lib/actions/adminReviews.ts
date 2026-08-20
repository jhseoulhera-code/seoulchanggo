"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { setAdminReviewStatus } from "@/lib/repositories/admin/reviews";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setReviewStatusAction(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };

  try {
    await setAdminReviewStatus(id, status);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상태를 변경하지 못했습니다." };
  }
  revalidatePath("/admin/reviews");
  return { ok: true };
}
