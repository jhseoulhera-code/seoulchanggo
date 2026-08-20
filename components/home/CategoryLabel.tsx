"use client";

import { useMarket } from "@/contexts/MarketContext";
import { getLocalizedCategoryLabel } from "@/lib/productLocalization";

export function CategoryLabel({ label, labelEn }: { label: string; labelEn?: string }) {
  const { market } = useMarket();

  return (
    <span className="text-center text-[11px] leading-tight text-text-secondary">
      {getLocalizedCategoryLabel({ label, labelEn }, market.locale)}
    </span>
  );
}
