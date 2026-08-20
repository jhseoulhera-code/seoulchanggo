"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { escapeIlikePattern, normalizeSearchQuery } from "@/lib/search/normalize";
import { allProducts as staticAllProducts } from "@/data/products";
import { categories as staticCategories } from "@/data/categories";
import { staticSearchKeywords } from "@/data/searchKeywords";

export type SearchSuggestion =
  | { kind: "product"; id: string; label: string; imageUrl: string; href: string }
  | { kind: "category"; id: string; label: string; href: string }
  | { kind: "keyword"; id: string; label: string; href: string };

const PRODUCT_LIMIT = 5;
const CATEGORY_LIMIT = 3;
const KEYWORD_LIMIT = 3;

type SuggestionProductRow = {
  slug: string;
  name_ko: string;
  product_images: { image_url: string; is_primary: boolean; sort_order: number }[];
};
type SuggestionCategoryRow = { slug: string; name_ko: string };
type SuggestionKeywordRow = { id: string; keyword: string };

/**
 * Debounced autocomplete source for the Header search box (STEP 12 spec
 * sections 6-7) — matches products/categories/admin-curated keywords by
 * partial ko/en/brand name. Reuses the same normalize/escape utilities as
 * the real search-results query so autocomplete and the results page never
 * disagree about what counts as a match.
 */
export async function getSearchSuggestionsAction(rawQuery: string): Promise<SearchSuggestion[]> {
  const query = normalizeSearchQuery(rawQuery);
  if (!query) return [];

  if (!isSupabaseConfigured()) return staticSuggestions(query);

  const supabase = await createClient();
  const pattern = `%${escapeIlikePattern(query)}%`;

  const [productResult, categoryResult, keywordResult] = await Promise.all([
    supabase
      .from("products")
      .select("slug, name_ko, product_images(image_url, is_primary, sort_order)")
      .eq("is_active", true)
      .or(`name_ko.ilike.${pattern},name_en.ilike.${pattern},brand.ilike.${pattern}`)
      .limit(PRODUCT_LIMIT),
    supabase.from("categories").select("slug, name_ko").eq("is_visible", true).ilike("name_ko", pattern).limit(CATEGORY_LIMIT),
    supabase.from("search_keywords").select("id, keyword").eq("is_active", true).ilike("keyword", pattern).limit(KEYWORD_LIMIT),
  ]);

  const productRows = (productResult.data ?? []) as unknown as SuggestionProductRow[];
  const categoryRows = (categoryResult.data ?? []) as unknown as SuggestionCategoryRow[];
  const keywordRows = (keywordResult.data ?? []) as unknown as SuggestionKeywordRow[];

  const categorySuggestions: SearchSuggestion[] = categoryRows.map((row) => ({
    kind: "category",
    id: row.slug,
    label: row.name_ko,
    href: `/category/${row.slug}`,
  }));

  const productSuggestions: SearchSuggestion[] = productRows.map((row) => {
    const sorted = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order);
    const primary = sorted.find((image) => image.is_primary) ?? sorted[0];
    return { kind: "product", id: row.slug, label: row.name_ko, imageUrl: primary?.image_url ?? "", href: `/product/${row.slug}` };
  });

  const keywordSuggestions: SearchSuggestion[] = keywordRows.map((row) => ({
    kind: "keyword",
    id: row.id,
    label: row.keyword,
    href: `/search?q=${encodeURIComponent(row.keyword)}`,
  }));

  return [...categorySuggestions, ...productSuggestions, ...keywordSuggestions];
}

function staticSuggestions(query: string): SearchSuggestion[] {
  const products: SearchSuggestion[] = staticAllProducts
    .filter((product) => product.name.toLowerCase().includes(query) || (product.brand ?? "").toLowerCase().includes(query))
    .slice(0, PRODUCT_LIMIT)
    .map((product) => ({ kind: "product", id: product.id, label: product.name, imageUrl: product.image, href: `/product/${product.id}` }));

  const categoriesMatched: SearchSuggestion[] = staticCategories
    .filter((category) => category.label.toLowerCase().includes(query))
    .slice(0, CATEGORY_LIMIT)
    .map((category) => ({ kind: "category", id: category.id, label: category.label, href: `/category/${category.id}` }));

  const keywords: SearchSuggestion[] = staticSearchKeywords
    .filter((keyword) => keyword.keyword.toLowerCase().includes(query))
    .slice(0, KEYWORD_LIMIT)
    .map((keyword) => ({ kind: "keyword", id: keyword.id, label: keyword.keyword, href: `/search?q=${encodeURIComponent(keyword.keyword)}` }));

  return [...categoriesMatched, ...products, ...keywords];
}
