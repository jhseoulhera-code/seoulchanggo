"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import {
  createAdminBanner,
  setAdminBannerActive,
  updateAdminBanner,
  type AdminBannerInput,
} from "@/lib/repositories/admin/banners";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult | null> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };
  return null;
}

export async function saveBannerAction(id: string | null, input: AdminBannerInput): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    if (id) await updateAdminBanner(id, input);
    else await createAdminBanner(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "배너를 저장하지 못했습니다." };
  }
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true };
}

export async function setBannerActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await setAdminBannerActive(id, isActive);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상태를 변경하지 못했습니다." };
  }
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true };
}
