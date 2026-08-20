"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import {
  addAdminProductImage,
  addAdminProductVariant,
  deleteAdminProductImage,
  deleteAdminProductVariant,
  setAdminProductPrimaryImage,
  updateAdminProductVariant,
  upsertAdminProduct,
} from "@/lib/repositories/admin/products";
import type { AdminProductDetail } from "@/types/admin";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult<undefined> | null> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }
  return null;
}

export async function saveProductAction(detail: AdminProductDetail): Promise<ActionResult<{ id: string }>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<{ id: string }>;

  const result = await upsertAdminProduct(detail);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${result.id}`);
  return { ok: true, data: { id: result.id } };
}

export async function addVariantAction(
  productId: string,
  input: { sku: string; optionValues: Record<string, string>; additionalPrice: number; stockQuantity: number }
): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await addAdminProductVariant(productId, input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "옵션을 추가하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: undefined };
}

export async function updateVariantAction(
  productId: string,
  variantId: string,
  patch: Partial<{ stockQuantity: number; additionalPrice: number; isActive: boolean }>
): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await updateAdminProductVariant(variantId, patch);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "옵션을 수정하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: undefined };
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await deleteAdminProductVariant(variantId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "옵션을 삭제하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: undefined };
}

export async function addImageAction(
  productId: string,
  input: { imageUrl: string; altKo: string; sortOrder: number; isPrimary: boolean }
): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await addAdminProductImage(productId, input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "이미지를 추가하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: undefined };
}

export async function deleteImageAction(productId: string, imageId: string): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await deleteAdminProductImage(imageId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "이미지를 삭제하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: undefined };
}

export async function setPrimaryImageAction(productId: string, imageId: string): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await setAdminProductPrimaryImage(productId, imageId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "대표 이미지를 변경하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, data: undefined };
}
