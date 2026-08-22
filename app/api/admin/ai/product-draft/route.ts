import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import type { CategoryOption, ProductDraftInput } from "@/lib/ai/productAssistant/types";

type RequestBody = ProductDraftInput & { availableCategories?: CategoryOption[] };

/**
 * Covers spec features 1-6 (상품명 다듬기/영문명/짧은설명/상세설명/bullet/카테고리
 * 추천) in one call — category suggestion only runs when the caller passes
 * `availableCategories` (Step 1 already has the category list loaded, so
 * this avoids a second round trip for what's functionally one "draft this
 * product for me" action).
 */
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.nameKo?.trim()) {
    return NextResponse.json({ ok: false, error: "상품명이 필요합니다." }, { status: 400 });
  }

  const assistant = resolveAiProductAssistant();
  const draft = await assistant.generateProductDraft(body);
  const category =
    body.availableCategories && body.availableCategories.length > 0
      ? await assistant.suggestCategory({ ...body, availableCategories: body.availableCategories })
      : null;

  return NextResponse.json({ ok: true, data: { draft, category } });
}
