import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { logAiCall } from "@/app/api/admin/ai/_telemetry";
import { AI_RATE_LIMIT_MAX_CALLS, AI_RATE_LIMIT_WINDOW_MS, MAX_CATEGORY_OPTIONS } from "@/lib/ai/productAssistant/config";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import { sanitizeSupplierText, sanitizeText } from "@/lib/ai/productAssistant/sanitize";
import { checkRateLimit } from "@/lib/ai/rateLimit";
import type { CategoryOption, ProductDraftInput } from "@/lib/ai/productAssistant/types";

type RequestBody = ProductDraftInput & { availableCategories?: CategoryOption[] };

const FUNCTION_TYPE = "product-draft";

/**
 * Covers spec features 1-6 (상품명 다듬기/영문명/짧은설명/상세설명/bullet/카테고리
 * 추천) in one call — category suggestion only runs when the caller passes
 * `availableCategories` (Step 1 already has the category list loaded, so
 * this avoids a second round trip for what's functionally one "draft this
 * product for me" action).
 */
export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (guard.denied) return guard.denied;

  const rate = checkRateLimit(`${FUNCTION_TYPE}:${guard.profile.id}`, AI_RATE_LIMIT_MAX_CALLS, AI_RATE_LIMIT_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.nameKo?.trim()) {
    return NextResponse.json({ ok: false, error: "상품명이 필요합니다." }, { status: 400 });
  }

  const input: ProductDraftInput = {
    nameKo: sanitizeText(body.nameKo, 200),
    nameEn: body.nameEn ? sanitizeText(body.nameEn, 200) : undefined,
    brand: body.brand ? sanitizeText(body.brand, 100) : undefined,
    categoryNameKo: body.categoryNameKo ? sanitizeText(body.categoryNameKo, 100) : undefined,
    descriptionKo: body.descriptionKo ? sanitizeText(body.descriptionKo, 2000) : undefined,
    supplierDescription: body.supplierDescription ? sanitizeSupplierText(body.supplierDescription) : undefined,
  };
  const availableCategories = (body.availableCategories ?? []).slice(0, MAX_CATEGORY_OPTIONS);

  const resolved = resolveAiProductAssistant();
  if (!resolved.adapter) {
    return NextResponse.json({ ok: false, error: `AI provider가 설정되지 않았습니다. (${resolved.forcedFallbackReason})` }, { status: 503 });
  }

  const startedAt = Date.now();
  let success = true;
  try {
    const draft = await resolved.adapter.generateProductDraft(input);
    const category = availableCategories.length > 0 ? await resolved.adapter.suggestCategory({ ...input, availableCategories }) : null;
    return NextResponse.json({ ok: true, data: { draft, category } });
  } catch {
    success = false;
    return NextResponse.json({ ok: false, error: "AI 도우미 처리 중 오류가 발생했습니다." }, { status: 200 });
  } finally {
    logAiCall({ adminId: guard.profile.id, functionType: FUNCTION_TYPE, provider: resolved.adapter.name, latencyMs: Date.now() - startedAt, success });
  }
}
