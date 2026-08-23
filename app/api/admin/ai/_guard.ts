import { NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import type { ProfileRow } from "@/types/database";

/**
 * Shared entry guard for every /api/admin/ai/* route (STEP 16 spec section
 * 4: "반드시 admin 권한 확인"; STEP 17 section 10: "customer AI route 접근
 * 차단"). Mirrors the requireAdmin() pattern already used by
 * lib/actions/adminProducts.ts's Server Actions, just returning an HTTP
 * response instead of an ActionResult since these are Route Handlers.
 * Also returns the caller's own profile on success — STEP 17's rate limit
 * (keyed per admin) and logging (admin user id, never full prompt text)
 * both need it.
 */
export async function requireAdminApi(): Promise<{ denied: NextResponse; profile: null } | { denied: null; profile: ProfileRow }> {
  const access = await checkAdminAccess();
  if (access.status === "ok") return { denied: null, profile: access.profile };

  const status = access.status === "unauthenticated" || access.status === "not_configured" ? 401 : 403;
  return { denied: NextResponse.json({ ok: false, error: "관리자 권한이 필요합니다." }, { status }), profile: null };
}
