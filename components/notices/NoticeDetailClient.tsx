"use client";

import { useMarket } from "@/contexts/MarketContext";
import type { Notice } from "@/lib/repositories/notices";

export function NoticeDetailClient({ notice }: { notice: Notice }) {
  const { market } = useMarket();
  const isKo = market.locale === "ko";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-base font-bold text-text-main">{isKo ? notice.titleKo : notice.titleEn}</h1>
        <p className="mt-1 text-xs text-text-secondary">{new Date(notice.publishedAt).toLocaleDateString("ko-KR")}</p>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-main">{isKo ? notice.contentKo : notice.contentEn}</p>
    </div>
  );
}
