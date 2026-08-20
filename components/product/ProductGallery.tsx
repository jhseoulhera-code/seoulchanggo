"use client";

import { useState } from "react";
import { ProductImagePlaceholder } from "@/components/product/ProductImagePlaceholder";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import { getMessages, t } from "@/messages";
import type { Product } from "@/types";

type ProductGalleryProps = {
  product: Product;
};

const DEFAULT_SLIDE_COUNT = 4;

export function ProductGallery({ product }: ProductGalleryProps) {
  const slides =
    product.images && product.images.length > 0
      ? product.images
      : Array.from({ length: DEFAULT_SLIDE_COUNT }, () => "");
  const [activeIndex, setActiveIndex] = useState(0);
  const { market } = useMarket();
  const messages = getMessages(market.locale);

  return (
    <div>
      <div
        className="relative aspect-square w-full cursor-pointer overflow-hidden border border-border"
        onClick={() => setActiveIndex((activeIndex + 1) % slides.length)}
      >
        <ProductImagePlaceholder category={product.category} className="h-full w-full" />
        {slides.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-medium text-white">
            {activeIndex + 1} / {slides.length}
          </span>
        )}
      </div>

      {slides.length > 1 && (
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={t(messages.a11y.viewImageAt, { index: index + 1 })}
              className={cn(
                "h-14 w-14 flex-shrink-0 overflow-hidden border",
                index === activeIndex ? "border-primary" : "border-border"
              )}
            >
              <ProductImagePlaceholder category={product.category} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
