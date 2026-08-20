"use client";

import { Heart } from "lucide-react";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import { getMessages } from "@/messages";

type PurchaseActionsProps = {
  variant: "fixed" | "inline";
  onAddToCart: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
};

export function PurchaseActions({
  variant,
  onAddToCart,
  onBuyNow,
  disabled,
}: PurchaseActionsProps) {
  const isFixed = variant === "fixed";
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div
      className={cn(
        isFixed
          ? "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden"
          : "hidden md:block"
      )}
    >
      <div className={cn("flex items-stretch gap-2", isFixed && "px-4 py-3")}>
        <button
          type="button"
          aria-label={messages.a11y.wishlist}
          className="flex h-12 w-12 flex-shrink-0 cursor-not-allowed items-center justify-center border border-border text-text-secondary"
        >
          <Heart size={20} />
        </button>
        <button
          type="button"
          onClick={onAddToCart}
          disabled={disabled}
          className="h-12 flex-1 border border-primary text-sm font-bold text-primary disabled:cursor-not-allowed disabled:border-border disabled:text-text-secondary"
        >
          {messages.a11y.cart}
        </button>
        <button
          type="button"
          onClick={onBuyNow}
          disabled={disabled}
          className="h-12 flex-1 bg-primary text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
        >
          {messages.product.buyNow}
        </button>
      </div>
    </div>
  );
}
