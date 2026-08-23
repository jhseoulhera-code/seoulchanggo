// See providers/openai.ts's top comment for why this subtree uses relative
// + extensioned imports for its own runtime cross-references.
import { getExplicitProviderChoice, isOpenAiConfigured } from "./config.ts";
import { mockAiProductAssistant } from "./providers/mock.ts";
import { openAiProductAssistant } from "./providers/openai.ts";
import type { AiProductAssistantAdapter } from "@/lib/ai/productAssistant/types";

export type ResolvedAiProvider =
  | { adapter: AiProductAssistantAdapter; forcedFallbackReason: null }
  /** Adapter is still usable (MOCK), but only because the operator's real choice couldn't be honored — surfaced so callers/logs can tell "chose mock" apart from "openai failed over to mock". */
  | { adapter: AiProductAssistantAdapter; forcedFallbackReason: string }
  /** No usable adapter at all — the caller must report "provider not configured", never silently proceed. */
  | { adapter: null; forcedFallbackReason: string };

/**
 * STEP 17 spec section 1: AI_PRODUCT_PROVIDER=mock|openai selects
 * explicitly; left unset, this prefers OPENAI whenever a key exists
 * (spec: "production: openai 권장") and otherwise falls back to MOCK.
 *
 * An explicit `AI_PRODUCT_PROVIDER=openai` with no OPENAI_API_KEY is
 * treated the same way lib/payments/registry.ts treats an unconfigured PG
 * provider: allowed to fall back to MOCK in development (keeps the Wizard
 * usable without real credentials), but reported as "not configured" in
 * production rather than silently mocking a real admin's request — an
 * admin who explicitly asked for real AI drafts deserves to know they
 * didn't get one, especially once real spend/usage tracking depends on
 * this being accurate.
 */
export function resolveAiProductAssistant(): ResolvedAiProvider {
  const explicit = getExplicitProviderChoice();
  const wantsOpenAi = explicit === "openai" || (explicit === null && isOpenAiConfigured());

  if (!wantsOpenAi) {
    return { adapter: mockAiProductAssistant, forcedFallbackReason: null };
  }

  if (isOpenAiConfigured()) {
    return { adapter: openAiProductAssistant, forcedFallbackReason: null };
  }

  if (process.env.NODE_ENV === "production") {
    return { adapter: null, forcedFallbackReason: "OPENAI_API_KEY가 설정되지 않았습니다." };
  }
  return { adapter: mockAiProductAssistant, forcedFallbackReason: "OPENAI_API_KEY가 없어 개발 환경에서 mock으로 대체합니다." };
}
