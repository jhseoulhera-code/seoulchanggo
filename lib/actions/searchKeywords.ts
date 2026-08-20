"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { staticSearchKeywords } from "@/data/searchKeywords";
import type { SearchKeywordTypeEnum } from "@/types/database";

export type SearchKeywordSuggestion = { id: string; keyword: string };

/**
 * POPULAR/RECOMMENDED keyword chips shown on search-box focus (STEP 12 spec
 * section 9) — sourced from the admin-curated search_keywords table, never
 * computed from live query volume, so there is nothing here to fake.
 */
export async function getSearchKeywordsAction(type: SearchKeywordTypeEnum, limit = 8): Promise<SearchKeywordSuggestion[]> {
  if (!isSupabaseConfigured()) {
    return staticSearchKeywords
      .filter((keyword) => keyword.type === type)
      .slice(0, limit)
      .map(({ id, keyword }) => ({ id, keyword }));
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("search_keywords")
    .select("id, keyword")
    .eq("type", type)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[search] getSearchKeywordsAction failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as SearchKeywordSuggestion[];
}
