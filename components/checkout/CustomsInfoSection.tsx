"use client";

import { FormField } from "@/components/checkout/FormField";
import { getMessages } from "@/messages";
import type { Market } from "@/types/market";

type CustomsInfoSectionProps = {
  market: Market;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export function CustomsInfoSection({ market, value, error, onChange }: CustomsInfoSectionProps) {
  const messages = getMessages(market.locale);

  return (
    <section className="flex flex-col gap-2 border border-border p-3.5">
      <h2 className="text-sm font-bold text-text-main">{messages.checkout.customsSection}</h2>
      <p className="text-xs leading-relaxed text-text-secondary">{messages.checkout.customsNotice}</p>
      <FormField
        label={messages.checkout.customsCodeLabel}
        value={value}
        onChange={onChange}
        error={error}
        placeholder="P123456789012"
      />
    </section>
  );
}
