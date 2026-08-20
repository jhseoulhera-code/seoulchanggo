"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import type { Faq } from "@/lib/repositories/faqs";

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const { market } = useMarket();
  const isKo = market.locale === "ko";
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("전체");

  const categories = useMemo(() => ["전체", ...Array.from(new Set(faqs.map((f) => f.category)))], [faqs]);

  const filtered = useMemo(() => {
    return faqs.filter((faq) => {
      const question = isKo ? faq.questionKo : faq.questionEn;
      const matchesCategory = activeCategory === "전체" || faq.category === activeCategory;
      const matchesQuery = !query.trim() || question.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [faqs, isKo, activeCategory, query]);

  if (faqs.length === 0) {
    return <p className="py-16 text-center text-sm text-text-secondary">등록된 FAQ가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="궁금한 내용을 검색해보세요"
        className="border border-border px-3 py-2.5 text-sm outline-none"
      />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setActiveCategory(category)}
            className={cn(
              "flex-shrink-0 border px-3 py-1.5 text-xs font-medium",
              activeCategory === category ? "border-primary text-primary" : "border-border text-text-secondary"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-secondary">조건에 맞는 FAQ가 없습니다.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {filtered.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <li key={faq.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="flex w-full items-center justify-between py-3.5 text-left text-sm text-text-main"
                >
                  <span>{isKo ? faq.questionKo : faq.questionEn}</span>
                  <ChevronDown size={16} className={cn("shrink-0 text-text-secondary transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <p className="whitespace-pre-wrap pb-4 text-sm leading-relaxed text-text-secondary">
                    {isKo ? faq.answerKo : faq.answerEn}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
