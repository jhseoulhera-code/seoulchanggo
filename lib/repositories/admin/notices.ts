import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NoticeRow } from "@/types/database";
import type { AdminNotice } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/notices] ${context} failed:`, error.message);
  throw new Error("공지사항 데이터를 처리하지 못했습니다.");
}

function mapNotice(row: NoticeRow): AdminNotice {
  return {
    id: row.id,
    titleKo: row.title_ko,
    titleEn: row.title_en,
    contentKo: row.content_ko,
    contentEn: row.content_en,
    isPinned: row.is_pinned,
    isActive: row.is_active,
    publishedAt: row.published_at,
  };
}

export async function listAdminNotices(): Promise<AdminNotice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("notices").select("*").order("published_at", { ascending: false });
  if (error) fail("listAdminNotices", error);
  return ((data ?? []) as unknown as NoticeRow[]).map(mapNotice);
}

export type AdminNoticeInput = {
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  isPinned: boolean;
  isActive: boolean;
  publishedAt: string;
};

export async function createAdminNotice(input: AdminNoticeInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("notices").insert({
    title_ko: input.titleKo,
    title_en: input.titleEn,
    content_ko: input.contentKo,
    content_en: input.contentEn,
    is_pinned: input.isPinned,
    is_active: input.isActive,
    published_at: input.publishedAt,
  } as never);
  if (error) fail("createAdminNotice", error);
}

export async function updateAdminNotice(id: string, input: AdminNoticeInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notices")
    .update({
      title_ko: input.titleKo,
      title_en: input.titleEn,
      content_ko: input.contentKo,
      content_en: input.contentEn,
      is_pinned: input.isPinned,
      is_active: input.isActive,
      published_at: input.publishedAt,
    } as never)
    .eq("id", id);
  if (error) fail("updateAdminNotice", error);
}
