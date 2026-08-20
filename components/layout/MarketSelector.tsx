"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/common/BottomSheet";
import { useMarket } from "@/contexts/MarketContext";
import { MARKET_LIST } from "@/data/markets";
import { getMessages } from "@/messages";
import { cn } from "@/lib/utils";
import type { CurrencyCode, LocaleCode } from "@/types/market";

const LOCALE_OPTIONS: LocaleCode[] = ["ko", "en"];
const CURRENCY_OPTIONS: CurrencyCode[] = ["KRW", "INR", "USD"];

/**
 * Combined Country / Language / Currency settings sheet (STEP 13 spec
 * sections 1, 29-30, and the USD addendum's section 4) — one entry point
 * instead of three separate header buttons, matching the existing compact
 * visual language. Country still drives shipping-market defaults; Language
 * and Currency are independent overrides (contexts/MarketContext.tsx) that
 * persist across Country changes.
 */
export function MarketSelector() {
  const { market, setMarketByCountry, setLocale, setCurrency } = useMarket();
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
        {market.countryName} · {messages.localeSelector[market.locale]} · {market.currency}
        <ChevronDown size={12} className="text-text-secondary" />
      </button>

      <BottomSheet open={open} title={messages.market.selectorTitle} onClose={() => setOpen(false)} closeLabel={messages.a11y.backButton}>
        <div className="flex flex-col gap-6">
          <section>
            <h4 className="mb-2 text-xs font-bold text-text-secondary">{messages.market.selectorTitle}</h4>
            <div className="flex flex-col">
              {MARKET_LIST.map((item) => {
                const isActive = item.countryCode === market.countryCode;
                return (
                  <button
                    key={item.countryCode}
                    type="button"
                    onClick={() => setMarketByCountry(item.countryCode)}
                    className={cn(
                      "flex items-center justify-between border-b border-border py-3 text-left text-sm last:border-b-0",
                      isActive ? "font-bold text-primary" : "text-text-main"
                    )}
                  >
                    <span>{item.countryName}</span>
                    {isActive && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-t border-border pt-5">
            <h4 className="mb-2 text-xs font-bold text-text-secondary">{messages.localeSelector.title}</h4>
            <div className="flex flex-col">
              {LOCALE_OPTIONS.map((locale) => {
                const isActive = market.locale === locale;
                return (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setLocale(locale)}
                    className={cn(
                      "flex items-center justify-between border-b border-border py-3 text-left text-sm last:border-b-0",
                      isActive ? "font-bold text-primary" : "text-text-main"
                    )}
                  >
                    <span>{messages.localeSelector[locale]}</span>
                    {isActive && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-t border-border pt-5">
            <h4 className="mb-2 text-xs font-bold text-text-secondary">{messages.currencySelector.title}</h4>
            <div className="flex flex-col">
              {CURRENCY_OPTIONS.map((currency) => {
                const isActive = market.currency === currency;
                const label =
                  currency === "KRW" ? messages.currencySelector.krw : currency === "INR" ? messages.currencySelector.inr : messages.currencySelector.usd;
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setCurrency(currency)}
                    className={cn(
                      "flex items-center justify-between border-b border-border py-3 text-left text-sm last:border-b-0",
                      isActive ? "font-bold text-primary" : "text-text-main"
                    )}
                  >
                    <span>{label}</span>
                    {isActive && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </BottomSheet>
    </>
  );
}
