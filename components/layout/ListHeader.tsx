"use client";

import { ChevronLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { useCart } from "@/contexts/CartContext";

type ListHeaderProps = {
  title: string;
  hideCartIcon?: boolean;
};

export function ListHeader({ title, hideCartIcon }: ListHeaderProps) {
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <PageContainer>
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="홈으로" className="text-text-main">
              <ChevronLeft size={22} />
            </Link>
            <h1 className="text-base font-bold text-text-main">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <MarketSelector />
            {!hideCartIcon && (
              <Link href="/cart" aria-label="장바구니" className="relative text-text-main">
                <ShoppingCart size={21} />
                {totalQuantity > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                    {totalQuantity}
                  </span>
                )}
              </Link>
            )}
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
