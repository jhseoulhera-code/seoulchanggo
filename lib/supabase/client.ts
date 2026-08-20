"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Only call this after checking isSupabaseConfigured() — it throws immediately
 * if the env vars are missing, rather than returning a client that fails on
 * first use with a confusing network error.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase browser client requested without NEXT_PUBLIC_SUPABASE_URL/ANON_KEY configured.");
  }
  return createBrowserClient<Database>(url, anonKey);
}
