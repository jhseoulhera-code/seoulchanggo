"use client";

import { cn } from "@/lib/utils";
import { paymentMethodLabel } from "@/lib/paymentLabels";
import { getMessages } from "@/messages";
import type { Market } from "@/types/market";
import type { PaymentMethodId } from "@/types/order";

type PaymentMethodSelectorProps = {
  market: Market;
  options: PaymentMethodId[];
  selected: PaymentMethodId | null;
  error?: string;
  onChange: (id: PaymentMethodId) => void;
};

export function PaymentMethodSelector({
  market,
  options,
  selected,
  error,
  onChange,
}: PaymentMethodSelectorProps) {
  const messages = getMessages(market.locale);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">{messages.checkout.paymentSection}</h2>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "flex items-center gap-3 border px-3.5 py-3 text-sm text-text-main",
              selected === option ? "border-primary" : "border-border"
            )}
          >
            <input
              type="radio"
              name="payment-method"
              checked={selected === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 accent-primary"
            />
            {paymentMethodLabel(option, market.locale)}
          </label>
        ))}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </section>
  );
}
