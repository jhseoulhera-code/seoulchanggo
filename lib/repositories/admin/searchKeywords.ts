import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SearchKeywordRow } from "@/types/database";
import type { AdminSearchKeyword } from "@/types/admin";
import type { CountryCode, LocaleCode } from "@/types/market";
import type { SearchKeywordTypeEnum } from "@/types/database";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/searchKeywords] ${context} failed:`, error.message);
  throw new Error("검색어 데이터를 처리하지 못했습니다.");
}

function mapSearchKeyword(row: SearchKeywordRow): AdminSearchKeyword {
  return {
    id: row.id,
    keyword: row.keyword,
    type: row.type,
    marketCode: row.market_code,
    locale: row.locale,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function listAdminSearchKeywords(): Promise<AdminSearchKeyword[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("search_keywords")
    .select("*")
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) fail("listAdminSearchKeywords", error);
  return ((data ?? []) as unknown as SearchKeywordRow[]).map(mapSearchKeyword);
}

export type AdminSearchKeywordInput = {
  keyword: string;
  type: SearchKeywordTypeEnum;
  marketCode: CountryCode | null;
  locale: LocaleCode | null;
  sortOrder: number;
  isActive: boolean;
};

export async function createAdminSearchKeyword(input: AdminSearchKeywordInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("search_keywords").insert({
    keyword: input.keyword,
    type: input.type,
    market_code: input.marketCode,
    locale: input.locale,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  } as never);
  if (error) fail("createAdminSearchKeyword", error);
}

export async function updateAdminSearchKeyword(id: string, input: AdminSearchKeywordInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("search_keywords")
    .update({
      keyword: input.keyword,
      type: input.type,
      market_code: input.marketCode,
      locale: input.locale,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    } as never)
    .eq("id", id);
  if (error) fail("updateAdminSearchKeyword", error);
}
