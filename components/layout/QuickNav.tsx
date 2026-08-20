"use client";

import { useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { quickNavItems } from "@/data/quickNav";
import { cn } from "@/lib/utils";

export function QuickNav() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <nav className="border-b border-border bg-background">
      <PageContainer>
        <ul className="no-scrollbar flex gap-6 overflow-x-auto">
          {quickNavItems.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={item.label} className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "border-b-2 py-3 text-sm font-medium whitespace-nowrap",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-text-main"
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </PageContainer>
    </nav>
  );
}
