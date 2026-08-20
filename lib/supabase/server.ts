import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * For Server Components/Actions/Route Handlers. Runs with the caller's own
 * session (via cookies), so it is still subject to RLS — this is NOT the
 * service-role client. Only call after checking isSupabaseConfigured().
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase server client requested without NEXT_PUBLIC_SUPABASE_URL/ANON_KEY configured.");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render (not an Action/Route Handler) — cookies
          // can't be written there. The middleware below refreshes the session instead.
        }
      },
    },
  });
}
