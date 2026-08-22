import { mockAiProductAssistant } from "@/lib/ai/productAssistant/providers/mock";
import type { AiProductAssistantAdapter } from "@/lib/ai/productAssistant/types";

/**
 * STEP 16 spec section 4: safe fallback before a real LLM provider is
 * contracted. Always resolves to MOCK today — swapping in a real
 * FUTURE_LLM_PROVIDER later (once an API key exists, e.g.
 * AI_PRODUCT_ASSISTANT_API_KEY) is meant to be a one-line change here,
 * gated the same way lib/payments/registry.ts and
 * lib/imageSearch/registry.ts gate their own real providers. This never
 * throws and never requires any env var to be set — an unconfigured AI
 * provider degrades to honest mock drafts, not a broken Wizard.
 */
export function resolveAiProductAssistant(): AiProductAssistantAdapter {
  return mockAiProductAssistant;
}
