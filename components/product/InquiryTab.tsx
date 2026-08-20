"use client";

import { CornerDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { inquiries as mockInquiries } from "@/data/inquiries";
import { getProductInquiriesAction, submitInquiryAction, type ProductInquiry } from "@/lib/actions/inquiries";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

function mockToProductInquiry(inquiry: (typeof mockInquiries)[number]): ProductInquiry {
  return {
    id: inquiry.id,
    authorName: inquiry.author,
    question: inquiry.question,
    status: inquiry.status === "answered" ? "ANSWERED" : "PENDING",
    answer: inquiry.answer ?? null,
    createdAt: inquiry.date,
  };
}

export function InquiryTab({ product }: { product: Product }) {
  const { isAuthenticated } = useAuth();
  const isReal = Boolean(product.dbId);

  const [inquiryList, setInquiryList] = useState<ProductInquiry[]>(() => (isReal ? [] : mockInquiries.map(mockToProductInquiry)));
  const [loading, setLoading] = useState(isReal);
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isReal || !product.dbId) return;
    let cancelled = false;
    getProductInquiriesAction(product.dbId).then((data) => {
      if (!cancelled) {
        setInquiryList(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isReal, product.dbId]);

  async function handleSubmit() {
    if (!product.dbId) return;
    setSubmitting(true);
    setError(null);
    const result = await submitInquiryAction(product.dbId, question);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuestion("");
    setShowForm(false);
    const refreshed = await getProductInquiriesAction(product.dbId);
    setInquiryList(refreshed);
  }

  return (
    <div className="flex flex-col gap-4 py-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-main">
          상품문의 <span className="font-bold text-primary">{inquiryList.length}</span>건
        </p>
        {isReal ? (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="border border-primary px-3 py-1.5 text-xs font-bold text-primary"
          >
            상품문의 작성
          </button>
        ) : (
          <button type="button" className="cursor-not-allowed border border-primary px-3 py-1.5 text-xs font-bold text-primary">
            상품문의 작성
          </button>
        )}
      </div>

      {isReal && showForm && (
        <div className="flex flex-col gap-2 border border-border p-3">
          {isAuthenticated ? (
            <>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="상품에 대해 궁금한 점을 남겨주세요."
                className="border border-border px-2.5 py-2 text-sm outline-none"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-9 bg-primary px-4 text-xs font-bold text-white disabled:bg-border"
                >
                  {submitting ? "등록 중..." : "등록"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="h-9 border border-border px-4 text-xs text-text-secondary">
                  취소
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-secondary">로그인 후 문의를 작성할 수 있습니다.</p>
          )}
        </div>
      )}

      <div className="flex flex-col">
        {loading && <p className="py-10 text-center text-sm text-text-secondary">불러오는 중...</p>}
        {!loading && inquiryList.length === 0 && (
          <p className="py-10 text-center text-sm text-text-secondary">등록된 문의가 없습니다.</p>
        )}
        {inquiryList.map((inquiry) => (
          <div key={inquiry.id} className="border-t border-border py-4 first:border-t-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                  inquiry.status === "ANSWERED" ? "border-primary bg-primary-light text-primary" : "border-border text-text-secondary"
                )}
              >
                {inquiry.status === "ANSWERED" ? "답변완료" : "답변대기"}
              </span>
              <span className="text-xs text-text-secondary">
                {isReal ? new Date(inquiry.createdAt).toLocaleDateString("ko-KR") : inquiry.createdAt}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-main">{inquiry.question}</p>
            <p className="mt-1 text-xs text-text-secondary">{inquiry.authorName}</p>

            {inquiry.answer && (
              <div className="mt-3 flex items-start gap-2 bg-primary-light p-3 text-xs leading-relaxed text-text-secondary">
                <CornerDownRight size={13} className="mt-0.5 shrink-0 text-primary" />
                <p>{inquiry.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
