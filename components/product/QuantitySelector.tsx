"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

export function QuantitySelector() {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex items-center border border-border">
      <button
        type="button"
        aria-label="수량 감소"
        onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
        disabled={quantity <= 1}
        className="flex h-9 w-9 items-center justify-center text-text-main disabled:text-border"
      >
        <Minus size={15} />
      </button>
      <span className="flex h-9 w-10 items-center justify-center border-x border-border text-sm font-medium text-text-main">
        {quantity}
      </span>
      <button
        type="button"
        aria-label="수량 증가"
        onClick={() => setQuantity((prev) => prev + 1)}
        className="flex h-9 w-9 items-center justify-center text-text-main"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
