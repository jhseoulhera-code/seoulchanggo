"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

export function ImageSearchComingSoon() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <Camera size={36} className="text-text-secondary" />
      <p className="text-sm text-text-main">{messages.search.imageSearchComingSoon}</p>
      <p className="text-xs text-text-secondary">{messages.search.imageSearchComingSoonHint}</p>
      <Link href="/search" className="mt-2 text-xs font-bold text-primary underline">
        {messages.search.goToTextSearch}
      </Link>
    </div>
  );
}
