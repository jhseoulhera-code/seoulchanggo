import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CartItemRow } from "@/types/database";
import type { CartItem } from "@/types/cart";

/**
 * STEP 20 — all reads/writes go through the SECURITY DEFINER RPCs added by
 * supabase/migrations/20260906000100_step20_cart.sql, never a direct
 * `.from("cart_items")` call: RLS on cart_items/carts is default-deny (see
 * that migration's own comment), and a guest caller has no auth.uid() at
 * all, so ordinary RLS can't protect their rows regardless. Each RPC
 * resolves the caller's own identity server-side (auth.uid() when signed
 * in, otherwise the anonymous_token this repository passes in) and never
 * trusts a client-supplied owner.
 */

function fail(context: string, error: { message: string }): never {
  console.error(`[cart] ${context} failed:`, error.message);
  throw new Error("장바구니 처리 중 오류가 발생했습니다.");
}

async function mapRowsToCartItems(rows: CartItemRow[]): Promise<CartItem[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const productIds = [...new Set(rows.map((row) => row.product_id))];
  const { data: products, error } = await supabase.from("products").select("id, slug").in("id", productIds);
  if (error) fail("mapRowsToCartItems (slug lookup)", error);

  const slugById = new Map(((products ?? []) as unknown as { id: string; slug: string }[]).map((p) => [p.id, p.slug]));

  return rows
    .map((row): CartItem | null => {
      const slug = slugById.get(row.product_id);
      if (!slug) return null; // product hard-deleted since being added — dropped rather than shown with no identity
      return {
        cartItemId: row.id,
        productId: slug,
        variantId: row.variant_id,
        quantity: row.quantity,
        unitPriceSnapshot: row.unit_price_snapshot,
        checked: true,
      };
    })
    .filter((item): item is CartItem => item !== null);
}

export async function getCartItems(anonymousToken: string | null): Promise<CartItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cart_get_items", { p_anonymous_token: anonymousToken } as never);
  if (error) fail("getCartItems", error);
  return mapRowsToCartItems((data ?? []) as unknown as CartItemRow[]);
}

export type AddCartItemResult = { item: CartItem; requestedQuantity: number };

/**
 * productId/variantId here are already real DB UUIDs (Product.dbId /
 * ProductVariant.id) — the caller (lib/actions/cart.ts) is responsible for
 * resolving those before calling in, this layer never accepts a slug.
 */
export async function addCartItem(
  anonymousToken: string | null,
  productId: string,
  variantId: string | null,
  quantity: number
): Promise<AddCartItemResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cart_add_item", {
    p_anonymous_token: anonymousToken,
    p_product_id: productId,
    p_variant_id: variantId,
    p_quantity: quantity,
  } as never);
  if (error) {
    console.error("[cart] addCartItem failed:", error.message);
    if (error.message.includes("out of stock")) throw new Error("품절된 상품입니다.");
    if (error.message.includes("variant not active")) throw new Error("판매가 중지된 옵션입니다.");
    if (error.message.includes("variant does not belong")) throw new Error("잘못된 옵션 정보입니다.");
    if (error.message.includes("product not available")) throw new Error("판매 중인 상품이 아닙니다.");
    if (error.message.includes("cart identity required")) throw new Error("장바구니 정보를 확인할 수 없습니다. 새로고침 후 다시 시도해주세요.");
    throw new Error("장바구니에 담지 못했습니다.");
  }
  const [item] = await mapRowsToCartItems([data as unknown as CartItemRow]);
  if (!item) throw new Error("장바구니에 담지 못했습니다.");
  return { item, requestedQuantity: quantity };
}

export async function updateCartItemQuantity(anonymousToken: string | null, cartItemId: string, quantity: number): Promise<CartItem> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cart_set_quantity", {
    p_anonymous_token: anonymousToken,
    p_cart_item_id: cartItemId,
    p_quantity: quantity,
  } as never);
  if (error) {
    console.error("[cart] updateCartItemQuantity failed:", error.message);
    throw new Error("수량을 변경하지 못했습니다.");
  }
  const [item] = await mapRowsToCartItems([data as unknown as CartItemRow]);
  if (!item) throw new Error("수량을 변경하지 못했습니다.");
  return item;
}

export async function removeCartItem(anonymousToken: string | null, cartItemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cart_remove_item", {
    p_anonymous_token: anonymousToken,
    p_cart_item_id: cartItemId,
  } as never);
  if (error) fail("removeCartItem", error);
}

/** STEP 20 spec section 7 — called once right after sign-in when a guest cart_token cookie is present. */
export async function mergeGuestCartIntoUser(anonymousToken: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cart_merge_guest_into_user", { p_anonymous_token: anonymousToken } as never);
  if (error) fail("mergeGuestCartIntoUser", error);
}
