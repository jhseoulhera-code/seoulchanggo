import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FaqRow } from "@/types/database";
import type { AdminFaq } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/faqs] ${context} failed:`, error.message);
  throw new Error("FAQ 데이터를 처리하지 못했습니다.");
}

function mapFaq(row: FaqRow): AdminFaq {
  return {
    id: row.id,
    category: row.category,
    questionKo: row.question_ko,
    questionEn: row.question_en,
    answerKo: row.answer_ko,
    answerEn: row.answer_en,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

export async function listAdminFaqs(): Promise<AdminFaq[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("faqs").select("*").order("category", { ascending: true }).order("sort_order", { ascending: true });
  if (error) fail("listAdminFaqs", error);
  return ((data ?? []) as unknown as FaqRow[]).map(mapFaq);
}

export type AdminFaqInput = {
  category: string;
  questionKo: string;
  questionEn: string;
  answerKo: string;
  answerEn: string;
  sortOrder: number;
  isActive: boolean;
};

export async function createAdminFaq(input: AdminFaqInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("faqs").insert({
    category: input.category,
    question_ko: input.questionKo,
    question_en: input.questionEn,
    answer_ko: input.answerKo,
    answer_en: input.answerEn,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  } as never);
  if (error) fail("createAdminFaq", error);
}

export async function updateAdminFaq(id: string, input: AdminFaqInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("faqs")
    .update({
      category: input.category,
      question_ko: input.questionKo,
      question_en: input.questionEn,
      answer_ko: input.answerKo,
      answer_en: input.answerEn,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    } as never)
    .eq("id", id);
  if (error) fail("updateAdminFaq", error);
}
