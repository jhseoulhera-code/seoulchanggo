"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { useMarket } from "@/contexts/MarketContext";
import { MARKET_LIST } from "@/data/markets";
import { getMessages } from "@/messages";
import { cn } from "@/lib/utils";

export function MarketSelector() {
  const { market, setMarketByCountry } = useMarket();
  const [open, setOpen] = useState(false);
  const messages = getMessages(market.locale);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 border border-border px-2 py-1.5 text-xs font-medium text-text-main"
      >
        <Globe size={13} className="text-text-secondary" />
        {market.countryName} · {market.currency}
        <ChevronDown size={12} className="text-text-secondary" />
      </button>

      <BottomSheet open={open} title={messages.market.selectorTitle} onClose={() => setOpen(false)}>
        <div className="flex flex-col">
          {MARKET_LIST.map((item) => {
            const isActive = item.countryCode === market.countryCode;
            return (
              <button
                key={item.countryCode}
                type="button"
                onClick={() => {
                  setMarketByCountry(item.countryCode);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between border-b border-border py-3 text-left text-sm last:border-b-0",
                  isActive ? "font-bold text-primary" : "text-text-main"
                )}
              >
                <span>
                  {item.countryName} · {item.currency}
                </span>
                {isActive && <Check size={16} />}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
