"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { useMarket } from "@/contexts/MarketContext";
import { getLocalizedProductName } from "@/lib/productLocalization";
import { cn } from "@/lib/utils";
import { getMessages, t } from "@/messages";
import type { Product } from "@/types";

type ProductGalleryProps = {
  product: Product;
};

/**
 * STEP 19 spec section 5 — until this step, this component only ever
 * rendered ProductImagePlaceholder regardless of whether the product had
 * real images (see git history) — the primary/additional image data has
 * existed since STEP 08/18 but was never actually wired into the detail
 * page's gallery. Mirrors the real-image + placeholder-fallback pattern
 * already established in ProductCard.tsx, and next.config.ts's
 * remotePatterns already allowlists the Supabase Storage host these URLs
 * come from — no config change needed.
 */
export function ProductGallery({ product }: ProductGalleryProps) {
  const slides = product.images && product.images.length > 0 ? product.images : [];
  // Primary-image-first: mapProductRow orders `images` by sort_order (not
  // guaranteed to put the primary image first), but `product.image` is
  // already resolved to the primary (or lowest-sort_order) image — start
  // the gallery there instead of always at index 0.
  const initialIndex = Math.max(0, slides.findIndex((url) => url === product.image));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const { market } = useMarket();
  const messages = getMessages(market.locale);
  const displayName = getLocalizedProductName(product, market.locale);

  if (slides.length === 0) {
    return (
      <div className="aspect-[4/5] w-full overflow-hidden border border-border">
        <ProductImagePlaceholder category={product.category} className="h-full w-full" />
      </div>
    );
  }

  const activeUrl = slides[Math.min(activeIndex, slides.length - 1)];

  return (
    <div>
      {/* STEP 26.7 — taller than the old aspect-square, and the left
          column itself is now ~65% of the page instead of ~50%, so the
          same fill+object-cover Image renders visibly larger without any
          change to the underlying single-active-image + thumbnail-strip
          mechanism (still the best fit for this data — a plain array of
          image URLs, not pre-cropped section assets). */}
      <div className="relative aspect-[4/5] w-full overflow-hidden border border-border">
        <Image
          src={activeUrl}
          alt={displayName}
          fill
          sizes="(min-width: 1024px) 62vw, (min-width: 768px) 58vw, 100vw"
          priority={activeIndex === 0}
          className="object-cover"
        />
        {slides.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white">
            {activeIndex + 1} / {slides.length}
          </span>
        )}
      </div>

      {slides.length > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {slides.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={t(messages.a11y.viewImageAt, { index: index + 1 })}
              className={cn(
                "relative h-16 w-16 flex-shrink-0 overflow-hidden border",
                index === activeIndex ? "border-primary" : "border-border"
              )}
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
