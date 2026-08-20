"use client";

import { ListHeader } from "@/components/layout/ListHeader";
import { useMarket } from "@/contexts/MarketContext";
import { getLocalizedCategoryLabel } from "@/lib/productLocalization";

export function CategoryPageHeader({ label, labelEn }: { label: string; labelEn?: string }) {
  const { market } = useMarket();
  return <ListHeader title={getLocalizedCategoryLabel({ label, labelEn }, market.locale)} />;
}
