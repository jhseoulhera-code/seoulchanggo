"use client";

import { useMarket } from "@/contexts/MarketContext";
import { getMessages, t } from "@/messages";

export function CategoryProductCount({ count }: { count: number }) {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  return (
    <div className="border-b border-border py-3">
      <span className="text-sm text-text-secondary">{t(messages.product.totalCount, { count })}</span>
    </div>
  );
}
