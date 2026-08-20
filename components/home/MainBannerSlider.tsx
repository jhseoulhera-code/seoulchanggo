"use client";

import { Car, House, PawPrint, Utensils } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMarket } from "@/contexts/MarketContext";
import { cn } from "@/lib/utils";
import type { HeroSlide } from "@/types";

const ICONS: Record<string, LucideIcon> = { House, Utensils, PawPrint, Car };

export function MainBannerSlider({ slides }: { slides: HeroSlide[] }) {
  const { market } = useMarket();

  const visibleSlides = useMemo(() => {
    const filtered = slides.filter(
      (slide) =>
        (slide.marketCode == null || slide.marketCode === market.countryCode) &&
        (slide.locale == null || slide.locale === market.locale)
    );
    return filtered.length > 0 ? filtered : slides;
  }, [slides, market.countryCode, market.locale]);

  const [activeIndex, setActiveIndex] = useState(0);
  const index = activeIndex < visibleSlides.length ? activeIndex : 0;
  const slide = visibleSlides[index];
  if (!slide) return null;
  const Icon = slide.iconName ? ICONS[slide.iconName] : undefined;

  return (
    <section>
      <div
        className="relative aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-lg md:aspect-[21/9]"
        style={{ backgroundColor: slide.imageUrl ? undefined : slide.background }}
        onClick={() => setActiveIndex((index + 1) % visibleSlides.length)}
      >
        {slide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.imageUrl} alt={slide.title} className="h-full w-full object-cover" />
        ) : null}

        <div
          className={cn(
            "flex h-full items-center justify-between px-6 md:px-12",
            slide.imageUrl && "absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
          )}
        >
          <div>
            <h2 className={cn("text-xl font-bold md:text-3xl", slide.imageUrl ? "text-white" : "text-text-main")}>{slide.title}</h2>
            {slide.subtitle && (
              <p className={cn("mt-1.5 text-sm md:text-base", slide.imageUrl ? "text-white/90" : "text-text-secondary")}>
                {slide.subtitle}
              </p>
            )}
            {slide.ctaLabel &&
              (slide.linkUrl ? (
                <Link
                  href={slide.linkUrl}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white md:text-sm"
                >
                  {slide.ctaLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-4 cursor-not-allowed rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white md:text-sm"
                >
                  {slide.ctaLabel}
                </button>
              ))}
          </div>
          {Icon && !slide.imageUrl && (
            <Icon size={72} strokeWidth={1} className="hidden shrink-0 text-primary/30 sm:block md:h-28 md:w-28" />
          )}
        </div>

        <span className="absolute bottom-3 right-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white">
          {index + 1} / {visibleSlides.length}
        </span>
      </div>

      <div className="mt-2.5 flex justify-center gap-1.5">
        {visibleSlides.map((item, itemIndex) => (
          <button
            key={item.id}
            type="button"
            aria-label={`${itemIndex + 1}번째 배너로 이동`}
            onClick={(event) => {
              event.stopPropagation();
              setActiveIndex(itemIndex);
            }}
            className={cn("h-1.5 rounded-full transition-all", itemIndex === index ? "w-4 bg-primary" : "w-1.5 bg-border")}
          />
        ))}
      </div>
    </section>
  );
}
