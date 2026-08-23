import "server-only";

import { cookies } from "next/headers";

/**
 * STEP 20 spec section 5 — guest cart identity. An httpOnly cookie (never
 * readable by client JS, so it can't be exfiltrated via XSS or read/forged
 * by a script) rather than localStorage holding the actual cart contents —
 * the token is opaque and meaningless without the server-side cart_items
 * rows it's matched against via the STEP 20 migration's SECURITY DEFINER
 * RPCs (cart_get_items/cart_add_item/... all take this as a parameter and
 * resolve it server-side; RLS denies any direct client table access).
 */
const CART_TOKEN_COOKIE = "cart_token";
const CART_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Read-only — safe to call from a Server Component render. Never creates a cookie, so viewing a page never manufactures empty guest cart state. */
export async function getCartToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_TOKEN_COOKIE)?.value ?? null;
}

/** Only meaningfully settable from a Server Action/Route Handler — mirrors lib/supabase/server.ts's own try/catch for a Server Component render, where cookies() can't be written. */
export async function getOrCreateCartToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_TOKEN_COOKIE)?.value;
  if (existing) return existing;

  const token = crypto.randomUUID();
  try {
    store.set(CART_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: CART_TOKEN_MAX_AGE_SECONDS,
    });
  } catch {
    // Called from a Server Component render, not an Action/Route Handler — the
    // token still works for this one request (returned below), it just won't
    // persist past it.
  }
  return token;
}

/** STEP 20 spec section 23 — called on sign-out so a stranger on the same browser never inherits the signed-out user's session data via a leftover guest identity, and after a successful guest→member merge so the emptied guest cart can never be merged twice. */
export async function clearCartToken(): Promise<void> {
  const store = await cookies();
  try {
    store.delete(CART_TOKEN_COOKIE);
  } catch {
    // Server Component render — nothing to do; the cookie is harmless once its cart_items row is gone.
  }
}
