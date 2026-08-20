import type { Order } from "@/types/order";

const GUEST_ORDERS_KEY = "seoulchanggo:guestOrders";

export function generateOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${y}${m}${d}-${random}`;
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
