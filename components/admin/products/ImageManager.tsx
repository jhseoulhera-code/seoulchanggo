"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { addImageAction, deleteImageAction, setPrimaryImageAction } from "@/lib/actions/adminProducts";
import type { AdminProductImage } from "@/types/admin";

type ImageManagerProps = {
  productId: string;
  images: AdminProductImage[];
};

/**
 * Storage upload isn't wired up this step (see supabase/migrations/…_admin_storage_bucket.sql —
 * the bucket/policies are ready, but file upload can't be verified without a live
 * project). Admins add images by URL instead, per STEP 09 spec section 14's
 * explicit URL-input fallback.
 */
export function ImageManager({ productId, images }: ImageManagerProps) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!url.trim()) {
      setError("이미지 URL을 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await addImageAction(productId, {
      imageUrl: url.trim(),
      altKo: alt,
      sortOrder: images.length,
      isPrimary: images.length === 0,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUrl("");
    setAlt("");
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">이미지</h2>

      {images.length === 0 ? (
        <p className="text-xs text-text-secondary">등록된 이미지가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image) => (
            <div key={image.id} className="flex flex-col gap-1.5 border border-border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.imageUrl} alt={image.altKo ?? ""} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPrimaryImageAction(productId, image.id)}
                  aria-label="대표 이미지로 설정"
                  className={image.isPrimary ? "text-primary" : "text-text-secondary"}
                >
                  <Star size={16} className={image.isPrimary ? "fill-primary" : ""} />
                </button>
                <button type="button" onClick={() => deleteImageAction(productId, image.id)} className="text-xs text-red-600">
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          이미지 URL
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-64 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          대체 텍스트(선택)
          <input value={alt} onChange={(e) => setAlt(e.target.value)} className="w-48 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending}
          className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
        >
          추가
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
