"use client";

import { Image as ImageIcon, Star, ThumbsUp, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getProductReviewsAction, submitReviewAction, toggleReviewHelpfulAction, type ProductReview } from "@/lib/actions/reviews";
import { RATING_DISTRIBUTION, reviews as mockReviews } from "@/data/reviews";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Product, ReviewSort } from "@/types";

type ReviewsTabProps = {
  product: Product;
};

const SORT_OPTIONS: { value: ReviewSort; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "ratingHigh", label: "평점 높은순" },
  { value: "ratingLow", label: "평점 낮은순" },
  { value: "helpful", label: "도움순" },
];

function mockToProductReview(review: (typeof mockReviews)[number]): ProductReview {
  return {
    id: review.id,
    authorName: review.author,
    rating: review.rating,
    content: review.content,
    optionLabel: review.optionLabel ?? "",
    images: review.hasPhoto ? ["mock"] : [],
    helpfulCount: review.helpfulCount,
    isHelpfulByMe: false,
    createdAt: review.date,
  };
}

export function ReviewsTab({ product }: ReviewsTabProps) {
  const { isAuthenticated } = useAuth();
  const isReal = Boolean(product.dbId);

  const [sort, setSort] = useState<ReviewSort>("latest");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [reviewList, setReviewList] = useState<ProductReview[]>(() => (isReal ? [] : mockReviews.map(mockToProductReview)));
  const [loading, setLoading] = useState(isReal);
  const [helpfulPending, setHelpfulPending] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isReal || !product.dbId) return;
    let cancelled = false;
    getProductReviewsAction(product.dbId).then((data) => {
      if (!cancelled) {
        setReviewList(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isReal, product.dbId]);

  async function toggleHelpful(id: string) {
    if (!isReal) {
      setReviewList((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, isHelpfulByMe: !r.isHelpfulByMe, helpfulCount: r.helpfulCount + (r.isHelpfulByMe ? -1 : 1) } : r
        )
      );
      return;
    }
    if (helpfulPending.has(id)) return;
    setHelpfulPending((prev) => new Set(prev).add(id));
    const result = await toggleReviewHelpfulAction(id);
    setHelpfulPending((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (result.ok) {
      setReviewList((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, isHelpfulByMe: result.isHelpful, helpfulCount: r.helpfulCount + (result.isHelpful ? 1 : -1) } : r
        )
      );
    }
  }

  async function handleSubmitReview() {
    if (!product.dbId) return;
    setSubmitting(true);
    setFormError(null);
    const result = await submitReviewAction(product.dbId, rating, content, []);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setContent("");
    setRating(5);
    setShowForm(false);
    const refreshed = await getProductReviewsAction(product.dbId);
    setReviewList(refreshed);
  }

  const visibleReviews = useMemo(() => {
    const filtered = mediaOnly ? reviewList.filter((review) => review.images.length > 0) : reviewList;
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "ratingHigh":
          return b.rating - a.rating;
        case "ratingLow":
          return a.rating - b.rating;
        case "helpful":
          return b.helpfulCount - a.helpfulCount;
        case "latest":
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [reviewList, sort, mediaOnly]);

  return (
    <div className="flex flex-col gap-6 py-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-text-main">{product.rating.toFixed(1)}</span>
          <div>
            <div className="flex items-center gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} size={14} className={index < Math.round(product.rating) ? "fill-primary text-primary" : "text-border"} />
              ))}
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">전체 {product.reviewCount.toLocaleString("ko-KR")}개</p>
          </div>
        </div>

        {!isReal && (
          <div className="flex flex-1 flex-col gap-1">
            {RATING_DISTRIBUTION.map((row) => (
              <div key={row.star} className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="w-6 shrink-0">{row.star}점</span>
                <div className="h-1.5 flex-1 bg-border">
                  <div className="h-full bg-primary" style={{ width: `${row.percentage}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right">{row.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {isReal && (
        <section className="flex flex-col gap-2 border-t border-border pt-4">
          {isAuthenticated ? (
            showForm ? (
              <div className="flex flex-col gap-2 border border-border p-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <button key={index} type="button" onClick={() => setRating(index + 1)}>
                      <Star size={18} className={index < rating ? "fill-primary text-primary" : "text-border"} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={3}
                  placeholder="상품에 대한 솔직한 후기를 남겨주세요."
                  className="border border-border px-2.5 py-2 text-sm outline-none"
                />
                {formError && <p className="text-xs text-red-600">{formError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitReview}
                    disabled={submitting}
                    className="h-9 bg-primary px-4 text-xs font-bold text-white disabled:bg-border"
                  >
                    {submitting ? "등록 중..." : "등록"}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="h-9 border border-border px-4 text-xs text-text-secondary">
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowForm(true)} className="self-start border border-primary px-3 py-1.5 text-xs font-bold text-primary">
                리뷰 작성
              </button>
            )
          ) : (
            <p className="text-xs text-text-secondary">로그인 후 구매하신 상품에 리뷰를 작성할 수 있습니다.</p>
          )}
        </section>
      )}

      <section className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
              className={cn(
                "flex-shrink-0 border px-3 py-1.5 text-xs font-medium",
                sort === option.value ? "border-primary text-primary" : "border-border text-text-secondary"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMediaOnly((prev) => !prev)}
          className={cn(
            "flex flex-shrink-0 items-center gap-1 border px-3 py-1.5 text-xs font-medium",
            mediaOnly ? "border-primary text-primary" : "border-border text-text-secondary"
          )}
        >
          <ImageIcon size={12} />
          사진/동영상만
        </button>
      </section>

      <section className="flex flex-col">
        {loading && <p className="py-10 text-center text-sm text-text-secondary">불러오는 중...</p>}
        {!loading && visibleReviews.length === 0 && (
          <p className="py-10 text-center text-sm text-text-secondary">조건에 맞는 리뷰가 없습니다.</p>
        )}
        {!loading &&
          visibleReviews.map((review) => (
            <article key={review.id} className="border-t border-border py-4 first:border-t-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-main">{review.authorName}</span>
                <span className="text-xs text-text-secondary">
                  {isReal ? new Date(review.createdAt).toLocaleDateString("ko-KR") : review.createdAt}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={12} className={index < review.rating ? "fill-primary text-primary" : "text-border"} />
                  ))}
                </div>
                {review.optionLabel && <span className="text-xs text-text-secondary">{review.optionLabel}</span>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-main">{review.content}</p>

              {review.images.length > 0 && (
                <div className="mt-2.5 flex gap-2">
                  {review.images.map((image, index) =>
                    isReal ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={index} src={image} alt="" className="h-16 w-16 border border-border object-cover" />
                    ) : (
                      <div key={index} className="flex h-16 w-16 items-center justify-center border border-border bg-primary-light text-primary/50">
                        <ImageIcon size={20} />
                      </div>
                    )
                  )}
                  {!isReal && mockReviews.find((r) => r.id === review.id)?.hasVideo && (
                    <div className="flex h-16 w-16 items-center justify-center border border-border bg-primary-light text-primary/50">
                      <Video size={20} />
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => toggleHelpful(review.id)}
                className={cn(
                  "mt-3 flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium",
                  review.isHelpfulByMe ? "border-primary text-primary" : "border-border text-text-secondary"
                )}
              >
                <ThumbsUp size={12} />
                도움이 돼요 {review.helpfulCount}
              </button>
            </article>
          ))}
      </section>
    </div>
  );
}
