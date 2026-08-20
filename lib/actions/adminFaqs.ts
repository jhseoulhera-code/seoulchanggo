"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { createAdminFaq, updateAdminFaq, type AdminFaqInput } from "@/lib/repositories/admin/faqs";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveFaqAction(id: string | null, input: AdminFaqInput): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };

  try {
    if (id) await updateAdminFaq(id, input);
    else await createAdminFaq(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "FAQ를 저장하지 못했습니다." };
  }
  revalidatePath("/admin/faqs");
  revalidatePath("/faq");
  return { ok: true };
}
