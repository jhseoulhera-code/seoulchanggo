"use client";

import { PageContainer } from "@/components/common/PageContainer";
import { BottomNav } from "@/components/layout/BottomNav";
import { ListHeader } from "@/components/layout/ListHeader";
import { ImageSearchClient } from "@/components/product/ImageSearchClient";
import { ImageSearchComingSoon } from "@/components/product/ImageSearchComingSoon";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

/**
 * STEP 12 spec sections 10-14, 21-30. Only ever shows the real upload/preview
 * flow outside production — there is no real Vision provider connected yet
 * (see lib/imageSearch/registry.ts), so production users see an honest
 * "coming soon" state instead of a feature that only pretends to search.
 */
const IMAGE_SEARCH_ENABLED = process.env.NODE_ENV !== "production";

export default function ImageSearchPage() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <>
      <ListHeader title={messages.search.imageSearchTitle} />
      <main className="pb-24 md:pb-10">
        <PageContainer>{IMAGE_SEARCH_ENABLED ? <ImageSearchClient /> : <ImageSearchComingSoon />}</PageContainer>
      </main>
      <BottomNav />
    </>
  );
}
