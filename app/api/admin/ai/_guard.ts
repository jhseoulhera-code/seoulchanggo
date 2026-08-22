import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";

/**
 * Shared entry guard for every /api/admin/ai/* route (STEP 16 spec section
 * 4: "반드시 admin 권한 확인"). Mirrors the requireAdmin() pattern already
 * used by lib/actions/adminProducts.ts's Server Actions, just returning an
 * HTTP response instead of an ActionResult since these are Route Handlers.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  const access = await checkAdminAccess();
  if (access.status === "ok") return null;
  const status = access.status === "unauthenticated" || access.status === "not_configured" ? 401 : 403;
  return NextResponse.json({ ok: false, error: "관리자 권한이 필요합니다." }, { status });
}
