import "server-only";

import { globalPgStub, isGlobalPgConfigured } from "@/lib/payments/providers/globalPgStub";
import { indiaPgStub, isIndiaPgConfigured } from "@/lib/payments/providers/indiaPgStub";
import { isKoreaPgConfigured, koreaPgStub } from "@/lib/payments/providers/koreaPgStub";
import { mockPaymentProvider } from "@/lib/payments/providers/mock";
import type { PaymentProvider, PaymentProviderAdapter } from "@/lib/payments/types";
import type { CountryCode } from "@/types/market";

/**
 * Picks the real provider for a market only once its credentials actually
 * exist; otherwise falls back to MOCK (STEP 11 spec section 33 — never a
 * silent production fallback in intent, but there is no environment
 * distinction to gate on here since no real credentials exist anywhere yet).
 * Once KOREA_PG_CLIENT_KEY/SECRET (etc.) are set, this starts resolving to
 * the real stub automatically — no code change needed here.
 */
export function resolveProviderForMarket(market: CountryCode): PaymentProvider {
  if (market === "KR" && isKoreaPgConfigured()) return "KOREA_PG";
  if (market === "IN" && isIndiaPgConfigured()) return "INDIA_PG";
  if (isGlobalPgConfigured()) return "GLOBAL_PG";
  return "MOCK";
}

export function getPaymentAdapter(provider: PaymentProvider): PaymentProviderAdapter {
  switch (provider) {
    case "KOREA_PG":
      return koreaPgStub;
    case "INDIA_PG":
      return indiaPgStub;
    case "GLOBAL_PG":
      return globalPgStub;
    case "MOCK":
    default:
      return mockPaymentProvider;
  }
}
