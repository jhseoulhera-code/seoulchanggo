import type { CartItem } from "@/types/cart";

/**
 * "loading" vs "ready" mirrors lib/authTypes.ts's AuthSnapshot — the member
 * cart loads asynchronously from Supabase, so consumers must be able to tell
 * "not fetched yet" apart from "genuinely empty".
 */
export type CartSnapshot = { status: "loading" } | { status: "ready"; items: CartItem[] };

export const CART_LOADING_SNAPSHOT: CartSnapshot = { status: "loading" };
