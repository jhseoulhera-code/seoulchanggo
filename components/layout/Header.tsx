"use client";

import { Camera, Menu, Search, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { useCart } from "@/contexts/CartContext";

export function Header() {
  const { totalQuantity } = useCart();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <PageContainer>
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <button type="button" aria-label="전체 메뉴" className="cursor-not-allowed text-text-main">
              <Menu size={22} />
            </button>
            <Link href="/" className="text-xl font-bold text-primary">
              서울창고
            </Link>
          </div>
          <div className="flex items-center gap-3 text-text-main">
            <MarketSelector />
            <button type="button" aria-label="마이페이지" className="cursor-not-allowed">
              <User size={22} />
            </button>
            <Link href="/cart" aria-label="장바구니" className="relative">
              <ShoppingCart size={22} />
              {totalQuantity > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                  {totalQuantity}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 pb-3 md:max-w-xl">
          <Link
            href="/search"
            className="flex flex-1 items-center gap-2 rounded-full border border-border bg-white px-4 py-3"
          >
            <Search size={19} className="shrink-0 text-text-secondary" />
            <span className="text-[15px] text-text-secondary">상품을 검색해보세요</span>
          </Link>
          <button
            type="button"
            aria-label="이미지로 검색"
            className="flex h-11 w-11 flex-shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-border text-text-secondary"
          >
            <Camera size={19} />
          </button>
        </div>
      </PageContainer>
    </header>
  );
}
