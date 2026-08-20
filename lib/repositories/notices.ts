import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { NoticeRow } from "@/types/database";

export type Notice = {
  id: string;
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  isPinned: boolean;
  publishedAt: string;
};

function mapNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    titleKo: row.title_ko,
    titleEn: row.title_en,
    contentKo: row.content_ko,
    contentEn: row.content_en,
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
  };
}

/** [] (not fake sample notices) when Supabase isn't configured — a brand-new STEP 10 feature has nothing to fall back to. */
export async function getNotices(): Promise<Notice[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select("*")
    .eq("is_active", true)
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[notices] getNotices failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as NoticeRow[]).map(mapNotice);
}

export async function getNoticeById(id: string): Promise<Notice | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("notices").select("*").eq("id", id).eq("is_active", true).maybeSingle();
  if (error) {
    console.error("[notices] getNoticeById failed:", error.message);
    return null;
  }
  return data ? mapNotice(data as unknown as NoticeRow) : null;
}
