"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { createCartItemId } from "@/lib/cart";
import type { CartItem, SelectedOptions } from "@/types/cart";

const CART_STORAGE_KEY = "seoulchanggo:cart";

type CartState = {
  items: CartItem[];
};

type CartAction =
  | {
      type: "ADD_ITEM";
      productId: string;
      selectedOptions: SelectedOptions;
      quantity: number;
      maxStock?: number;
    }
  | { type: "REMOVE_ITEM"; cartItemId: string }
  | { type: "SET_QUANTITY"; cartItemId: string; quantity: number; maxStock?: number }
  | { type: "SET_CHECKED"; cartItemId: string; checked: boolean }
  | { type: "SET_CHECKED_ALL"; checked: boolean }
  | { type: "SET_CHECKED_MANY"; cartItemIds: string[]; checked: boolean };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const cartItemId = createCartItemId(action.productId, action.selectedOptions);
      const existing = state.items.find((item) => item.cartItemId === cartItemId);

      if (existing) {
        const nextQuantity = action.maxStock
          ? Math.min(existing.quantity + action.quantity, action.maxStock)
          : existing.quantity + action.quantity;
        return {
          items: state.items.map((item) =>
            item.cartItemId === cartItemId ? { ...item, quantity: nextQuantity } : item
          ),
        };
      }

      const initialQuantity = action.maxStock
        ? Math.min(action.quantity, action.maxStock)
        : action.quantity;

      return {
        items: [
          ...state.items,
          {
            cartItemId,
            productId: action.productId,
            selectedOptions: action.selectedOptions,
            quantity: Math.max(1, initialQuantity),
            checked: true,
          },
        ],
      };
    }

    case "REMOVE_ITEM":
      return { items: state.items.filter((item) => item.cartItemId !== action.cartItemId) };

    case "SET_QUANTITY": {
      const clamped = Math.max(
        1,
        action.maxStock ? Math.min(action.quantity, action.maxStock) : action.quantity
      );
      return {
        items: state.items.map((item) =>
          item.cartItemId === action.cartItemId ? { ...item, quantity: clamped } : item
        ),
      };
    }

    case "SET_CHECKED":
      return {
        items: state.items.map((item) =>
          item.cartItemId === action.cartItemId ? { ...item, checked: action.checked } : item
        ),
      };

    case "SET_CHECKED_ALL":
      return { items: state.items.map((item) => ({ ...item, checked: action.checked })) };

    case "SET_CHECKED_MANY":
      return {
        items: state.items.map((item) =>
          action.cartItemIds.includes(item.cartItemId)
            ? { ...item, checked: action.checked }
            : item
        ),
      };

    default:
      return state;
  }
}

const EMPTY_CART_STATE: CartState = { items: [] };

let cartState: CartState = EMPTY_CART_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  if (stored) {
    try {
      cartState = { items: JSON.parse(stored) as CartItem[] };
    } catch {
      // ignore malformed local storage payload, keep default empty cart
    }
  }
  initialized = true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): CartState {
  ensureInitialized();
  return cartState;
}

function getServerSnapshot(): CartState {
  return EMPTY_CART_STATE;
}

function dispatch(action: CartAction) {
  cartState = cartReducer(cartState, action);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState.items));
  }
  listeners.forEach((listener) => listener());
}

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  addItem: (
    productId: string,
    selectedOptions: SelectedOptions,
    quantity: number,
    maxStock?: number
  ) => void;
  removeItem: (cartItemId: string) => void;
  setQuantity: (cartItemId: string, quantity: number, maxStock?: number) => void;
  setChecked: (cartItemId: string, checked: boolean) => void;
  setCheckedAll: (checked: boolean) => void;
  setCheckedMany: (cartItemIds: string[], checked: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const totalQuantity = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      totalQuantity,
      addItem: (productId, selectedOptions, quantity, maxStock) =>
        dispatch({ type: "ADD_ITEM", productId, selectedOptions, quantity, maxStock }),
      removeItem: (cartItemId) => dispatch({ type: "REMOVE_ITEM", cartItemId }),
      setQuantity: (cartItemId, quantity, maxStock) =>
        dispatch({ type: "SET_QUANTITY", cartItemId, quantity, maxStock }),
      setChecked: (cartItemId, checked) => dispatch({ type: "SET_CHECKED", cartItemId, checked }),
      setCheckedAll: (checked) => dispatch({ type: "SET_CHECKED_ALL", checked }),
      setCheckedMany: (cartItemIds, checked) =>
        dispatch({ type: "SET_CHECKED_MANY", cartItemIds, checked }),
    }),
    [state.items, totalQuantity]
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
