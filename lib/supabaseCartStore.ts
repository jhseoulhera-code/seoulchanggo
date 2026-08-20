"use client";

import {
  addMemberCartItem,
  fetchMemberCartItems,
  removeMemberCartItem,
  updateMemberCartItemQuantity,
} from "@/lib/repositories/cartClient";
import type { CartItem, SelectedOptions } from "@/types/cart";
import type { CartSnapshot } from "@/lib/cartTypes";
import { CART_LOADING_SNAPSHOT } from "@/lib/cartTypes";

/**
 * The member cart: Supabase-backed, used once a real (non-mock) session exists —
 * see contexts/CartContext.tsx. Updates are optimistic (the in-memory snapshot
 * changes immediately, matching the guest cart's instant feel) with the actual
 * write firing in the background; a failed write is logged but not rolled back
 * in this pass — see the STEP 08 report for why that's an acceptable, called-out
 * gap rather than a fix attempted without a live project to verify against.
 */
let snapshot: CartSnapshot = CART_LOADING_SNAPSHOT;
let loadedForUserId: string | null = null;
const listeners = new Set<() => void>();

function setSnapshot(next: CartSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function currentItems(): CartItem[] {
  return snapshot.status === "ready" ? snapshot.items : [];
}

async function load(userId: string) {
  const items = await fetchMemberCartItems(userId);
  // Bail if the user changed again while this fetch was in flight.
  if (loadedForUserId !== userId) return;
  setSnapshot({ status: "ready", items });
}

/** Call once the authenticated user id is known (or changes) — see the CartProvider effect. */
export function loadMemberCartForUser(userId: string) {
  if (loadedForUserId === userId) return;
  loadedForUserId = userId;
  setSnapshot(CART_LOADING_SNAPSHOT);
  void load(userId);
}

export function resetMemberCartStore() {
  loadedForUserId = null;
  setSnapshot(CART_LOADING_SNAPSHOT);
}

export function supabaseCartSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function supabaseCartGetSnapshot(): CartSnapshot {
  return snapshot;
}

export function supabaseCartGetServerSnapshot(): CartSnapshot {
  return CART_LOADING_SNAPSHOT;
}

export function supabaseCartAddItem(
  userId: string,
  productId: string,
  selectedOptions: SelectedOptions,
  quantity: number,
  maxStock?: number
) {
  const items = currentItems();
  const existing = items.find(
    (item) => item.productId === productId && JSON.stringify(item.selectedOptions) === JSON.stringify(selectedOptions)
  );

  if (existing) {
    const nextQuantity = maxStock ? Math.min(existing.quantity + quantity, maxStock) : existing.quantity + quantity;
    setSnapshot({
      status: "ready",
      items: items.map((item) => (item === existing ? { ...item, quantity: nextQuantity } : item)),
    });
  } else {
    const initialQuantity = maxStock ? Math.min(quantity, maxStock) : quantity;
    const optimisticItem: CartItem = {
      cartItemId: `pending-${Date.now()}`,
      productId,
      selectedOptions,
      quantity: Math.max(1, initialQuantity),
      checked: true,
    };
    setSnapshot({ status: "ready", items: [...items, optimisticItem] });
  }

  void addMemberCartItem(userId, productId, selectedOptions, quantity).then(() => load(userId));
}

export function supabaseCartRemoveItem(cartItemId: string) {
  setSnapshot({ status: "ready", items: currentItems().filter((item) => item.cartItemId !== cartItemId) });
  if (!cartItemId.startsWith("pending-")) {
    void removeMemberCartItem(cartItemId);
  }
}

export function supabaseCartSetQuantity(cartItemId: string, quantity: number, maxStock?: number) {
  const clamped = Math.max(1, maxStock ? Math.min(quantity, maxStock) : quantity);
  setSnapshot({
    status: "ready",
    items: currentItems().map((item) => (item.cartItemId === cartItemId ? { ...item, quantity: clamped } : item)),
  });
  if (!cartItemId.startsWith("pending-")) {
    void updateMemberCartItemQuantity(cartItemId, clamped);
  }
}

// "checked" is session-only UI state — see cart_items schema note in cartClient.ts — so these never touch Supabase.
export function supabaseCartSetChecked(cartItemId: string, checked: boolean) {
  setSnapshot({
    status: "ready",
    items: currentItems().map((item) => (item.cartItemId === cartItemId ? { ...item, checked } : item)),
  });
}

export function supabaseCartSetCheckedAll(checked: boolean) {
  setSnapshot({ status: "ready", items: currentItems().map((item) => ({ ...item, checked })) });
}

export function supabaseCartSetCheckedMany(cartItemIds: string[], checked: boolean) {
  setSnapshot({
    status: "ready",
    items: currentItems().map((item) => (cartItemIds.includes(item.cartItemId) ? { ...item, checked } : item)),
  });
}
