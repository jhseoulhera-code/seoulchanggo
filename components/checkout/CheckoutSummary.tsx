"use client";

import { formatCurrency } from "@/lib/currency";
import { getMessages } from "@/messages";
import type { CartSummaryTotals } from "@/types/cart";
import type { Market } from "@/types/market";

type CheckoutSummaryProps = {
  totals: CartSummaryTotals;
  market: Market;
  variant: "fixed" | "card";
  onSubmit: () => void;
  disabled: boolean;
};

export function CheckoutSummary({ totals, market, variant, onSubmit, disabled }: CheckoutSummaryProps) {
  const messages = getMessages(market.locale);
  const label = messages.checkout.submitButton;

  if (variant === "fixed") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 py-3 md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-text-secondary">{messages.checkout.total}</span>
          <span className="text-lg font-bold text-text-main">
            {formatCurrency(totals.grandTotal, market.currency)}
          </span>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="h-12 w-full bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
        >
          {label}
        </button>
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
        <span className="text-text-main">{messages.checkout.total}</span>
        <span className="text-text-main">{formatCurrency(totals.grandTotal, market.currency)}</span>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="mt-1 h-12 w-full bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
      >
        {label}
      </button>
    </div>
  );
}
