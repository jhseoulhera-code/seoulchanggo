import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import type { GenerateSeoInput } from "@/lib/ai/productAssistant/types";

/** Covers spec features 7-8 (검색 태그 추천 / SEO title·description 생성). */
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: GenerateSeoInput;
  try {
    body = (await request.json()) as GenerateSeoInput;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.nameKo?.trim()) {
    return NextResponse.json({ ok: false, error: "상품명이 필요합니다." }, { status: 400 });
  }

  const result = await resolveAiProductAssistant().generateSeo(body);
  return NextResponse.json({ ok: true, data: result });
}
