"use client";

import { Search } from "lucide-react";
import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

/** The no-query-yet state for /search — a small client wrapper so the header title and prompt text can follow the viewer's locale (Server Components have no Market/Locale representation). */
export function SearchPromptState() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <>
      <ListHeader title={messages.search.pageTitle} />
      <main className="pb-24 md:pb-10">
        <PageContainer>
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <Search size={36} className="text-text-secondary" />
            <p className="text-sm text-text-secondary">{messages.search.enterKeyword}</p>
          </div>
        </PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
