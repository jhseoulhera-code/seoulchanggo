"use client";

import { ChevronRight } from "lucide-react";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";
import type { Messages } from "@/messages";

type SectionHeadingProps = {
  titleKey: keyof Messages["home"];
  showMore?: boolean;
};

export function SectionHeading({ titleKey, showMore }: SectionHeadingProps) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold text-text-main md:text-lg">{messages.home[titleKey]}</h2>
      {showMore && (
        <button
          type="button"
          className="flex cursor-not-allowed items-center gap-0.5 text-xs text-text-secondary"
        >
          {messages.home.more}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
