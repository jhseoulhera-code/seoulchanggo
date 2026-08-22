import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * STEP 15.5 finding: app/product/[id]/page.tsx's generateStaticParams (and
 * app/sitemap.ts) run at build time, with no incoming request — calling
 * next/headers' cookies() there throws ("used cookies() inside
 * generateStaticParams"). This never surfaced before because no build had
 * ever run against a real Supabase project (isSupabaseConfigured() was
 * always false, so these functions took the static-data fallback branch
 * instead) — it only showed up once STEP 15.5 actually built against a
 * real Cloud project.
 *
 * For public, non-session-dependent reads only (the product/category
 * catalog — same RLS-visible rows to every visitor, signed in or not).
 * Never use this where the caller's own session should affect the result.
 */
export function createStaticClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase static client requested without NEXT_PUBLIC_SUPABASE_URL/ANON_KEY configured.");
  }
  return createSupabaseClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
