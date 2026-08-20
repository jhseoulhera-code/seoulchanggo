"use client";

import { useState } from "react";
import { saveBannerAction, setBannerActiveAction } from "@/lib/actions/adminBanners";
import type { AdminBanner } from "@/types/admin";
import type { AdminBannerInput } from "@/lib/repositories/admin/banners";

function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

const EMPTY_FORM: AdminBannerInput = {
  title: "",
  subtitle: "",
  imageUrl: "",
  mobileImageUrl: "",
  linkUrl: "",
  marketCode: null,
  locale: null,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};

export function BannerManager({ banners }: { banners: AdminBanner[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
            <tr>
              <th className="px-3 py-2">이미지</th>
              <th className="px-3 py-2">제목</th>
              <th className="px-3 py-2">Market</th>
              <th className="px-3 py-2">순서</th>
              <th className="px-3 py-2">노출기간</th>
              <th className="px-3 py-2">활성</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((banner) => (
              <BannerRow key={banner.id} banner={banner} />
            ))}
          </tbody>
        </table>
      </div>

      <BannerForm initial={null} onDone={() => {}} />
    </div>
  );
}

function BannerRow({ banner }: { banner: AdminBanner }) {
  const [active, setActive] = useState(banner.isActive);
  const [editing, setEditing] = useState(false);

  async function toggleActive() {
    const next = !active;
    setActive(next);
    await setBannerActiveAction(banner.id, next);
  }

  return (
    <>
      <tr className="border-b border-border last:border-b-0">
        <td className="px-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.imageUrl} alt="" className="h-10 w-16 border border-border object-cover" />
        </td>
        <td className="px-3 py-2 text-text-main">
          <button type="button" onClick={() => setEditing((prev) => !prev)} className="underline">
            {banner.title}
          </button>
        </td>
        <td className="px-3 py-2 text-text-secondary">{banner.marketCode ?? "전체"}</td>
        <td className="px-3 py-2 text-text-secondary">{banner.sortOrder}</td>
        <td className="px-3 py-2 text-xs text-text-secondary">
          {banner.startsAt ? new Date(banner.startsAt).toLocaleDateString("ko-KR") : "-"} ~{" "}
          {banner.endsAt ? new Date(banner.endsAt).toLocaleDateString("ko-KR") : "-"}
        </td>
        <td className="px-3 py-2">
          <input type="checkbox" checked={active} onChange={toggleActive} className="h-4 w-4 accent-primary" />
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="border-b border-border bg-primary-light/20 px-3 py-4">
            <BannerForm initial={banner} onDone={() => setEditing(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function BannerForm({ initial, onDone }: { initial: AdminBanner | null; onDone: () => void }) {
  const [form, setForm] = useState<AdminBannerInput>(
    initial
      ? {
          title: initial.title,
          subtitle: initial.subtitle ?? "",
          imageUrl: initial.imageUrl,
          mobileImageUrl: initial.mobileImageUrl ?? "",
          linkUrl: initial.linkUrl ?? "",
          marketCode: initial.marketCode,
          locale: initial.locale,
          sortOrder: initial.sortOrder,
          startsAt: initial.startsAt,
          endsAt: initial.endsAt,
          isActive: initial.isActive,
        }
      : EMPTY_FORM
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AdminBannerInput>(key: K, value: AdminBannerInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.imageUrl.trim()) {
      setError("제목과 이미지 URL은 필수입니다.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await saveBannerAction(initial?.id ?? null, form);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!initial) setForm(EMPTY_FORM);
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 border border-border p-4">
      <h2 className="text-sm font-bold text-text-main">{initial ? "배너 수정" : "배너 추가"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          제목
          <input value={form.title} onChange={(e) => set("title", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          부제(선택)
          <input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          이미지 URL
          <input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          모바일 이미지 URL(선택)
          <input value={form.mobileImageUrl} onChange={(e) => set("mobileImageUrl", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          링크 URL(선택)
          <input value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          정렬순서
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value) || 0)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Market
          <select value={form.marketCode ?? ""} onChange={(e) => set("marketCode", (e.target.value || null) as AdminBannerInput["marketCode"])} className="border border-border px-2 py-1.5 text-sm outline-none">
            <option value="">전체</option>
            <option value="KR">KR</option>
            <option value="IN">IN</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Locale
          <select value={form.locale ?? ""} onChange={(e) => set("locale", (e.target.value || null) as AdminBannerInput["locale"])} className="border border-border px-2 py-1.5 text-sm outline-none">
            <option value="">전체</option>
            <option value="ko">ko</option>
            <option value="en">en</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          노출 시작일(선택)
          <input
            type="datetime-local"
            value={toDatetimeLocal(form.startsAt)}
            onChange={(e) => set("startsAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          노출 종료일(선택)
          <input
            type="datetime-local"
            value={toDatetimeLocal(form.endsAt)}
            onChange={(e) => set("endsAt", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-primary" />
          활성
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
