"use server";

import { revalidatePath } from "next/cache";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { cancelUnpaidOrder, updateAdminShippingGroup } from "@/lib/repositories/admin/orders";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateShippingGroupAction(
  orderId: string,
  input: { shippingGroupId: string; status: string; carrier: string | null; trackingNumber: string | null }
): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }

  const result = await updateAdminShippingGroup(input);
  if (!result.ok) return result;

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true };
}

export async function cancelUnpaidOrderAction(orderId: string, reason: string): Promise<ActionResult> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }

  const result = await cancelUnpaidOrder(orderId, reason);
  if (!result.ok) return result;

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
