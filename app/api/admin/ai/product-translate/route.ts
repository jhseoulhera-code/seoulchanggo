import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { logAiCall } from "@/app/api/admin/ai/_telemetry";
import { AI_RATE_LIMIT_MAX_CALLS, AI_RATE_LIMIT_WINDOW_MS, MAX_LONG_FIELD_LENGTH } from "@/lib/ai/productAssistant/config";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import { sanitizeText } from "@/lib/ai/productAssistant/sanitize";
import { checkRateLimit } from "@/lib/ai/rateLimit";
import type { ProductTranslateInput } from "@/lib/ai/productAssistant/types";

const FUNCTION_TYPE = "product-translate";

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard.denied) return guard.denied;

  const rate = checkRateLimit(`${FUNCTION_TYPE}:${guard.profile.id}`, AI_RATE_LIMIT_MAX_CALLS, AI_RATE_LIMIT_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: ProductTranslateInput;
  try {
    body = (await request.json()) as ProductTranslateInput;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.text?.trim() || (body.direction !== "ko-to-en" && body.direction !== "en-to-ko")) {
    return NextResponse.json({ ok: false, error: "번역할 텍스트와 방향이 필요합니다." }, { status: 400 });
  }

  const input: ProductTranslateInput = { text: sanitizeText(body.text, MAX_LONG_FIELD_LENGTH), direction: body.direction };

  const resolved = resolveAiProductAssistant();
  if (!resolved.adapter) {
    return NextResponse.json({ ok: false, error: `AI provider가 설정되지 않았습니다. (${resolved.forcedFallbackReason})` }, { status: 503 });
  }

  const startedAt = Date.now();
  let success = true;
  try {
    const result = await resolved.adapter.translateProductContent(input);
    return NextResponse.json({ ok: true, data: result });
  } catch {
    success = false;
    return NextResponse.json({ ok: false, error: "AI 도우미 처리 중 오류가 발생했습니다." }, { status: 200 });
  } finally {
    logAiCall({ adminId: guard.profile.id, functionType: FUNCTION_TYPE, provider: resolved.adapter.name, latencyMs: Date.now() - startedAt, success });
  }
}
