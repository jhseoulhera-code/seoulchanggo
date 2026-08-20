import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Bypasses RLS entirely — never import this from a "use client" file, never
 * forward its key to the browser, and only use it where the app itself must
 * act with elevated privilege (e.g. the guest-order Server Action). Prefer
 * lib/supabase/server.ts (RLS-scoped to the caller) for anything else.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role client requested without SUPABASE_SERVICE_ROLE_KEY configured.");
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
