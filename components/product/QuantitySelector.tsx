"use client";

import { Minus, Plus } from "lucide-react";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

type QuantitySelectorProps = {
  value: number;
  onChange: (next: number) => void;
  max?: number;
};

export function QuantitySelector({ value, onChange, max }: QuantitySelectorProps) {
  const canIncrease = max === undefined || value < max;
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div className="flex items-center border border-border">
      <button
        type="button"
        aria-label={messages.a11y.decreaseQuantity}
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="flex h-9 w-9 items-center justify-center text-text-main disabled:text-border"
      >
        <Minus size={15} />
      </button>
      <span className="flex h-9 w-10 items-center justify-center border-x border-border text-sm font-medium text-text-main">
        {value}
      </span>
      <button
        type="button"
        aria-label={messages.a11y.increaseQuantity}
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        disabled={!canIncrease}
        className="flex h-9 w-9 items-center justify-center text-text-main disabled:text-border"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
