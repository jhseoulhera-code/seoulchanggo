"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mergeGuestCartIntoMember } from "@/lib/repositories/cartClient";
import {
  clearLocalCart,
  localCartAddItem,
  localCartGetServerSnapshot,
  localCartGetSnapshot,
  localCartRemoveItem,
  localCartSetChecked,
  localCartSetCheckedAll,
  localCartSetCheckedMany,
  localCartSetQuantity,
  localCartSubscribe,
  readLocalCartItems,
} from "@/lib/localCartStore";
import {
  loadMemberCartForUser,
  resetMemberCartStore,
  supabaseCartAddItem,
  supabaseCartGetServerSnapshot,
  supabaseCartGetSnapshot,
  supabaseCartRemoveItem,
  supabaseCartSetChecked,
  supabaseCartSetCheckedAll,
  supabaseCartSetCheckedMany,
  supabaseCartSetQuantity,
  supabaseCartSubscribe,
} from "@/lib/supabaseCartStore";
import type { CartItem, SelectedOptions } from "@/types/cart";

const CONFIGURED = isSupabaseConfigured();
const EMPTY_ITEMS: CartItem[] = [];

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  addItem: (productId: string, selectedOptions: SelectedOptions, quantity: number, maxStock?: number) => void;
  removeItem: (cartItemId: string) => void;
  setQuantity: (cartItemId: string, quantity: number, maxStock?: number) => void;
  setChecked: (cartItemId: string, checked: boolean) => void;
  setCheckedAll: (checked: boolean) => void;
  setCheckedMany: (cartItemIds: string[], checked: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated, isReady: authReady } = useAuth();
  const useMemberCart = CONFIGURED && authReady && isAuthenticated && currentUser !== null;

  const snapshot = useSyncExternalStore(
    useMemberCart ? supabaseCartSubscribe : localCartSubscribe,
    useMemberCart ? supabaseCartGetSnapshot : localCartGetSnapshot,
    useMemberCart ? supabaseCartGetServerSnapshot : localCartGetServerSnapshot
  );
  const items = snapshot.status === "ready" ? snapshot.items : EMPTY_ITEMS;

  // Loads the member cart once a real user id is known, and merges any guest
  // cart left over from before sign-in (STEP 08 spec section 11).
  const wasAuthenticatedRef = useRef(false);
  useEffect(() => {
    if (!useMemberCart || !currentUser) {
      wasAuthenticatedRef.current = false;
      return;
    }

    const justSignedIn = !wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = true;

    if (justSignedIn) {
      const guestItems = readLocalCartItems();
      if (guestItems.length > 0) {
        mergeGuestCartIntoMember(guestItems).then(() => {
          clearLocalCart();
          loadMemberCartForUser(currentUser.id);
        });
        return;
      }
    }

    loadMemberCartForUser(currentUser.id);
  }, [useMemberCart, currentUser]);

  useEffect(() => {
    if (!useMemberCart) resetMemberCartStore();
  }, [useMemberCart]);

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const value = useMemo<CartContextValue>(() => {
    if (useMemberCart && currentUser) {
      const userId = currentUser.id;
      return {
        items,
        totalQuantity,
        addItem: (productId, selectedOptions, quantity, maxStock) =>
          supabaseCartAddItem(userId, productId, selectedOptions, quantity, maxStock),
        removeItem: supabaseCartRemoveItem,
        setQuantity: supabaseCartSetQuantity,
        setChecked: supabaseCartSetChecked,
        setCheckedAll: supabaseCartSetCheckedAll,
        setCheckedMany: supabaseCartSetCheckedMany,
      };
    }

    return {
      items,
      totalQuantity,
      addItem: localCartAddItem,
      removeItem: localCartRemoveItem,
      setQuantity: localCartSetQuantity,
      setChecked: localCartSetChecked,
      setCheckedAll: localCartSetCheckedAll,
      setCheckedMany: localCartSetCheckedMany,
    };
  }, [useMemberCart, currentUser, items, totalQuantity]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
