import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceClient";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * STEP 14 production hardening (spec section 11) — the trusted entry point
 * for cancelling stale unpaid orders (auto_cancel_stale_orders() RPC,
 * supabase/migrations/20260901000100). Meant to be hit on a schedule by
 * Vercel Cron (see vercel.json) rather than a real user's browser, so it is
 * gated by a shared secret rather than a signed-in session — there is no
 * admin session in a scheduled-job context. Set CRON_SECRET in the
 * deployment's environment variables to enable this route; until then it
 * refuses every request, closed by default rather than open.
 *
 * Whether this is actually wired up to fire on a schedule is a separate
 * deployment decision — see the STEP 14 completion report for what's
 * configured vs. still a Production TODO in this environment.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase가 연결되어 있지 않습니다." }, { status: 503 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("auto_cancel_stale_orders" as never);
    if (error) {
      console.error("[internal/cancel-stale-orders] auto_cancel_stale_orders failed:", error.message);
      return NextResponse.json({ ok: false, error: "cancellation failed" }, { status: 500 });
    }

    const cancelledIds = ((data ?? []) as unknown as { cancelled_order_id: string }[]).map((row) => row.cancelled_order_id);
    return NextResponse.json({ ok: true, cancelledCount: cancelledIds.length, cancelledOrderIds: cancelledIds });
  } catch (error) {
    console.error("[internal/cancel-stale-orders] unexpected error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}
