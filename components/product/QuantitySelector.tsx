"use client";

import { Minus, Plus } from "lucide-react";

type QuantitySelectorProps = {
  value: number;
  onChange: (next: number) => void;
  max?: number;
};

export function QuantitySelector({ value, onChange, max }: QuantitySelectorProps) {
  const canIncrease = max === undefined || value < max;

  return (
    <div className="flex items-center border border-border">
      <button
        type="button"
        aria-label="수량 감소"
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
        aria-label="수량 증가"
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        disabled={!canIncrease}
        className="flex h-9 w-9 items-center justify-center text-text-main disabled:text-border"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
