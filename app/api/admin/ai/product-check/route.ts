import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import type { MissingFieldCheckInput } from "@/lib/ai/productAssistant/types";

/** Covers spec feature 10 (입력 누락 항목 점검) — pure rule-based, no free-text generation involved. */
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: MissingFieldCheckInput;
  try {
    body = (await request.json()) as MissingFieldCheckInput;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await resolveAiProductAssistant().checkMissingFields(body);
  return NextResponse.json({ ok: true, data: result });
}
