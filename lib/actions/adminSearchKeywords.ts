"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { createAdminSearchKeyword, updateAdminSearchKeyword, type AdminSearchKeywordInput } from "@/lib/repositories/admin/searchKeywords";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveSearchKeywordAction(id: string | null, input: AdminSearchKeywordInput): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };

  try {
    if (id) await updateAdminSearchKeyword(id, input);
    else await createAdminSearchKeyword(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "검색어를 저장하지 못했습니다." };
  }
  revalidatePath("/admin/search-keywords");
  return { ok: true };
}
