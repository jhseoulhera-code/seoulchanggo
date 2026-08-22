"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import {
  addAdminProductImage,
  addAdminProductVariant,
  deleteAdminProductImage,
  deleteAdminProductVariant,
  duplicateAdminProduct,
  reorderAdminProductImages,
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
  revalidatePath(`/admin/products/${result.id}/edit`);
  return { ok: true, data: { id: result.id } };
}

export async function addVariantAction(
  productId: string,
  input: { sku: string; optionValues: Record<string, string>; additionalPrice: number; stockQuantity: number }
): Promise<ActionResult<Awaited<ReturnType<typeof addAdminProductVariant>>>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<Awaited<ReturnType<typeof addAdminProductVariant>>>;

  let created: Awaited<ReturnType<typeof addAdminProductVariant>>;
  try {
    created = await addAdminProductVariant(productId, input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "옵션을 추가하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true, data: created };
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
): Promise<ActionResult<Awaited<ReturnType<typeof addAdminProductImage>>>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<Awaited<ReturnType<typeof addAdminProductImage>>>;

  let created: Awaited<ReturnType<typeof addAdminProductImage>>;
  try {
    created = await addAdminProductImage(productId, input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "이미지를 추가하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true, data: created };
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

export async function reorderImagesAction(productId: string, orderedImageIds: string[]): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await reorderAdminProductImages(productId, orderedImageIds);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "이미지 순서를 변경하지 못했습니다." };
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true, data: undefined };
}

export async function duplicateProductAction(productId: string): Promise<ActionResult<{ id: string }>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<{ id: string }>;

  const result = await duplicateAdminProduct(productId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/products");
  return { ok: true, data: { id: result.id } };
}
