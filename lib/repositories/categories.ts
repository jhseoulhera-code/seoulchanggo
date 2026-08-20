import {
  Baby,
  Car,
  Dumbbell,
  House,
  MonitorSmartphone,
  PawPrint,
  PenLine,
  Puzzle,
  ShoppingBag,
  Sofa,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { categories as staticCategories } from "@/data/categories";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { CategoryRow } from "@/types/database";
import type { Category } from "@/types";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  ShoppingBag,
  Baby,
  Utensils,
  House,
  Sofa,
  MonitorSmartphone,
  Car,
  Puzzle,
  PenLine,
  PawPrint,
  Dumbbell,
};

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.slug,
    label: row.name_ko,
    labelEn: row.name_en || undefined,
    icon: ICON_BY_NAME[row.icon_name ?? ""] ?? ShoppingBag,
  };
}

/** Full category list (whatever is is_visible), ordered for HOME/category pages. */
export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) return staticCategories;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[categories] getCategories query failed:", error.message);
    throw new Error("카테고리를 불러오지 못했습니다.");
  }

  return (data ?? []).map(mapCategoryRow);
}

/**
 * The HOME quick-icon subset (show_on_home = true) — e.g. 스포츠/레저 exists in the
 * full catalog but is deliberately excluded from these 10 icons per the STEP 08 spec.
 * The static fallback has no such flag (it only ever held the HOME set), so it's
 * used as-is when Supabase isn't configured.
 */
export async function getHomeCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured()) return staticCategories;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_visible", true)
    .eq("show_on_home", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[categories] getHomeCategories query failed:", error.message);
    throw new Error("카테고리를 불러오지 못했습니다.");
  }

  return (data ?? []).map(mapCategoryRow);
}
