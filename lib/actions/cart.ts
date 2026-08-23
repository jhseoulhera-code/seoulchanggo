"use server";

import { revalidatePath } from "next/cache";
import { calculateCartBadgeQuantity } from "@/lib/cart/cartLogic";
import { clearCartToken, getCartToken, getOrCreateCartToken } from "@/lib/cart/cartToken";
import { addCartItem, getCartItems, mergeGuestCartIntoUser, removeCartItem, updateCartItemQuantity } from "@/lib/repositories/cart";
import { createClient } from "@/lib/supabase/server";
import type { CartItem } from "@/types/cart";

type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * STEP 20 spec section 9/25 — the only thing every cart write trusts from
 * the caller's own claim is "am I signed in", which comes from the
 * session cookie itself, not anything the client passes. A guest's
 * identity is the httpOnly cart_token cookie (see lib/cart/cartToken.ts),
 * created lazily only on a real write, never a mere page view.
 */
async function resolveWriteIdentity(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;
  return getOrCreateCartToken();
}

export async function getCartItemsAction(): Promise<CartItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const token = user ? null : await getCartToken();
  return getCartItems(token);
}

/** Header/nav badge — spec section 22: total quantity summed across lines, not row count. */
export async function getCartSummaryAction(): Promise<{ totalQuantity: number }> {
  const items = await getCartItemsAction();
  return { totalQuantity: calculateCartBadgeQuantity(items) };
}

/**
 * STEP 20 spec section 9 — the client sends only {productId, variantId,
 * quantity}; productId/variantId here are already the real DB UUIDs
 * (Product.dbId / ProductVariant.id) resolved client-side, never a slug.
 * Price, stock, active/sale status are all re-derived server-side inside
 * cart_add_item — never taken from this input.
 */
export async function addToCartAction(input: {
  productId: string;
  variantId: string | null;
  quantity: number;
}): Promise<ActionResult<{ item: CartItem; totalQuantity: number }>> {
  if (!Number.isFinite(input.quantity) || input.quantity < 1) {
    return { ok: false, error: "수량이 올바르지 않습니다." };
  }

  const anonymousToken = await resolveWriteIdentity();
  try {
    const result = await addCartItem(anonymousToken, input.productId, input.variantId, Math.floor(input.quantity));
    const items = await getCartItems(anonymousToken);
    revalidatePath("/cart");
    return { ok: true, data: { item: result.item, totalQuantity: calculateCartBadgeQuantity(items) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "장바구니에 담지 못했습니다." };
  }
}

export async function updateCartItemQuantityAction(
  cartItemId: string,
  quantity: number
): Promise<ActionResult<{ totalQuantity: number }>> {
  if (!Number.isFinite(quantity) || quantity < 1) {
    return { ok: false, error: "수량은 1개 이상이어야 합니다." };
  }

  const anonymousToken = await resolveWriteIdentity();
  try {
    await updateCartItemQuantity(anonymousToken, cartItemId, Math.floor(quantity));
    const items = await getCartItems(anonymousToken);
    revalidatePath("/cart");
    return { ok: true, data: { totalQuantity: calculateCartBadgeQuantity(items) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "수량을 변경하지 못했습니다." };
  }
}

export async function removeCartItemAction(cartItemId: string): Promise<ActionResult<{ totalQuantity: number }>> {
  const anonymousToken = await resolveWriteIdentity();
  try {
    await removeCartItem(anonymousToken, cartItemId);
    const items = await getCartItems(anonymousToken);
    revalidatePath("/cart");
    return { ok: true, data: { totalQuantity: calculateCartBadgeQuantity(items) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "삭제하지 못했습니다." };
  }
}

/**
 * STEP 20 spec section 7 — call once right after sign-in (see
 * contexts/CartContext.tsx). No-ops cleanly if there's no guest cookie or
 * it carries no cart, so it's always safe to call on every sign-in.
 */
export async function mergeGuestCartAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };

  const token = await getCartToken();
  if (!token) return { ok: true, data: undefined };

  try {
    await mergeGuestCartIntoUser(token);
    await clearCartToken();
    revalidatePath("/cart");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "장바구니 병합에 실패했습니다." };
  }
}
