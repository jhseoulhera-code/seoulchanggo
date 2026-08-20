"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ProductInquiryRow } from "@/types/database";

export type ProductInquiry = {
  id: string;
  authorName: string;
  question: string;
  status: "PENDING" | "ANSWERED" | "HIDDEN";
  answer: string | null;
  createdAt: string;
};

function maskAuthorName(name: string): string {
  if (name.length <= 2) return `${name.slice(0, 1)}**`;
  return `${name.slice(0, 2)}**`;
}

export async function getProductInquiriesAction(productDbId: string): Promise<ProductInquiry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_inquiries")
    .select("*")
    .eq("product_id", productDbId)
    .neq("status", "HIDDEN")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[inquiries] getProductInquiriesAction failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as ProductInquiryRow[]).map((row) => ({
    id: row.id,
    authorName: maskAuthorName(row.author_name),
    question: row.question,
    status: row.status,
    answer: row.answer,
    createdAt: row.created_at,
  }));
}

export type SubmitInquiryResult = { ok: true } | { ok: false; error: string };

export async function submitInquiryAction(productDbId: string, question: string): Promise<SubmitInquiryResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "상품문의는 Supabase 연결 후 이용할 수 있습니다." };
  if (!question.trim()) return { ok: false, error: "문의 내용을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 후 작성할 수 있습니다." };

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const authorName = (profile as unknown as { display_name: string } | null)?.display_name ?? "회원";

  const { error } = await supabase.from("product_inquiries").insert({
    product_id: productDbId,
    user_id: user.id,
    author_name: authorName,
    question: question.trim(),
  } as never);

  if (error) {
    console.error("[inquiries] submitInquiryAction failed:", error.message);
    return { ok: false, error: "문의를 등록하지 못했습니다." };
  }

  revalidatePath("/product/[id]", "page");
  return { ok: true };
}
