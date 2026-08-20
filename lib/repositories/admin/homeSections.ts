import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { HomeSectionItemRow, HomeSectionRow } from "@/types/database";
import type { AdminHomeSection } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/homeSections] ${context} failed:`, error.message);
  throw new Error("HOME 큐레이션 데이터를 처리하지 못했습니다.");
}

type SectionRow = HomeSectionRow & {
  home_section_items: (HomeSectionItemRow & { products: { name_ko: string } | null })[];
};

export async function listAdminHomeSections(): Promise<AdminHomeSection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("home_sections")
    .select("*, home_section_items(*, products(name_ko))")
    .order("sort_order", { ascending: true });
  if (error) fail("listAdminHomeSections", error);

  return ((data ?? []) as unknown as SectionRow[]).map((row) => ({
    id: row.id,
    sectionKey: row.section_key,
    titleKo: row.title_ko,
    titleEn: row.title_en,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    items: [...row.home_section_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        itemId: item.id,
        productId: item.product_id,
        productNameKo: item.products?.name_ko ?? "-",
        sortOrder: item.sort_order,
      })),
  }));
}

export async function addProductToHomeSection(sectionId: string, productId: string, sortOrder: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("home_section_items")
    .insert({ section_id: sectionId, product_id: productId, sort_order: sortOrder } as never);
  if (error) fail("addProductToHomeSection", error);
}

export async function removeHomeSectionItem(itemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("home_section_items").delete().eq("id", itemId);
  if (error) fail("removeHomeSectionItem", error);
}

export async function reorderHomeSectionItem(itemId: string, sortOrder: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("home_section_items").update({ sort_order: sortOrder } as never).eq("id", itemId);
  if (error) fail("reorderHomeSectionItem", error);
}

export async function setHomeSectionActive(sectionId: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("home_sections").update({ is_active: isActive } as never).eq("id", sectionId);
  if (error) fail("setHomeSectionActive", error);
}
