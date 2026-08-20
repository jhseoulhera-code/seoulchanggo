import "server-only";

import { createStubAdapter, isProviderConfigured } from "@/lib/payments/providers/stubFactory";

export const GLOBAL_PG_ENV_VARS = ["GLOBAL_PG_PUBLIC_KEY", "GLOBAL_PG_SECRET_KEY"];

/** Stripe, etc. — fallback card processor for markets without a dedicated adapter yet. */
export const globalPgStub = createStubAdapter("GLOBAL_PG", GLOBAL_PG_ENV_VARS);

export function isGlobalPgConfigured(): boolean {
  return isProviderConfigured(GLOBAL_PG_ENV_VARS);
}
