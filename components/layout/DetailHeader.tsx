"use client";

import { ChevronLeft, Heart, Share2 } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/common/PageContainer";
import { MarketSelector } from "@/components/layout/MarketSelector";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

export function DetailHeader() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <PageContainer>
        <div className="flex items-center justify-between py-3.5">
          <Link href="/" aria-label={messages.common.backToHome} className="text-text-main">
            <ChevronLeft size={22} />
          </Link>
          <div className="flex items-center gap-3 text-text-main">
            <MarketSelector />
            <button type="button" aria-label={messages.a11y.share} className="cursor-not-allowed">
              <Share2 size={19} />
            </button>
            <button type="button" aria-label={messages.a11y.wishlist} className="cursor-not-allowed">
              <Heart size={20} />
            </button>
          </div>
        </div>
      </PageContainer>
    </header>
  );
}
