"use client";

import { Image as ImageIcon, Star, ThumbsUp, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { RATING_DISTRIBUTION, reviews } from "@/data/reviews";
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

export function ReviewsTab({ product }: ReviewsTabProps) {
  const [sort, setSort] = useState<ReviewSort>("latest");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [helpfulSet, setHelpfulSet] = useState<Set<string>>(new Set());

  function toggleHelpful(id: string) {
    setHelpfulSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const visibleReviews = useMemo(() => {
    const filtered = mediaOnly
      ? reviews.filter((review) => review.hasPhoto || review.hasVideo)
      : reviews;

    const sorted = [...filtered].sort((a, b) => {
      switch (sort) {
        case "ratingHigh":
          return b.rating - a.rating;
        case "ratingLow":
          return a.rating - b.rating;
        case "helpful":
          return b.helpfulCount - a.helpfulCount;
        case "latest":
        default:
          return b.date.localeCompare(a.date);
      }
    });

    return sorted;
  }, [sort, mediaOnly]);

  return (
    <div className="flex flex-col gap-6 py-5">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-text-main">{product.rating.toFixed(1)}</span>
          <div>
            <div className="flex items-center gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={14}
                  className={
                    index < Math.round(product.rating) ? "fill-primary text-primary" : "text-border"
                  }
                />
              ))}
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">
              전체 {product.reviewCount.toLocaleString("ko-KR")}개
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          {RATING_DISTRIBUTION.map((row) => (
            <div key={row.star} className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="w-6 shrink-0">{row.star}점</span>
              <div className="h-1.5 flex-1 bg-border">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${row.percentage}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right">{row.percentage}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSort(option.value)}
              className={cn(
                "flex-shrink-0 border px-3 py-1.5 text-xs font-medium",
                sort === option.value
                  ? "border-primary text-primary"
                  : "border-border text-text-secondary"
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
        {visibleReviews.length === 0 && (
          <p className="py-10 text-center text-sm text-text-secondary">
            조건에 맞는 리뷰가 없습니다.
          </p>
        )}
        {visibleReviews.map((review) => {
          const isHelpful = helpfulSet.has(review.id);
          return (
            <article key={review.id} className="border-t border-border py-4 first:border-t-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-main">{review.author}</span>
                <span className="text-xs text-text-secondary">{review.date}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex items-center gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      size={12}
                      className={index < review.rating ? "fill-primary text-primary" : "text-border"}
                    />
                  ))}
                </div>
                {review.optionLabel && (
                  <span className="text-xs text-text-secondary">{review.optionLabel}</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-main">{review.content}</p>

              {(review.hasPhoto || review.hasVideo) && (
                <div className="mt-2.5 flex gap-2">
                  {review.hasPhoto && (
                    <div className="flex h-16 w-16 items-center justify-center border border-border bg-primary-light text-primary/50">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  {review.hasVideo && (
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
                  isHelpful ? "border-primary text-primary" : "border-border text-text-secondary"
                )}
              >
                <ThumbsUp size={12} />
                도움이 돼요 {review.helpfulCount + (isHelpful ? 1 : 0)}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
