import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ProfileLookup = { displayName: string; email: string };

/**
 * orders.user_id and reviews.user_id reference auth.users(id) — profiles.id
 * ALSO references auth.users(id), but there is no foreign key directly
 * between orders/reviews and profiles. PostgREST's embedded-resource syntax
 * (`.select("*, profiles(...)")`) can only resolve a relationship it finds
 * as a real FK between the two specific tables being queried, so on a real
 * Supabase project this fails with "Could not find a relationship between
 * 'orders' and 'profiles' in the schema cache" (no FK at all) or "more than
 * one relationship was found for 'reviews' and 'profiles'" (an ambiguous
 * one). Resolving display_name/email via a SEPARATE query keyed on the same
 * ids sidesteps both failure modes entirely — no FK required, no embedding
 * ambiguity possible — without touching RLS or any other security logic.
 * The caller must be an admin session: profiles' RLS grants admins
 * `profiles_admin_read_all`, so this correctly resolves every matched id
 * regardless of who owns which order/review.
 */
export async function fetchProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: (string | null)[]
): Promise<Map<string, ProfileLookup>> {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => id !== null))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase.from("profiles").select("id, display_name, email").in("id", uniqueIds);
  if (error) {
    console.error("[admin/profiles] fetchProfilesByIds failed:", error.message);
    return new Map();
  }

  const map = new Map<string, ProfileLookup>();
  for (const row of (data ?? []) as { id: string; display_name: string; email: string }[]) {
    map.set(row.id, { displayName: row.display_name, email: row.email });
  }
  return map;
}
