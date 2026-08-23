"use client";

import { ChevronDown, ChevronUp, Star, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { addImageAction, deleteImageAction, reorderImagesAction, setPrimaryImageAction } from "@/lib/actions/adminProducts";
import { PRODUCT_IMAGE_MAX_COUNT, validateProductImageFile } from "@/lib/admin/productImages";
import { createClient } from "@/lib/supabase/client";
import type { AdminProductImage } from "@/types/admin";

type ImageUploadManagerProps = {
  productId: string;
  images: AdminProductImage[];
  onImagesChange: (images: AdminProductImage[]) => void;
};

/**
 * STEP 16 spec section 1 Step 4 — real upload to the existing product-images
 * Storage bucket (bucket + admin-only RLS already existed since STEP 09;
 * this is the first thing that actually uploads to it — see
 * components/admin/products/ImageManager.tsx's own comment on why it never
 * did). Uploads directly from the browser with the signed-in admin's own
 * session, so the bucket's `product_images_bucket_admin_insert` policy is
 * the real enforcement, not this component.
 *
 * Owns its own local image list (seeded once from the `images` prop) and
 * reports every change up via onImagesChange, rather than depending on the
 * Wizard's parent Server Component re-rendering with fresh props — the
 * Wizard is a client component tree end-to-end, so that RSC-refresh
 * pattern the older ImageManager relies on doesn't apply here.
 */
export function ImageUploadManager({ productId, images, onImagesChange }: ImageUploadManagerProps) {
  const [list, setList] = useState<AdminProductImage[]>(images);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function update(next: AdminProductImage[]) {
    setList(next);
    onImagesChange(next);
  }

  async function uploadFiles(files: FileList | File[]) {
    const requested = Array.from(files);
    if (requested.length === 0) return;

    setError(null);

    // STEP 18 spec section 6 — fail fast client-side (MIME/size/count);
    // real enforcement is the product-images bucket's own
    // file_size_limit/allowed_mime_types (STEP 18 migration) plus
    // addAdminProductImage's own count check, since a direct Storage/action
    // call could bypass this component entirely.
    const remainingSlots = PRODUCT_IMAGE_MAX_COUNT - list.length;
    if (remainingSlots <= 0) {
      setError(`이미지는 상품당 최대 ${PRODUCT_IMAGE_MAX_COUNT}개까지 등록할 수 있습니다.`);
      return;
    }

    const fileArray: File[] = [];
    for (const file of requested.slice(0, remainingSlots)) {
      const check = validateProductImageFile(file);
      if (!check.ok) {
        setError(check.error);
        continue;
      }
      fileArray.push(file);
    }
    if (requested.length > remainingSlots) {
      setError(`이미지는 상품당 최대 ${PRODUCT_IMAGE_MAX_COUNT}개까지 등록할 수 있어 앞의 ${remainingSlots}개만 업로드합니다.`);
    }
    if (fileArray.length === 0) return;

    setUploadingCount((count) => count + fileArray.length);
    const supabase = createClient();
    let working = list;

    for (const file of fileArray) {
      const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file);
      if (uploadError) {
        setError(`업로드 실패: ${uploadError.message}`);
        setUploadingCount((count) => count - 1);
        continue;
      }
      const { data: publicUrlData } = supabase.storage.from("product-images").getPublicUrl(path);
      const isFirst = working.length === 0;
      const result = await addImageAction(productId, {
        imageUrl: publicUrlData.publicUrl,
        altKo: "",
        sortOrder: working.length,
        isPrimary: isFirst,
      });
      setUploadingCount((count) => count - 1);
      if (!result.ok) {
        setError(result.error);
        continue;
      }
      working = [...working, { id: result.data.id, imageUrl: result.data.imageUrl, altKo: result.data.altKo, sortOrder: result.data.sortOrder, isPrimary: result.data.isPrimary }];
      update(working);
    }
  }

  async function handleSetPrimary(imageId: string) {
    const result = await setPrimaryImageAction(productId, imageId);
    if (!result.ok) return setError(result.error);
    update(list.map((image) => ({ ...image, isPrimary: image.id === imageId })));
  }

  async function handleDelete(imageId: string) {
    const result = await deleteImageAction(productId, imageId);
    if (!result.ok) return setError(result.error);
    update(list.filter((image) => image.id !== imageId));
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    update(reordered.map((image, i) => ({ ...image, sortOrder: i })));
    const result = await reorderImagesAction(productId, reordered.map((image) => image.id));
    if (!result.ok) setError(result.error);
  }

  const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">이미지</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-6 text-center ${
          dragOver ? "border-primary bg-primary-light/40" : "border-border"
        }`}
      >
        <Upload size={20} className="text-text-secondary" />
        <p className="text-xs text-text-secondary">클릭하거나 이미지를 드래그해서 업로드 (여러 장 선택 가능)</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
        />
      </div>
      {uploadingCount > 0 && <p className="text-xs text-primary">업로드 중... ({uploadingCount}개 진행 중)</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-xs text-text-secondary">등록된 이미지가 없습니다. 대표 이미지 등록을 권장합니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sorted.map((image, index) => (
            <div key={image.id} className="flex flex-col gap-1.5 border border-border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.imageUrl} alt={image.altKo ?? ""} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleSetPrimary(image.id)}
                  aria-label="대표 이미지로 설정"
                  className={image.isPrimary ? "text-primary" : "text-text-secondary"}
                >
                  <Star size={16} className={image.isPrimary ? "fill-primary" : ""} />
                </button>
                <div className="flex items-center gap-1">
                  <button type="button" disabled={index === 0} onClick={() => handleMove(index, -1)} className="text-text-secondary disabled:opacity-30">
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={index === sorted.length - 1}
                    onClick={() => handleMove(index, 1)}
                    className="text-text-secondary disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => handleDelete(image.id)} aria-label="삭제" className="text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
