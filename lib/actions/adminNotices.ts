"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { createAdminNotice, updateAdminNotice, type AdminNoticeInput } from "@/lib/repositories/admin/notices";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveNoticeAction(id: string | null, input: AdminNoticeInput): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };

  try {
    if (id) await updateAdminNotice(id, input);
    else await createAdminNotice(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "공지사항을 저장하지 못했습니다." };
  }
  revalidatePath("/admin/notices");
  revalidatePath("/notices");
  return { ok: true };
}
