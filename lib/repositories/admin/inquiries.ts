import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProductInquiryRow } from "@/types/database";
import type { AdminInquiry } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/inquiries] ${context} failed:`, error.message);
  throw new Error("상품문의 데이터를 처리하지 못했습니다.");
}

export type AdminInquiryFilters = {
  status?: "PENDING" | "ANSWERED" | "HIDDEN";
  productId?: string;
  q?: string;
};

type InquiryJoinRow = ProductInquiryRow & { products: { name_ko: string } | null };

export async function listAdminInquiries(filters: AdminInquiryFilters = {}): Promise<AdminInquiry[]> {
  const supabase = await createClient();
  let query = supabase.from("product_inquiries").select("*, products(name_ko)").order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.q) query = query.ilike("question", `%${filters.q}%`);

  const { data, error } = await query.limit(200);
  if (error) fail("listAdminInquiries", error);

  return ((data ?? []) as unknown as InquiryJoinRow[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    productNameKo: row.products?.name_ko ?? "-",
    authorName: row.author_name,
    question: row.question,
    status: row.status,
    answer: row.answer,
    answeredAt: row.answered_at,
    createdAt: row.created_at,
  }));
}

export type AnswerInquiryResult = { ok: true } | { ok: false; error: string };

export async function answerAdminInquiry(id: string, answer: string, adminId: string): Promise<AnswerInquiryResult> {
  if (!answer.trim()) return { ok: false, error: "답변 내용을 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("product_inquiries")
    .update({
      answer: answer.trim(),
      answered_by: adminId,
      answered_at: new Date().toISOString(),
      status: "ANSWERED",
    } as never)
    .eq("id", id);

  if (error) {
    console.error("[admin/inquiries] answerAdminInquiry failed:", error.message);
    return { ok: false, error: "답변을 저장하지 못했습니다." };
  }
  return { ok: true };
}
