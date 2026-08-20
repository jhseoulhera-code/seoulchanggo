import type { BuyNowItem } from "@/types/cart";

const BUY_NOW_STORAGE_KEY = "seoulchanggo:buyNowItem";

/** Session-scoped "buy now" intent, kept separate from the persistent cart so it never lingers across visits. */
export function setBuyNowItem(item: BuyNowItem): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(BUY_NOW_STORAGE_KEY, JSON.stringify(item));
}

export function getBuyNowItem(): BuyNowItem | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(BUY_NOW_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BuyNowItem;
  } catch {
    return null;
  }
}

export function clearBuyNowItem(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(BUY_NOW_STORAGE_KEY);
}
