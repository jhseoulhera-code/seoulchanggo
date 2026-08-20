"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { updateAdminProductStock } from "@/lib/repositories/admin/inventory";
import { updateAdminProductVariant } from "@/lib/repositories/admin/products";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateInventoryQuantityAction(
  input: { productId: string; variantId: string | null },
  stockQuantity: number
): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }

  try {
    if (input.variantId) {
      await updateAdminProductVariant(input.variantId, { stockQuantity });
    } else {
      await updateAdminProductStock(input.productId, stockQuantity);
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "재고를 수정하지 못했습니다." };
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin");
  return { ok: true };
}
