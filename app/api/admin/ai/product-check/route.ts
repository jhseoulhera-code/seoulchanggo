import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { logAiCall } from "@/app/api/admin/ai/_telemetry";
import { AI_RATE_LIMIT_MAX_CALLS, AI_RATE_LIMIT_WINDOW_MS } from "@/lib/ai/productAssistant/config";
import { checkMissingFields } from "@/lib/ai/productAssistant/checkMissingFields";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import { checkRateLimit } from "@/lib/ai/rateLimit";
import type { MissingFieldCheckInput } from "@/lib/ai/productAssistant/types";

const FUNCTION_TYPE = "product-check";

/**
 * Covers spec feature 10 (입력 누락 항목 점검) — pure rule-based, no free-text
 * generation and no LLM call regardless of which provider is configured
 * (see checkMissingFields.ts's own comment on why). resolveAiProductAssistant()
 * is only consulted here to pick which provider name to stamp on the
 * result for the UI's "AI: OpenAI"/"AI: Mock" label — never to decide
 * whether this check can run at all.
 */
export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard.denied) return guard.denied;

  const rate = checkRateLimit(`${FUNCTION_TYPE}:${guard.profile.id}`, AI_RATE_LIMIT_MAX_CALLS, AI_RATE_LIMIT_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: MissingFieldCheckInput;
  try {
    body = (await request.json()) as MissingFieldCheckInput;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const providerName = resolveAiProductAssistant().adapter?.name ?? "MOCK";
  const startedAt = Date.now();
  const result = checkMissingFields(body, providerName);
  logAiCall({ adminId: guard.profile.id, functionType: FUNCTION_TYPE, provider: providerName, latencyMs: Date.now() - startedAt, success: true });
  return NextResponse.json({ ok: true, data: result });
}
