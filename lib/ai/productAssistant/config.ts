/**
 * Single place the OpenAI model name and every length/size limit for the AI
 * Product Assistant is defined (STEP 17 spec section 1: "모델 이름은 코드
 * 한 곳에서만 관리 가능하게"). No React/Supabase import — safe to read from
 * both a Route Handler and a plain test script.
 */

/** OPENAI_MODEL env override; this is the only fallback value in the codebase. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export type AiProductProviderChoice = "mock" | "openai";

/** AI_PRODUCT_PROVIDER=mock|openai — unset means "auto" (prefer openai when a key exists). */
export function getExplicitProviderChoice(): AiProductProviderChoice | null {
  const raw = process.env.AI_PRODUCT_PROVIDER?.trim().toLowerCase();
  return raw === "mock" || raw === "openai" ? raw : null;
}

// Input caps (STEP 17 section 6/8) — enforced server-side regardless of what
// the browser sends, so one oversized paste can't blow up token cost or a
// prompt-injection payload's effective size.
export const MAX_SUPPLIER_TEXT_LENGTH = 4000;
export const MAX_SHORT_FIELD_LENGTH = 200;
export const MAX_LONG_FIELD_LENGTH = 2000;
export const MAX_ARRAY_ITEMS = 10;
export const MAX_CATEGORY_OPTIONS = 200;

// Output caps — bounds the OpenAI request itself (cost guard) and is also
// used as an upper bound when parsing/sanitizing whatever comes back.
export const OPENAI_MAX_OUTPUT_TOKENS = 1200;
export const OPENAI_REQUEST_TIMEOUT_MS = 20_000;

// Minimal per-admin rate limit (STEP 17 section 8) — deliberately small and
// in-memory (see lib/ai/rateLimit.ts); this is a cost/abuse guard, not a
// precise quota system.
export const AI_RATE_LIMIT_MAX_CALLS = 20;
export const AI_RATE_LIMIT_WINDOW_MS = 60_000;
