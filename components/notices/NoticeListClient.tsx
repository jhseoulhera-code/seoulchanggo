"use client";

import Link from "next/link";
import { useMarket } from "@/contexts/MarketContext";
import type { Notice } from "@/lib/repositories/notices";

export function NoticeListClient({ notices }: { notices: Notice[] }) {
  const { market } = useMarket();
  const isKo = market.locale === "ko";

  if (notices.length === 0) {
    return <p className="py-16 text-center text-sm text-text-secondary">등록된 공지사항이 없습니다.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border border-t border-border">
      {notices.map((notice) => (
        <li key={notice.id}>
          <Link href={`/notices/${notice.id}`} className="flex items-center justify-between px-1 py-3.5 text-sm">
            <span className="flex items-center gap-2 text-text-main">
              {notice.isPinned && <span className="border border-primary px-1.5 py-0.5 text-[10px] font-bold text-primary">중요</span>}
              {isKo ? notice.titleKo : notice.titleEn}
            </span>
            <span className="shrink-0 text-xs text-text-secondary">{new Date(notice.publishedAt).toLocaleDateString("ko-KR")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
