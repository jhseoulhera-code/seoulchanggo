import { NextResponse } from "next/server";
import { requireAdminApi } from "@/app/api/admin/ai/_guard";
import { resolveAiProductAssistant } from "@/lib/ai/productAssistant/registry";
import type { ProductTranslateInput } from "@/lib/ai/productAssistant/types";

export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: ProductTranslateInput;
  try {
    body = (await request.json()) as ProductTranslateInput;
  } catch {
    return NextResponse.json({ ok: false, error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.text?.trim() || (body.direction !== "ko-to-en" && body.direction !== "en-to-ko")) {
    return NextResponse.json({ ok: false, error: "번역할 텍스트와 방향이 필요합니다." }, { status: 400 });
  }

  const result = await resolveAiProductAssistant().translateProductContent(body);
  return NextResponse.json({ ok: true, data: result });
}
