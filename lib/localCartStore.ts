"use client";

import { createCartItemId } from "@/lib/cart";
import type { CartItem, SelectedOptions } from "@/types/cart";
import type { CartSnapshot } from "@/lib/cartTypes";

/**
 * The guest cart: localStorage-backed, unchanged from STEP 05-R/06. Used whenever
 * there is no authenticated Supabase member — see contexts/CartContext.tsx.
 */
const CART_STORAGE_KEY = "seoulchanggo:cart";

type CartState = { items: CartItem[] };

type CartAction =
  | { type: "ADD_ITEM"; productId: string; selectedOptions: SelectedOptions; quantity: number; maxStock?: number }
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
const EMPTY_READY_SNAPSHOT: CartSnapshot = { status: "ready", items: EMPTY_CART_STATE.items };

let cartState: CartState = EMPTY_CART_STATE;
// Cached alongside cartState — useSyncExternalStore requires getSnapshot to return a
// referentially stable value when nothing changed, so this is only rebuilt in dispatch()
// and ensureInitialized(), never freshly constructed inside the getter itself.
let readySnapshot: CartSnapshot = EMPTY_READY_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  if (stored) {
    try {
      cartState = { items: JSON.parse(stored) as CartItem[] };
      readySnapshot = { status: "ready", items: cartState.items };
    } catch {
      // ignore malformed local storage payload, keep default empty cart
    }
  }
  initialized = true;
}

function dispatch(action: CartAction) {
  cartState = cartReducer(cartState, action);
  readySnapshot = { status: "ready", items: cartState.items };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState.items));
  }
  listeners.forEach((listener) => listener());
}

export function localCartSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function localCartGetSnapshot(): CartSnapshot {
  ensureInitialized();
  return readySnapshot;
}

export function localCartGetServerSnapshot(): CartSnapshot {
  return EMPTY_READY_SNAPSHOT;
}

export function localCartAddItem(
  productId: string,
  selectedOptions: SelectedOptions,
  quantity: number,
  maxStock?: number
) {
  dispatch({ type: "ADD_ITEM", productId, selectedOptions, quantity, maxStock });
}

export function localCartRemoveItem(cartItemId: string) {
  dispatch({ type: "REMOVE_ITEM", cartItemId });
}

export function localCartSetQuantity(cartItemId: string, quantity: number, maxStock?: number) {
  dispatch({ type: "SET_QUANTITY", cartItemId, quantity, maxStock });
}

export function localCartSetChecked(cartItemId: string, checked: boolean) {
  dispatch({ type: "SET_CHECKED", cartItemId, checked });
}

export function localCartSetCheckedAll(checked: boolean) {
  dispatch({ type: "SET_CHECKED_ALL", checked });
}

export function localCartSetCheckedMany(cartItemIds: string[], checked: boolean) {
  dispatch({ type: "SET_CHECKED_MANY", cartItemIds, checked });
}

/** Reads the current guest cart without subscribing — used once to merge into a member cart right after login. */
export function readLocalCartItems(): CartItem[] {
  ensureInitialized();
  return cartState.items;
}

/** Clears the guest cart after a successful merge into the member cart, or after a guest order is placed. */
export function clearLocalCart() {
  cartState = EMPTY_CART_STATE;
  readySnapshot = EMPTY_READY_SNAPSHOT;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}
