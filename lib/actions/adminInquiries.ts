"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { answerAdminInquiry } from "@/lib/repositories/admin/inquiries";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function answerInquiryAction(id: string, answer: string): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };

  const result = await answerAdminInquiry(id, answer, access.profile.id);
  if (!result.ok) return result;

  revalidatePath("/admin/inquiries");
  return { ok: true };
}
