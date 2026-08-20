import { mockImageSearchProvider } from "@/lib/imageSearch/providers/mock";
import type { ImageSearchProviderAdapter } from "@/lib/imageSearch/types";

/**
 * STEP 12 spec section 14: safe fallback before a real Vision provider
 * exists. Today this always resolves to MOCK — swapping in a real
 * FUTURE_VISION_PROVIDER later is a one-line change here, gated on real
 * provider credentials the same way lib/payments/registry.ts gates real PG
 * credentials. The production/dev gate itself lives in
 * lib/actions/imageSearch.ts, not here, so it applies no matter which
 * provider this ever resolves to.
 */
export function resolveImageSearchProvider(): ImageSearchProviderAdapter {
  return mockImageSearchProvider;
}
