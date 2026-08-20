"use client";

import { useMarket } from "@/contexts/MarketContext";
import { formatDate } from "@/lib/intl";
import type { Notice } from "@/lib/repositories/notices";

export function NoticeDetailClient({ notice }: { notice: Notice }) {
  const { market } = useMarket();
  const isKo = market.locale === "ko";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-base font-bold text-text-main">{isKo ? notice.titleKo : notice.titleEn || notice.titleKo}</h1>
        <p className="mt-1 text-xs text-text-secondary">{formatDate(notice.publishedAt, market.locale)}</p>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-main">
        {isKo ? notice.contentKo : notice.contentEn || notice.contentKo}
      </p>
    </div>
  );
}
