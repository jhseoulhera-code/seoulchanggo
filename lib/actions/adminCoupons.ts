"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { createAdminCoupon, setAdminCouponActive, updateAdminCoupon, type AdminCouponInput } from "@/lib/repositories/admin/coupons";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult<undefined> | null> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }
  return null;
}

export async function saveCouponAction(id: string | null, input: AdminCouponInput): Promise<ActionResult<{ id: string }>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<{ id: string }>;

  const result = id ? await updateAdminCoupon(id, input) : await createAdminCoupon(input);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/coupons");
  revalidatePath(`/admin/coupons/${result.id}`);
  return { ok: true, data: { id: result.id } };
}

export async function setCouponActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await setAdminCouponActive(id, isActive);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상태를 변경하지 못했습니다." };
  }
  revalidatePath("/admin/coupons");
  return { ok: true, data: undefined };
}
