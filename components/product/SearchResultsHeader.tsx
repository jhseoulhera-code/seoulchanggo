"use client";

import { ListHeader } from "@/components/layout/ListHeader";
import { useMarket } from "@/contexts/MarketContext";
import { getMessages } from "@/messages";

/** Locale-aware page title for /search's results view — see SearchPromptState.tsx for why this needs to be a client wrapper. */
export function SearchResultsHeader() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  return <ListHeader title={messages.search.resultsFor} />;
}
