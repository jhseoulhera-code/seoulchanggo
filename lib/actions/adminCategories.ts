"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { createAdminCategory, updateAdminCategory } from "@/lib/repositories/admin/categories";
import {
  addProductToHomeSection,
  removeHomeSectionItem,
  reorderHomeSectionItem,
  setHomeSectionActive,
} from "@/lib/repositories/admin/homeSections";
import { searchAdminProductsForPicker, type AdminProductPickerItem } from "@/lib/repositories/admin/products";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult<undefined> | null> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }
  return null;
}

export async function createCategoryAction(input: {
  slug: string;
  nameKo: string;
  nameEn: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isVisible: boolean;
  showOnHome: boolean;
}): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await createAdminCategory({ ...input, iconName: null });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "카테고리를 추가하지 못했습니다." };
  }
  revalidatePath("/admin/categories");
  return { ok: true, data: undefined };
}

export async function updateCategoryAction(
  id: string,
  patch: Partial<{
    nameKo: string;
    nameEn: string;
    parentId: string | null;
    sortOrder: number;
    isVisible: boolean;
    showOnHome: boolean;
  }>
): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await updateAdminCategory(id, patch);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "카테고리를 수정하지 못했습니다." };
  }
  revalidatePath("/admin/categories");
  return { ok: true, data: undefined };
}

export async function searchProductsForPickerAction(query: string): Promise<ActionResult<AdminProductPickerItem[]>> {
  const guardError = await requireAdmin();
  if (guardError) return guardError as ActionResult<AdminProductPickerItem[]>;

  try {
    const items = await searchAdminProductsForPicker(query);
    return { ok: true, data: items };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상품을 검색하지 못했습니다." };
  }
}

export async function addHomeSectionProductAction(sectionId: string, productId: string, sortOrder: number): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await addProductToHomeSection(sectionId, productId, sortOrder);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상품을 추가하지 못했습니다." };
  }
  revalidatePath("/admin/categories");
  return { ok: true, data: undefined };
}

export async function removeHomeSectionItemAction(itemId: string): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await removeHomeSectionItem(itemId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상품을 제거하지 못했습니다." };
  }
  revalidatePath("/admin/categories");
  return { ok: true, data: undefined };
}

export async function reorderHomeSectionItemAction(itemId: string, sortOrder: number): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await reorderHomeSectionItem(itemId, sortOrder);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "순서를 변경하지 못했습니다." };
  }
  revalidatePath("/admin/categories");
  return { ok: true, data: undefined };
}

export async function setHomeSectionActiveAction(sectionId: string, isActive: boolean): Promise<ActionResult> {
  const guardError = await requireAdmin();
  if (guardError) return guardError;

  try {
    await setHomeSectionActive(sectionId, isActive);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "상태를 변경하지 못했습니다." };
  }
  revalidatePath("/admin/categories");
  return { ok: true, data: undefined };
}
