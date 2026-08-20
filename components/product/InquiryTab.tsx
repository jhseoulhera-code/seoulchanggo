"use client";

import { CornerDownRight } from "lucide-react";
import { useEffect, useState } from "react";
import { inquiries as mockInquiries } from "@/data/inquiries";
import { getProductInquiriesAction, submitInquiryAction, type ProductInquiry } from "@/lib/actions/inquiries";
import { useAuth } from "@/contexts/AuthContext";
import { useMarket } from "@/contexts/MarketContext";
import { formatDate } from "@/lib/intl";
import { cn } from "@/lib/utils";
import { getMessages, t } from "@/messages";
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
  const { market } = useMarket();
  const messages = getMessages(market.locale);
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
        <p className="text-sm text-text-main">{t(messages.inquiry.countLabel, { count: inquiryList.length })}</p>
        {isReal ? (
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="border border-primary px-3 py-1.5 text-xs font-bold text-primary"
          >
            {messages.inquiry.writeInquiry}
          </button>
        ) : (
          <button type="button" className="cursor-not-allowed border border-primary px-3 py-1.5 text-xs font-bold text-primary">
            {messages.inquiry.writeInquiry}
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
                placeholder={messages.inquiry.writePlaceholder}
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
                  {submitting ? messages.review.submitting : messages.review.submit}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="h-9 border border-border px-4 text-xs text-text-secondary">
                  {messages.review.cancel}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-text-secondary">{messages.inquiry.loginRequired}</p>
          )}
        </div>
      )}

      <div className="flex flex-col">
        {loading && <p className="py-10 text-center text-sm text-text-secondary">{messages.common.loading}</p>}
        {!loading && inquiryList.length === 0 && (
          <p className="py-10 text-center text-sm text-text-secondary">{messages.inquiry.empty}</p>
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
                {inquiry.status === "ANSWERED" ? messages.inquiry.answered : messages.inquiry.waiting}
              </span>
              <span className="text-xs text-text-secondary">
                {isReal ? formatDate(inquiry.createdAt, market.locale) : inquiry.createdAt}
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
