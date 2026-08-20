"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeSearchQuery } from "@/lib/search/normalize";
import type { CountryCode, LocaleCode } from "@/types/market";

/**
 * Minimal search analytics ledger (STEP 12 spec sections 18-19) — no IP, no
 * extra free-text beyond the query itself. Returns the new search_events id
 * (or null when unconfigured/failed) so a later click can be attributed to
 * this specific search.
 */
export async function logSearchEventAction(
  query: string,
  marketCode: CountryCode,
  locale: LocaleCode,
  resultCount: number
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("search_events")
    .insert({
      user_id: user?.id ?? null,
      query,
      normalized_query: normalized,
      market_code: marketCode,
      locale,
      result_count: resultCount,
    } as never)
    .select("id")
    .single();

  if (error) {
    console.error("[search] logSearchEventAction failed:", error.message);
    return null;
  }
  return (data as unknown as { id: string }).id;
}

/** productSlug matches the client-facing Product.id (a slug), resolved to the real product UUID here. */
export async function logSearchClickAction(searchEventId: string, productSlug: string, position: number): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  const { data: product } = await supabase.from("products").select("id").eq("slug", productSlug).maybeSingle();
  if (!product) return;

  const { error } = await supabase.from("search_click_events").insert({
    search_event_id: searchEventId,
    product_id: (product as unknown as { id: string }).id,
    position,
  } as never);
  if (error) console.error("[search] logSearchClickAction failed:", error.message);
}
