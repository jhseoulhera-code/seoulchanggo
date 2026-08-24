import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fetchProfilesByIds } from "@/lib/repositories/admin/profiles";
import type { ReviewRow } from "@/types/database";
import type { AdminReview } from "@/types/admin";

function fail(context: string, error: { message: string }): never {
  console.error(`[admin/reviews] ${context} failed:`, error.message);
  throw new Error("리뷰 데이터를 처리하지 못했습니다.");
}

export type AdminReviewFilters = {
  status?: "PUBLISHED" | "HIDDEN" | "REPORTED";
  rating?: number;
  q?: string;
};

type ReviewJoinRow = ReviewRow & { products: { name_ko: string } | null };

export async function listAdminReviews(filters: AdminReviewFilters = {}): Promise<AdminReview[]> {
  const supabase = await createClient();
  let query = supabase
    .from("reviews")
    // STEP 26 hotfix — on a real Supabase project PostgREST reported "more
    // than one relationship was found for 'reviews' and 'profiles'"
    // (ambiguous embed); resolved via a separate fetchProfilesByIds() call
    // below instead, which needs no relationship at all.
    .select("*, products(name_ko)")
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.rating) query = query.eq("rating", filters.rating);
  if (filters.q) query = query.ilike("content", `%${filters.q}%`);

  const { data, error } = await query.limit(200);
  if (error) fail("listAdminReviews", error);

  const rows = (data ?? []) as unknown as ReviewJoinRow[];
  const profileMap = await fetchProfilesByIds(supabase, rows.map((row) => row.user_id));

  return rows.map((row) => ({
    id: row.id,
    productId: row.product_id,
    productNameKo: row.products?.name_ko ?? "-",
    authorName: (row.user_id && profileMap.get(row.user_id)?.displayName) ?? "탈퇴회원",
    rating: row.rating,
    content: row.content,
    status: row.status,
    helpfulCount: row.helpful_count,
    createdAt: row.created_at,
  }));
}

export async function setAdminReviewStatus(id: string, status: "PUBLISHED" | "HIDDEN"): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ status } as never).eq("id", id);
  if (error) fail("setAdminReviewStatus", error);
}
