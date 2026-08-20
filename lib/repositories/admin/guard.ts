import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ProfileRow } from "@/types/database";

/**
 * Every /admin route resolves one of these server-side before rendering
 * anything — see app/admin/layout.tsx. "not_configured" and "forbidden" are
 * deliberately distinct from each other and from a real 403: this app has no
 * live Supabase project to check a role against yet, so it must say so
 * plainly rather than pretend admin access was denied for a normal reason.
 */
export type AdminGuardResult =
  | { status: "not_configured" }
  | { status: "unauthenticated" }
  | { status: "forbidden"; profile: ProfileRow }
  | { status: "ok"; profile: ProfileRow };

export async function checkAdminAccess(): Promise<AdminGuardResult> {
  if (!isSupabaseConfigured()) {
    return { status: "not_configured" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" };
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error || !data) {
    return { status: "unauthenticated" };
  }

  const profile = data as unknown as ProfileRow;
  if (profile.role === "ADMIN" || profile.role === "SUPER_ADMIN") {
    return { status: "ok", profile };
  }
  return { status: "forbidden", profile };
}
