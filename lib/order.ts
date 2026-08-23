import type { Order } from "@/types/order";

const GUEST_ORDERS_KEY = "seoulchanggo:guestOrders";
const CHECKOUT_IDEMPOTENCY_KEY_PREFIX = "seoulchanggo:checkoutIdempotencyKey:";

/**
 * STEP 22 — 8 random base36 chars (~2.8×10^12 combinations per day) rather
 * than STEP 08's original 4 (~1.7×10^6, an uncomfortably real collision risk
 * once order volume grows). The DB's own `orders_order_number_key` unique
 * constraint is still the actual guarantee (see the STEP 22 migration's
 * create_order() exception handling) — this only makes a real collision
 * astronomically unlikely rather than merely "unlikely".
 */
export function generateOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Array.from({ length: 8 }, () => Math.floor(Math.random() * 36).toString(36))
    .join("")
    .toUpperCase();
  return `ORD-${y}${m}${d}-${random}`;
}

/**
 * STEP 22 idempotency key — generated once per checkout attempt and kept in
 * sessionStorage (not React state alone) specifically so it survives a page
 * reload, not just a re-render: a double-click, a reload, or a network
 * retry during the SAME attempt all reuse this same key, so create_order()
 * can recognize a resubmit and return the original order instead of
 * creating a second one. Cleared only once the attempt is truly finished
 * (see clearCheckoutIdempotencyKey), never right after order creation
 * succeeds — the order can still exist unpaid at that point, and a retry
 * before payment completes must keep resolving to the same order.
 */
export function getOrCreateCheckoutIdempotencyKey(source: "cart" | "buynow"): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const storageKey = `${CHECKOUT_IDEMPOTENCY_KEY_PREFIX}${source}`;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

/** Called once a checkout attempt is truly done (payment succeeded, or the no-Supabase local fallback ran) so the NEXT checkout starts a fresh key. */
export function clearCheckoutIdempotencyKey(source: "cart" | "buynow"): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${CHECKOUT_IDEMPOTENCY_KEY_PREFIX}${source}`);
}

export function saveGuestOrder(order: Order): void {
  if (typeof window === "undefined") return;
  const orders = getGuestOrders();
  window.localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify([order, ...orders]));
}

export function getGuestOrders(): Order[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(GUEST_ORDERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

export function findGuestOrder(orderId: string): Order | null {
  return getGuestOrders().find((order) => order.orderId === orderId) ?? null;
}

/** Minimal guest verification: order id plus either the email or phone on file — no account/auth system involved. */
export function lookupGuestOrder(orderId: string, contact: string): Order | null {
  const order = findGuestOrder(orderId.trim());
  if (!order) return null;

  const normalizedContact = contact.trim().toLowerCase();
  const matchesEmail = order.customer.email.toLowerCase() === normalizedContact;

  const digitsOnly = contact.replace(/\D/g, "");
  const matchesPhone = digitsOnly.length > 0 && order.customer.phone.replace(/\D/g, "") === digitsOnly;

  return matchesEmail || matchesPhone ? order : null;
}
