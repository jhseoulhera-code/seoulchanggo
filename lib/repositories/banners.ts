import { heroSlides } from "@/data/heroSlides";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { BannerRow } from "@/types/database";
import type { HeroSlide } from "@/types";

/**
 * HOME hero banners. Returns the full active/in-date set — market/locale is a
 * client-only concept in this app (see contexts/MarketContext.tsx, which has
 * no server snapshot), so filtering by the current Market happens in
 * MainBannerSlider, the same way product market-pricing/availability already
 * does. Falls back to the static heroSlides mock when Supabase isn't
 * configured, the query fails, or no active banner rows exist yet — HOME
 * must never end up with an empty hero because of a banner-fetch issue
 * (STEP 10 spec section 13).
 */
export async function getHomeBanners(): Promise<HeroSlide[]> {
  if (!isSupabaseConfigured()) return heroSlides;

  const supabase = await createClient();
  const { data, error } = await supabase.from("banners").select("*").eq("is_active", true).order("sort_order", { ascending: true });

  if (error) {
    console.error("[banners] getHomeBanners failed:", error.message);
    return heroSlides;
  }

  const now = Date.now();
  const rows = ((data ?? []) as unknown as BannerRow[]).filter((row) => {
    const startsOk = !row.starts_at || new Date(row.starts_at).getTime() <= now;
    const endsOk = !row.ends_at || new Date(row.ends_at).getTime() >= now;
    return startsOk && endsOk;
  });

  if (rows.length === 0) return heroSlides;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? "",
    background: "#f3f1ec",
    imageUrl: row.image_url,
    mobileImageUrl: row.mobile_image_url ?? undefined,
    linkUrl: row.link_url ?? undefined,
    marketCode: row.market_code,
    locale: row.locale,
  }));
}
