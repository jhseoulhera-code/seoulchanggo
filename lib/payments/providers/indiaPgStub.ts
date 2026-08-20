import "server-only";

import { createStubAdapter, isProviderConfigured } from "@/lib/payments/providers/stubFactory";

export const INDIA_PG_ENV_VARS = ["INDIA_PG_KEY_ID", "INDIA_PG_KEY_SECRET"];

/** Razorpay, etc. — supports UPI/card/net banking/wallet once connected. */
export const indiaPgStub = createStubAdapter("INDIA_PG", INDIA_PG_ENV_VARS);

export function isIndiaPgConfigured(): boolean {
  return isProviderConfigured(INDIA_PG_ENV_VARS);
}
