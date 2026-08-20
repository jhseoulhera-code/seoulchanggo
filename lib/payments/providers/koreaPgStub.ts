import "server-only";

import { createStubAdapter, isProviderConfigured } from "@/lib/payments/providers/stubFactory";

export const KOREA_PG_ENV_VARS = ["KOREA_PG_CLIENT_KEY", "KOREA_PG_SECRET_KEY"];

/** Toss Payments / PortOne, etc. — pick one once a contract exists. */
export const koreaPgStub = createStubAdapter("KOREA_PG", KOREA_PG_ENV_VARS);

export function isKoreaPgConfigured(): boolean {
  return isProviderConfigured(KOREA_PG_ENV_VARS);
}
