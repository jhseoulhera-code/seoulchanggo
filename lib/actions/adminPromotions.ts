"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import {
  addPromotionProduct,
  createAdminPromotion,
  removePromotionProduct,
  reorderPromotionProduct,
  updateAdminPromotion,
  type AdminPromotionInput,
} from "@/lib/repositories/admin/promotions";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult<undefined> | null> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") return { ok: false, error: "관리자 권한이 필요합니다." };
  return null;
}

export async function savePromotionAction(id: string | null, input: AdminPromotionInput): Promise<ActionResult<{ id: string }>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<{ id: string }>;

  const result = id ? await updateAdminPromotion(id, input) : await createAdminPromotion(input);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/promotions");
  revalidatePath(`/admin/promotions/${result.id}`);
  revalidatePath(`/promotion/${input.slug}`);
  return { ok: true, data: { id: result.id } };
}

export async function addPromotionProductAction(promotionId: string, productId: string, sortOrder: number): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;
  try {
    await addPromotionProduct(promotionId, productId, sortOrder);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상품을 추가하지 못했습니다." };
  }
  revalidatePath(`/admin/promotions/${promotionId}`);
  return { ok: true, data: undefined };
}

export async function removePromotionProductAction(promotionId: string, productId: string): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;
  try {
    await removePromotionProduct(promotionId, productId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상품을 제거하지 못했습니다." };
  }
  revalidatePath(`/admin/promotions/${promotionId}`);
  return { ok: true, data: undefined };
}

export async function reorderPromotionProductAction(promotionId: string, productId: string, sortOrder: number): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;
  try {
    await reorderPromotionProduct(promotionId, productId, sortOrder);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "순서를 변경하지 못했습니다." };
  }
  revalidatePath(`/admin/promotions/${promotionId}`);
  return { ok: true, data: undefined };
}
