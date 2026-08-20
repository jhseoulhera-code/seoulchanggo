"use client";

import { Camera, Menu, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";
import { HeaderSearchBox } from "@/components/layout/HeaderSearchBox";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

export function Header() {
  const { totalQuantity } = useCart();
  const { currentUser, isAuthenticated } = useAuth();
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <PageContainer>
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <button type="button" aria-label={messages.a11y.menu} className="cursor-not-allowed text-text-main">
              <Menu size={22} />
            </button>
            <Link href="/" className="text-xl font-bold text-primary">
              서울창고
            </Link>
          </div>
          <div className="flex items-center gap-3 text-text-main">
            <MarketSelector />
            <Link
              href={isAuthenticated ? "/mypage" : "/auth?returnTo=/mypage"}
              aria-label={messages.nav.myPage}
              className="flex items-center gap-1.5"
            >
              <User size={22} />
              {isAuthenticated && currentUser && (
                <span className="hidden text-sm font-medium md:inline">{currentUser.displayName}</span>
              )}
            </Link>
            <Link href="/cart" aria-label={messages.a11y.cart} className="relative">
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
          <HeaderSearchBox />
          <Link
            href="/search/image"
            aria-label={messages.a11y.cameraSearch}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-border text-text-secondary"
          >
            <Camera size={19} />
          </Link>
        </div>
      </PageContainer>
    </header>
  );
}
