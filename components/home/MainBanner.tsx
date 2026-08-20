"use client";

import { useState } from "react";
import { heroSlides } from "@/data/heroSlides";
import { cn } from "@/lib/utils";

export function MainBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = heroSlides[activeIndex];
  const Icon = slide.icon;

  return (
    <section>
      <div
        className="relative aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-lg md:aspect-[21/9]"
        style={{ backgroundColor: slide.background }}
        onClick={() => setActiveIndex((activeIndex + 1) % heroSlides.length)}
      >
        <div className="flex h-full items-center justify-between px-6 md:px-12">
          <div>
            <h2 className="text-xl font-bold text-text-main md:text-3xl">
              {slide.title}
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary md:text-base">
              {slide.subtitle}
            </p>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className="mt-4 cursor-not-allowed rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white md:text-sm"
            >
              {slide.ctaLabel}
            </button>
          </div>
          <Icon
            size={72}
            strokeWidth={1}
            className="hidden shrink-0 text-primary/30 sm:block md:h-28 md:w-28"
          />
        </div>

        <span className="absolute bottom-3 right-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-medium text-white">
          {activeIndex + 1} / {heroSlides.length}
        </span>
      </div>

      <div className="mt-2.5 flex justify-center gap-1.5">
        {heroSlides.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={`${index + 1}번째 배너로 이동`}
            onClick={(event) => {
              event.stopPropagation();
              setActiveIndex(index);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              index === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-border"
            )}
          />
        ))}
      </div>
    </section>
  );
}
