"use client";

import { useEffect } from "react";
import { useMarket } from "@/contexts/MarketContext";

/**
 * Keeps <html lang> in sync with the viewer's effective locale (STEP 13
 * spec section 33). The server always renders lang="ko" (MarketContext's
 * getServerSnapshot has no way to know the real locale — see
 * contexts/MarketContext.tsx) — this corrects it client-side the moment the
 * Market/locale is known, and again whenever the viewer changes it.
 */
export function HtmlLangSync() {
  const { market } = useMarket();

  useEffect(() => {
    document.documentElement.lang = market.locale;
  }, [market.locale]);

  return null;
}
