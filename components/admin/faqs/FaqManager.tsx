"use client";

import { useState } from "react";
import { saveFaqAction } from "@/lib/actions/adminFaqs";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminFaq } from "@/types/admin";
import type { AdminFaqInput } from "@/lib/repositories/admin/faqs";

const CATEGORY_OPTIONS = ["주문/결제", "배송", "취소/환불", "회원", "해외배송"];

function emptyFaqInput(): AdminFaqInput {
  return { category: CATEGORY_OPTIONS[0], questionKo: "", questionEn: "", answerKo: "", answerEn: "", sortOrder: 0, isActive: true };
}

export function FaqManager({ faqs }: { faqs: AdminFaq[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">카테고리</th>
              <th className="px-3 py-2">질문</th>
              <th className="px-3 py-2">순서</th>
              <th className="px-3 py-2">노출</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map((faq) => (
              <FaqRow key={faq.id} faq={faq} />
            ))}
          </tbody>
        </table>
      </div>
      <FaqForm initial={null} onDone={() => {}} />
    </div>
  );
}

function FaqRow({ faq }: { faq: AdminFaq }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-3 py-2 text-text-secondary">{faq.category}</td>
        <td className="px-3 py-2 text-text-main">
          <button type="button" onClick={() => setEditing((prev) => !prev)} className="underline">
            {faq.questionKo}
          </button>
        </td>
        <td className="px-3 py-2 text-text-secondary">{faq.sortOrder}</td>
        <td className="px-3 py-2">
          <StatusBadge label={faq.isActive ? "노출" : "숨김"} tone={faq.isActive ? "primary" : "default"} />
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={4} className="border-b border-border bg-primary-light/20 px-3 py-4">
            <FaqForm initial={faq} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function FaqForm({ initial, onDone }: { initial: AdminFaq | null; onDone: () => void }) {
  const [form, setForm] = useState<AdminFaqInput>(() =>
    initial
      ? {
          category: initial.category,
          questionKo: initial.questionKo,
          questionEn: initial.questionEn,
          answerKo: initial.answerKo,
          answerEn: initial.answerEn,
          sortOrder: initial.sortOrder,
          isActive: initial.isActive,
        }
      : emptyFaqInput()
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AdminFaqInput>(key: K, value: AdminFaqInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.questionKo.trim() || !form.answerKo.trim()) {
      setError("한글 질문과 답변은 필수입니다.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveFaqAction(initial?.id ?? null, {
      ...form,
      questionEn: form.questionEn || form.questionKo,
      answerEn: form.answerEn || form.answerKo,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!initial) setForm(emptyFaqInput());
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 border border-border p-4">
      <h2 className="text-sm font-bold text-text-main">{initial ? "FAQ 수정" : "FAQ 추가"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          카테고리
          <select value={form.category} onChange={(e) => set("category", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none">
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          정렬순서
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          질문(한글)
          <input value={form.questionKo} onChange={(e) => set("questionKo", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          질문(영문)
          <input value={form.questionEn} onChange={(e) => set("questionEn", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          답변(한글)
          <textarea value={form.answerKo} onChange={(e) => set("answerKo", e.target.value)} rows={3} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          답변(영문)
          <textarea value={form.answerEn} onChange={(e) => set("answerEn", e.target.value)} rows={3} className="border border-border px-2 py-1.5 text-sm outline-none" />
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
