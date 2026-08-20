"use client";

import { createClient } from "@/lib/supabase/client";
import type { CartItem, SelectedOptions } from "@/types/cart";
import type { CartItemRow } from "@/types/database";

/**
 * Client-safe (browser Supabase client) cart_items CRUD for logged-in members.
 * Cart actions happen from client interactions (add-to-cart buttons, quantity
 * steppers), so — unlike the product/category repositories — this deliberately
 * does not go through lib/supabase/server.ts.
 *
 * cart_items has no "checked" column (STEP 08 schema keeps that ephemeral —
 * see contexts/CartContext.tsx); it always defaults to true on load.
 */

type CartItemJoinRow = CartItemRow & { products: { slug: string } | null };

function mapRowToCartItem(row: CartItemJoinRow): CartItem {
  return {
    cartItemId: row.id,
    productId: row.products?.slug ?? "",
    selectedOptions: (row.selected_options as SelectedOptions) ?? {},
    quantity: row.quantity,
    checked: true,
  };
}

export async function fetchMemberCartItems(userId: string): Promise<CartItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select("*, products(slug)")
    .eq("user_id", userId);

  if (error) {
    console.error("[cart] fetchMemberCartItems failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as CartItemJoinRow[]).map(mapRowToCartItem);
}

async function resolveProductForCart(productSlug: string): Promise<{ id: string; maxStock?: number } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, stock_type, stock_quantity")
    .eq("slug", productSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as { id: string; stock_type: string; stock_quantity: number };
  return { id: row.id, maxStock: row.stock_type === "TRACKED" ? row.stock_quantity : undefined };
}

/** Mirrors lib/localCartStore.ts's ADD_ITEM semantics: same product+options merges quantity (capped at stock), otherwise a new row. */
export async function addMemberCartItem(
  userId: string,
  productSlug: string,
  selectedOptions: SelectedOptions,
  quantity: number
): Promise<void> {
  const product = await resolveProductForCart(productSlug);
  if (!product) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", userId)
    .eq("product_id", product.id)
    .eq("selected_options", selectedOptions)
    .maybeSingle();

  const existingRow = existing as unknown as { id: string; quantity: number } | null;

  if (existingRow) {
    const nextQuantity = product.maxStock
      ? Math.min(existingRow.quantity + quantity, product.maxStock)
      : existingRow.quantity + quantity;
    await supabase
      .from("cart_items")
      .update({ quantity: nextQuantity } as never)
      .eq("id", existingRow.id);
  } else {
    const initialQuantity = product.maxStock ? Math.min(quantity, product.maxStock) : quantity;
    await supabase.from("cart_items").insert({
      user_id: userId,
      product_id: product.id,
      selected_options: selectedOptions,
      quantity: Math.max(1, initialQuantity),
    } as never);
  }
}

export async function removeMemberCartItem(cartItemId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("cart_items").delete().eq("id", cartItemId);
}

export async function updateMemberCartItemQuantity(cartItemId: string, quantity: number): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("cart_items")
    .update({ quantity: Math.max(1, quantity) } as never)
    .eq("id", cartItemId);
}

/** Guest → member merge (spec section 11), via the merge_guest_cart RPC so the read-modify-write stays server-side per item. `product_id` here is the app-level slug — the RPC resolves it to the real UUID. */
export async function mergeGuestCartIntoMember(items: CartItem[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = createClient();
  const payload = items.map((item) => ({
    product_id: item.productId,
    selected_options: item.selectedOptions,
    quantity: item.quantity,
  }));
  const { error } = await supabase.rpc("merge_guest_cart", { p_items: payload } as never);
  if (error) {
    console.error("[cart] mergeGuestCartIntoMember failed:", error.message);
  }
}
