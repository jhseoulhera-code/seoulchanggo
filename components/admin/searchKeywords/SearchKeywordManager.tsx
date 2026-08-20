"use client";

import { useState } from "react";
import { saveSearchKeywordAction } from "@/lib/actions/adminSearchKeywords";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminSearchKeyword } from "@/types/admin";
import type { AdminSearchKeywordInput } from "@/lib/repositories/admin/searchKeywords";
import type { SearchKeywordTypeEnum } from "@/types/database";

const TYPE_LABEL: Record<SearchKeywordTypeEnum, string> = { POPULAR: "인기", RECOMMENDED: "추천" };
const MARKET_SELECT_OPTIONS: { value: "" | "KR" | "IN"; label: string }[] = [
  { value: "", label: "전체" },
  { value: "KR", label: "대한민국" },
  { value: "IN", label: "India" },
];
const LOCALE_SELECT_OPTIONS: { value: "" | "ko" | "en"; label: string }[] = [
  { value: "", label: "전체" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "영어" },
];

function emptyInput(): AdminSearchKeywordInput {
  return { keyword: "", type: "POPULAR", marketCode: null, locale: null, sortOrder: 0, isActive: true };
}

/**
 * Admin CRUD for search_keywords (STEP 12 spec sections 9, 20) — the only
 * source for the "인기 검색어"/"추천 검색어" chips shown in the Header
 * dropdown (components/layout/HeaderSearchBox.tsx). No live ranking
 * computed anywhere; the operator decides the list and its order.
 */
export function SearchKeywordManager({ keywords }: { keywords: AdminSearchKeyword[] }) {
  const popular = keywords.filter((keyword) => keyword.type === "POPULAR");
  const recommended = keywords.filter((keyword) => keyword.type === "RECOMMENDED");

  return (
    <div className="flex flex-col gap-6">
      <KeywordTable title="인기 검색어" keywords={popular} />
      <KeywordTable title="추천 검색어" keywords={recommended} />
      <SearchKeywordForm initial={null} onDone={() => {}} />
    </div>
  );
}

function KeywordTable({ title, keywords }: { title: string; keywords: AdminSearchKeyword[] }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-text-main">{title}</h2>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">검색어</th>
              <th className="px-3 py-2">마켓</th>
              <th className="px-3 py-2">언어</th>
              <th className="px-3 py-2">순서</th>
              <th className="px-3 py-2">노출</th>
            </tr>
          </thead>
          <tbody>
            {keywords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-text-secondary">
                  등록된 검색어가 없습니다.
                </td>
              </tr>
            ) : (
              keywords.map((keyword) => <KeywordRow key={keyword.id} keyword={keyword} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeywordRow({ keyword }: { keyword: AdminSearchKeyword }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-3 py-2 text-text-main">
          <button type="button" onClick={() => setEditing((prev) => !prev)} className="underline">
            {keyword.keyword}
          </button>
        </td>
        <td className="px-3 py-2 text-text-secondary">{keyword.marketCode ?? "전체"}</td>
        <td className="px-3 py-2 text-text-secondary">{keyword.locale ?? "전체"}</td>
        <td className="px-3 py-2 text-text-secondary">{keyword.sortOrder}</td>
        <td className="px-3 py-2">
          <StatusBadge label={keyword.isActive ? "노출" : "숨김"} tone={keyword.isActive ? "primary" : "default"} />
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="border-b border-border bg-primary-light/20 px-3 py-4">
            <SearchKeywordForm initial={keyword} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function SearchKeywordForm({ initial, onDone }: { initial: AdminSearchKeyword | null; onDone: () => void }) {
  const [form, setForm] = useState<AdminSearchKeywordInput>(() =>
    initial
      ? {
          keyword: initial.keyword,
          type: initial.type,
          marketCode: initial.marketCode,
          locale: initial.locale,
          sortOrder: initial.sortOrder,
          isActive: initial.isActive,
        }
      : emptyInput()
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AdminSearchKeywordInput>(key: K, value: AdminSearchKeywordInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.keyword.trim()) {
      setError("검색어를 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveSearchKeywordAction(initial?.id ?? null, form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!initial) setForm(emptyInput());
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 border border-border p-4">
      <h2 className="text-sm font-bold text-text-main">{initial ? "검색어 수정" : "검색어 추가"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          검색어
          <input value={form.keyword} onChange={(e) => set("keyword", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          구분
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value as SearchKeywordTypeEnum)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          >
            {(Object.entries(TYPE_LABEL) as [SearchKeywordTypeEnum, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          마켓
          <select
            value={form.marketCode ?? ""}
            onChange={(e) => set("marketCode", e.target.value ? (e.target.value as "KR" | "IN") : null)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          >
            {MARKET_SELECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          언어
          <select
            value={form.locale ?? ""}
            onChange={(e) => set("locale", e.target.value ? (e.target.value as "ko" | "en") : null)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          >
            {LOCALE_SELECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          정렬순서
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-primary" />
          노출
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={handleSave} disabled={pending} className="h-9 self-start bg-primary px-4 text-sm font-bold text-white disabled:bg-border">
          {pending ? "저장 중..." : "저장"}
        </button>
        {initial && (
          <button type="button" onClick={onDone} className="h-9 self-start border border-border px-4 text-sm text-text-secondary">
            취소
          </button>
        )}
      </div>
    </div>
  );
}
