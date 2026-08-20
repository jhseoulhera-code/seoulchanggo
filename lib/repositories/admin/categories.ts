import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/types/database";
import type { AdminCategory } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/categories] ${context} failed:`, error.message);
  throw new Error("카테고리 데이터를 처리하지 못했습니다.");
}

function mapCategory(row: CategoryRow): AdminCategory {
  return {
    id: row.id,
    slug: row.slug,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    iconName: row.icon_name,
    parentId: row.parent_id,
    level: row.level,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    showOnHome: row.show_on_home,
  };
}

/** All categories, visible or not — the admin list needs to manage visibility itself. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order", { ascending: true });
  if (error) fail("listAdminCategories", error);
  return ((data ?? []) as unknown as CategoryRow[]).map(mapCategory);
}

export async function createAdminCategory(input: {
  slug: string;
  nameKo: string;
  nameEn: string;
  iconName: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isVisible: boolean;
  showOnHome: boolean;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    slug: input.slug,
    name_ko: input.nameKo,
    name_en: input.nameEn,
    icon_name: input.iconName,
    parent_id: input.parentId,
    level: input.level,
    sort_order: input.sortOrder,
    is_visible: input.isVisible,
    show_on_home: input.showOnHome,
  } as never);
  if (error) fail("createAdminCategory", error);
}

export async function updateAdminCategory(
  id: string,
  patch: Partial<{
    nameKo: string;
    nameEn: string;
    iconName: string | null;
    parentId: string | null;
    sortOrder: number;
    isVisible: boolean;
    showOnHome: boolean;
  }>
): Promise<void> {
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.nameKo !== undefined) update.name_ko = patch.nameKo;
  if (patch.nameEn !== undefined) update.name_en = patch.nameEn;
  if (patch.iconName !== undefined) update.icon_name = patch.iconName;
  if (patch.parentId !== undefined) update.parent_id = patch.parentId;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  if (patch.isVisible !== undefined) update.is_visible = patch.isVisible;
  if (patch.showOnHome !== undefined) update.show_on_home = patch.showOnHome;

  const { error } = await supabase.from("categories").update(update as never).eq("id", id);
  if (error) fail("updateAdminCategory", error);
}
