"use client";

import { Camera, ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { useMarket } from "@/contexts/MarketContext";
import { runImageSearchAction } from "@/lib/actions/imageSearch";
import { validateSearchImageFile } from "@/lib/search/imageValidation";
import { getMessages } from "@/messages";
import type { ImageSearchResult } from "@/lib/imageSearch/types";

/**
 * The dev-only interactive image-search flow (STEP 12 spec sections 10-14,
 * 21-31) — mobile camera capture, mobile gallery picker, and desktop
 * drag-and-drop all feed the same validated File into
 * lib/actions/imageSearch.ts. Only ever rendered when
 * app/search/image/page.tsx decides the environment allows it; production
 * users see components/product/ImageSearchComingSoon.tsx instead.
 */
export function ImageSearchClient() {
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageSearchResult | null>(null);

  function handleFile(selected: File | null) {
    if (!selected) return;
    const validation = validateSearchImageFile(selected);
    if (!validation.ok) {
      const errorByCode = {
        INVALID_TYPE: messages.search.invalidImageType,
        INVALID_EXTENSION: messages.search.invalidImageExtension,
        TOO_LARGE: messages.search.imageTooLarge,
      };
      setError(errorByCode[validation.code]);
      return;
    }
    setError(null);
    setResult(null);
    setFile(selected);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(selected);
    });
  }

  function reset() {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const searchResult = await runImageSearchAction({ fileName: file.name, fileSize: file.size, mimeType: file.type }, market.locale);
      setResult(searchResult);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : messages.search.imageSearchFailed);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      <p className="rounded-lg bg-primary-light/40 px-3 py-2 text-xs text-text-secondary">{messages.search.imageSearchDevNotice}</p>

      {!previewUrl ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            handleFile(event.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-12 text-center ${
            isDragging ? "border-primary bg-primary-light/30" : "border-border"
          }`}
        >
          <UploadCloud size={32} className="text-text-secondary" />
          <p className="text-sm text-text-secondary">{messages.search.dragDropHint}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-text-main"
            >
              <Camera size={16} /> {messages.search.takePhoto}
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-text-main"
            >
              <ImagePlus size={16} /> {messages.search.chooseFromGallery}
            </button>
          </div>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-2xl border border-border">
            {/* Local blob preview — next/image's default loader doesn't handle blob: URLs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={messages.search.imagePreviewAlt} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={reset}
              aria-label={messages.search.clearImage}
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-text-main"
            >
              <X size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="h-11 rounded-full bg-primary text-sm font-bold text-white disabled:bg-border"
          >
            {pending ? <Loader2 size={16} className="mx-auto animate-spin" /> : messages.search.searchByImage}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {result && (
        <section className="flex flex-col gap-3 border-t border-border pt-5">
          <p className="text-sm text-text-main">{result.message}</p>
          <ProductGrid products={result.items.map((item) => item.product)} />
        </section>
      )}
    </div>
  );
}
