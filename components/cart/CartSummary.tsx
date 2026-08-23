"use client";

import { formatCurrency } from "@/lib/currency";
import { getMessages, t } from "@/messages";
import type { CartSummaryTotals } from "@/types/cart";
import type { Market } from "@/types/market";

type CartSummaryProps = {
  totals: CartSummaryTotals;
  market: Market;
  variant: "fixed" | "card";
  onCheckout: () => void;
  /** STEP 20 spec section 33/38 — set while checkout can't safely proceed yet (e.g. a selected option-product line, which /checkout doesn't price correctly yet); shown under the button and forces it disabled. */
  blockedReason?: string;
};

export function CartSummary({ totals, market, variant, onCheckout, blockedReason }: CartSummaryProps) {
  const messages = getMessages(market.locale);
  const disabled = totals.selectedCount === 0 || Boolean(blockedReason);
  const checkoutLabel = t(messages.cart.checkoutButton, { count: totals.selectedCount });

  if (variant === "fixed") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 py-3 md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-text-secondary">{t(messages.cart.itemCount, { count: totals.selectedCount })}</span>
          <span className="text-lg font-bold text-text-main">
            {formatCurrency(totals.grandTotal, market.currency)}
          </span>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={disabled}
          className="h-12 w-full bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
        >
          {checkoutLabel}
        </button>
        {blockedReason && <p className="mt-1.5 text-center text-xs text-text-secondary">{blockedReason}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border border-border p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{messages.cart.itemsTotal}</span>
        <span className="text-text-main">{formatCurrency(totals.itemsTotal, market.currency)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{messages.cart.discountTotal}</span>
        <span className="text-primary">-{formatCurrency(totals.discountTotal, market.currency)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-secondary">{messages.cart.shippingTotal}</span>
        <span className="text-text-main">{formatCurrency(totals.shippingTotal, market.currency)}</span>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3 text-base font-bold">
        <span className="text-text-main">{messages.cart.grandTotal}</span>
        <span className="text-text-main">{formatCurrency(totals.grandTotal, market.currency)}</span>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={disabled}
        className="mt-1 h-12 w-full bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
      >
        {checkoutLabel}
      </button>
      {blockedReason && <p className="text-center text-xs text-text-secondary">{blockedReason}</p>}
    </div>
  );
}
