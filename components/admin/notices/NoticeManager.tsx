"use client";

import { useState } from "react";
import { saveNoticeAction } from "@/lib/actions/adminNotices";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminNotice } from "@/types/admin";
import type { AdminNoticeInput } from "@/lib/repositories/admin/notices";

function emptyNoticeInput(): AdminNoticeInput {
  return {
    titleKo: "",
    titleEn: "",
    contentKo: "",
    contentEn: "",
    isPinned: false,
    isActive: true,
    publishedAt: new Date().toISOString(),
  };
}

export function NoticeManager({ notices }: { notices: AdminNotice[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">제목</th>
              <th className="px-3 py-2">게시일</th>
              <th className="px-3 py-2">고정</th>
              <th className="px-3 py-2">노출</th>
            </tr>
          </thead>
          <tbody>
            {notices.map((notice) => (
              <NoticeRow key={notice.id} notice={notice} />
            ))}
          </tbody>
        </table>
      </div>
      <NoticeForm initial={null} onDone={() => {}} />
    </div>
  );
}

function NoticeRow({ notice }: { notice: AdminNotice }) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-3 py-2 text-text-main">
          <button type="button" onClick={() => setEditing((prev) => !prev)} className="underline">
            {notice.titleKo}
          </button>
        </td>
        <td className="px-3 py-2 text-text-secondary">{new Date(notice.publishedAt).toLocaleDateString("ko-KR")}</td>
        <td className="px-3 py-2">{notice.isPinned ? <StatusBadge label="고정" tone="primary" /> : "-"}</td>
        <td className="px-3 py-2">
          <StatusBadge label={notice.isActive ? "노출" : "숨김"} tone={notice.isActive ? "primary" : "default"} />
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={4} className="border-b border-border bg-primary-light/20 px-3 py-4">
            <NoticeForm initial={notice} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function NoticeForm({ initial, onDone }: { initial: AdminNotice | null; onDone: () => void }) {
  const [form, setForm] = useState<AdminNoticeInput>(() =>
    initial
      ? {
          titleKo: initial.titleKo,
          titleEn: initial.titleEn,
          contentKo: initial.contentKo,
          contentEn: initial.contentEn,
          isPinned: initial.isPinned,
          isActive: initial.isActive,
          publishedAt: initial.publishedAt,
        }
      : emptyNoticeInput()
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AdminNoticeInput>(key: K, value: AdminNoticeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.titleKo.trim() || !form.contentKo.trim()) {
      setError("한글 제목과 내용은 필수입니다.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveNoticeAction(initial?.id ?? null, { ...form, titleEn: form.titleEn || form.titleKo, contentEn: form.contentEn || form.contentKo });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!initial) setForm(emptyNoticeInput());
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 border border-border p-4">
      <h2 className="text-sm font-bold text-text-main">{initial ? "공지 수정" : "공지 작성"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          제목(한글)
          <input value={form.titleKo} onChange={(e) => set("titleKo", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          제목(영문)
          <input value={form.titleEn} onChange={(e) => set("titleEn", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          내용(한글)
          <textarea value={form.contentKo} onChange={(e) => set("contentKo", e.target.value)} rows={4} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          내용(영문)
          <textarea value={form.contentEn} onChange={(e) => set("contentEn", e.target.value)} rows={4} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={form.isPinned} onChange={(e) => set("isPinned", e.target.checked)} className="h-4 w-4 accent-primary" />
          상단 고정
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
