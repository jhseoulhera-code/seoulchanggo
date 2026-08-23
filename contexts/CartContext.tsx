"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  addToCartAction,
  getCartItemsAction,
  mergeGuestCartAction,
  removeCartItemAction,
  updateCartItemQuantityAction,
} from "@/lib/actions/cart";
import { calculateCartBadgeQuantity } from "@/lib/cart/cartLogic";
import type { CartItem } from "@/types/cart";

type AddItemResult = { ok: true } | { ok: false; error: string };

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  loading: boolean;
  addItem: (productId: string, variantId: string | null, quantity: number) => Promise<AddItemResult>;
  removeItem: (cartItemId: string) => Promise<void>;
  setQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  setChecked: (cartItemId: string, checked: boolean) => void;
  setCheckedAll: (checked: boolean) => void;
  setCheckedMany: (cartItemIds: string[], checked: boolean) => void;
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * STEP 20 — replaces the previous dual guest(localStorage)/member(Supabase
 * client SDK) stores with a single server-authoritative source: every read
 * and write goes through Server Actions (lib/actions/cart.ts), which in
 * turn call SECURITY DEFINER RPCs — the client here never talks to
 * Supabase directly and never sees the guest's cart_token (it's an httpOnly
 * cookie). "checked" stays a pure client-local selection flag exactly as
 * before (never sent to the server), preserved across a reload by
 * cartItemId so toggling a checkbox then changing another line's quantity
 * doesn't reset it.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady: authReady } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const wasAuthenticatedRef = useRef(false);

  const load = useCallback(async () => {
    const fresh = await getCartItemsAction();
    setItems((prev) => {
      const checkedById = new Map(prev.map((item) => [item.cartItemId, item.checked]));
      return fresh.map((item) => ({ ...item, checked: checkedById.get(item.cartItemId) ?? true }));
    });
  }, []);

  // Merges any guest cart into the member cart exactly once per real
  // sign-in transition (STEP 20 spec section 7), then loads whichever
  // cart is now current. On sign-out, the next run here re-resolves
  // identity via the Server Action's own supabase.auth.getUser() call,
  // which naturally returns the guest-scoped cart instead — this is what
  // keeps a previously signed-in user's items from lingering after logout
  // (spec section 23), with no separate "clear on logout" step needed.
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      const justSignedIn = isAuthenticated && !wasAuthenticatedRef.current;
      wasAuthenticatedRef.current = isAuthenticated;
      if (justSignedIn) {
        await mergeGuestCartAction();
      }
      await load();
      if (!cancelled) setLoading(false);
    }
    void run();

    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, load]);

  const totalQuantity = useMemo(() => calculateCartBadgeQuantity(items), [items]);

  const addItem = useCallback(
    async (productId: string, variantId: string | null, quantity: number): Promise<AddItemResult> => {
      const result = await addToCartAction({ productId, variantId, quantity });
      if (result.ok) {
        await load();
        return { ok: true };
      }
      return { ok: false, error: result.error };
    },
    [load]
  );

  const removeItem = useCallback(
    async (cartItemId: string) => {
      await removeCartItemAction(cartItemId);
      await load();
    },
    [load]
  );

  const setQuantity = useCallback(
    async (cartItemId: string, quantity: number) => {
      await updateCartItemQuantityAction(cartItemId, quantity);
      await load();
    },
    [load]
  );

  const setChecked = useCallback((cartItemId: string, checked: boolean) => {
    setItems((prev) => prev.map((item) => (item.cartItemId === cartItemId ? { ...item, checked } : item)));
  }, []);

  const setCheckedAll = useCallback((checked: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, checked })));
  }, []);

  const setCheckedMany = useCallback((cartItemIds: string[], checked: boolean) => {
    setItems((prev) => prev.map((item) => (cartItemIds.includes(item.cartItemId) ? { ...item, checked } : item)));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({ items, totalQuantity, loading, addItem, removeItem, setQuantity, setChecked, setCheckedAll, setCheckedMany, refresh: load }),
    [items, totalQuantity, loading, addItem, removeItem, setQuantity, setChecked, setCheckedAll, setCheckedMany, load]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
