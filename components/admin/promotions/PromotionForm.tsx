"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { savePromotionAction } from "@/lib/actions/adminPromotions";
import type { AdminPromotion } from "@/types/admin";
import type { AdminPromotionInput } from "@/lib/repositories/admin/promotions";

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toDatetimeLocal(iso: string | null): string {
  return iso ? iso.slice(0, 16) : "";
}

export function PromotionForm({ initial }: { initial: AdminPromotion | null }) {
  const router = useRouter();
  const [titleKo, setTitleKo] = useState(initial?.titleKo ?? "");
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  const [descriptionKo, setDescriptionKo] = useState(initial?.descriptionKo ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [marketCode, setMarketCode] = useState<"" | "KR" | "IN">(initial?.marketCode ?? "");
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(initial?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(initial?.endsAt ?? null));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTitleKoChange(value: string) {
    setTitleKo(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSave() {
    if (!titleKo.trim() || !slug.trim()) {
      setError("제목과 slug는 필수입니다.");
      return;
    }
    setPending(true);
    setError(null);
    const input: AdminPromotionInput = {
      slug: slug.trim(),
      titleKo: titleKo.trim(),
      titleEn: titleEn.trim() || titleKo.trim(),
      descriptionKo,
      descriptionEn,
      imageUrl,
      marketCode: marketCode || null,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      isActive,
    };
    const result = await savePromotionAction(initial?.id ?? null, input);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!initial) router.push(`/admin/promotions/${result.data.id}`);
  }

  return (
    <section className="flex flex-col gap-3 border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          제목(한글)
          <input value={titleKo} onChange={(e) => handleTitleKoChange(e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          제목(영문)
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          slug
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            className="border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          대표이미지 URL
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          설명(한글)
          <textarea value={descriptionKo} onChange={(e) => setDescriptionKo(e.target.value)} rows={2} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary sm:col-span-2">
          설명(영문)
          <textarea value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} rows={2} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Market
          <select value={marketCode} onChange={(e) => setMarketCode(e.target.value as "" | "KR" | "IN")} className="border border-border px-2 py-1.5 text-sm outline-none">
            <option value="">전체</option>
            <option value="KR">KR</option>
            <option value="IN">IN</option>
          </select>
        </label>
        <div />
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          시작일(선택)
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          종료일(선택)
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-text-secondary">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-primary" />
          활성
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="button" onClick={handleSave} disabled={pending} className="h-9 self-start bg-primary px-4 text-sm font-bold text-white disabled:bg-border">
        {pending ? "저장 중..." : "저장"}
      </button>
    </section>
  );
}
