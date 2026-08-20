"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ReviewImageRow, ReviewRow } from "@/types/database";

export type ProductReview = {
  id: string;
  authorName: string;
  rating: number;
  content: string;
  optionLabel: string;
  images: string[];
  helpfulCount: number;
  isHelpfulByMe: boolean;
  createdAt: string;
};

/** First two characters + a mask, e.g. "김철수" → "김철**" — no exact display name is ever shown next to review content. */
function maskDisplayName(name: string): string {
  if (name.length <= 2) return `${name.slice(0, 1)}**`;
  return `${name.slice(0, 2)}**`;
}

type ReviewJoinRow = ReviewRow & {
  profiles: { display_name: string } | null;
  review_images: ReviewImageRow[];
  review_helpful_votes: { user_id: string }[];
};

export async function getProductReviewsAction(productDbId: string): Promise<ProductReview[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, profiles(display_name), review_images(*), review_helpful_votes(user_id)")
    .eq("product_id", productDbId)
    .eq("status", "PUBLISHED")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reviews] getProductReviewsAction failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as ReviewJoinRow[]).map((row) => ({
    id: row.id,
    authorName: row.profiles?.display_name ? maskDisplayName(row.profiles.display_name) : "익명",
    rating: row.rating,
    content: row.content,
    optionLabel: Object.values((row.option_snapshot as unknown as Record<string, string>) ?? {}).join(" / "),
    images: [...row.review_images].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url),
    helpfulCount: row.helpful_count,
    // review_helpful_votes RLS only ever returns the calling user's own row (or none), so
    // a non-empty array here already means "I voted" — no separate auth.uid() lookup needed.
    isHelpfulByMe: row.review_helpful_votes.length > 0,
    createdAt: row.created_at,
  }));
}

export type SubmitReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Purchase/delivery eligibility is re-checked here AND enforced independently
 * by the reviews_insert_own RLS policy (STEP 10 spec section 18) — this
 * function's own lookup exists only to return a friendlier error message
 * than a raw RLS rejection would.
 */
export async function submitReviewAction(
  productDbId: string,
  rating: number,
  content: string,
  imageUrls: string[]
): Promise<SubmitReviewResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "리뷰 작성은 Supabase 연결 후 이용할 수 있습니다." };
  }
  if (rating < 1 || rating > 5) return { ok: false, error: "평점을 선택해주세요." };
  if (!content.trim()) return { ok: false, error: "리뷰 내용을 입력해주세요." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 후 작성할 수 있습니다." };

  const { data: eligibleItem, error: eligibleError } = await supabase
    .from("order_items")
    .select("id, option_snapshot, orders!inner(user_id, order_status, created_at)")
    .eq("product_id", productDbId)
    .eq("orders.user_id", user.id)
    .eq("orders.order_status", "DELIVERED")
    .order("created_at", { ascending: false, referencedTable: "orders" })
    .limit(1)
    .maybeSingle();

  if (eligibleError) {
    console.error("[reviews] submitReviewAction eligibility lookup failed:", eligibleError.message);
    return { ok: false, error: "리뷰 작성 가능 여부를 확인하지 못했습니다." };
  }
  if (!eligibleItem) {
    return { ok: false, error: "구매 후 배송완료된 상품만 리뷰를 작성할 수 있습니다." };
  }

  const orderItem = eligibleItem as unknown as { id: string; option_snapshot: unknown };

  const { data: inserted, error: insertError } = await supabase
    .from("reviews")
    .insert({
      product_id: productDbId,
      user_id: user.id,
      order_item_id: orderItem.id,
      rating,
      content: content.trim(),
      option_snapshot: orderItem.option_snapshot ?? {},
    } as never)
    .select("id")
    .single();

  if (insertError) {
    console.error("[reviews] submitReviewAction insert failed:", insertError.message);
    if (insertError.code === "23505") return { ok: false, error: "이미 리뷰를 작성한 구매 건입니다." };
    return { ok: false, error: "리뷰를 저장하지 못했습니다." };
  }

  const reviewId = (inserted as unknown as { id: string }).id;
  if (imageUrls.length > 0) {
    await supabase
      .from("review_images")
      .insert(imageUrls.map((image_url, index) => ({ review_id: reviewId, image_url, sort_order: index })) as never);
  }

  revalidatePath("/product/[id]", "page");
  return { ok: true };
}

export type ToggleHelpfulResult = { ok: true; isHelpful: boolean } | { ok: false; error: string };

export async function toggleReviewHelpfulAction(reviewId: string): Promise<ToggleHelpfulResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase 연결 후 이용할 수 있습니다." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "로그인 후 이용할 수 있습니다." };

  const { data: existing } = await supabase
    .from("review_helpful_votes")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("review_helpful_votes").delete().eq("review_id", reviewId).eq("user_id", user.id);
    if (error) return { ok: false, error: "처리하지 못했습니다." };
    revalidatePath("/product/[id]", "page");
    return { ok: true, isHelpful: false };
  }

  const { error } = await supabase.from("review_helpful_votes").insert({ review_id: reviewId, user_id: user.id } as never);
  if (error) return { ok: false, error: "처리하지 못했습니다." };
  revalidatePath("/product/[id]", "page");
  return { ok: true, isHelpful: true };
}
