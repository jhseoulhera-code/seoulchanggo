import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BannerRow } from "@/types/database";
import type { AdminBanner } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/banners] ${context} failed:`, error.message);
  throw new Error("배너 데이터를 처리하지 못했습니다.");
}

function mapBanner(row: BannerRow): AdminBanner {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    mobileImageUrl: row.mobile_image_url,
    linkUrl: row.link_url,
    marketCode: row.market_code,
    locale: row.locale,
    sortOrder: row.sort_order,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
  };
}

export async function listAdminBanners(): Promise<AdminBanner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("banners").select("*").order("sort_order", { ascending: true });
  if (error) fail("listAdminBanners", error);
  return ((data ?? []) as unknown as BannerRow[]).map(mapBanner);
}

export type AdminBannerInput = {
  title: string;
  subtitle: string;
  imageUrl: string;
  mobileImageUrl: string;
  linkUrl: string;
  marketCode: "KR" | "IN" | null;
  locale: "ko" | "en" | null;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export async function createAdminBanner(input: AdminBannerInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("banners").insert({
    title: input.title,
    subtitle: input.subtitle || null,
    image_url: input.imageUrl,
    mobile_image_url: input.mobileImageUrl || null,
    link_url: input.linkUrl || null,
    market_code: input.marketCode,
    locale: input.locale,
    sort_order: input.sortOrder,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    is_active: input.isActive,
  } as never);
  if (error) fail("createAdminBanner", error);
}

export async function updateAdminBanner(id: string, input: AdminBannerInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("banners")
    .update({
      title: input.title,
      subtitle: input.subtitle || null,
      image_url: input.imageUrl,
      mobile_image_url: input.mobileImageUrl || null,
      link_url: input.linkUrl || null,
      market_code: input.marketCode,
      locale: input.locale,
      sort_order: input.sortOrder,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      is_active: input.isActive,
    } as never)
    .eq("id", id);
  if (error) fail("updateAdminBanner", error);
}

export async function setAdminBannerActive(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("banners").update({ is_active: isActive } as never).eq("id", id);
  if (error) fail("setAdminBannerActive", error);
}
