import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { FaqRow } from "@/types/database";

export type Faq = {
  id: string;
  category: string;
  questionKo: string;
  questionEn: string;
  answerKo: string;
  answerEn: string;
};

/** [] when Supabase isn't configured — a brand-new STEP 10 feature has no mock fallback to preserve. */
export async function getFaqs(): Promise<Faq[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[faqs] getFaqs failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as FaqRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    questionKo: row.question_ko,
    questionEn: row.question_en,
    answerKo: row.answer_ko,
    answerEn: row.answer_en,
  }));
}
