"use client";

import { cn } from "@/lib/utils";

export const WIZARD_STEPS = [
  { key: "basic", label: "기본정보" },
  { key: "pricing", label: "가격" },
  { key: "supply", label: "공급/배송" },
  { key: "media", label: "이미지/옵션" },
  { key: "review", label: "검토/등록" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

type StepIndicatorProps = {
  current: WizardStepKey;
  onSelect: (step: WizardStepKey) => void;
  /** Steps the admin can jump to directly — earlier-than-current is always allowed; later steps only once a draft id exists. */
  reachable: WizardStepKey[];
};

export function StepIndicator({ current, onSelect, reachable }: StepIndicatorProps) {
  const currentIndex = WIZARD_STEPS.findIndex((step) => step.key === current);

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background px-4 py-2 md:-mx-6 md:px-6">
      <ol className="flex items-center gap-1 overflow-x-auto text-xs">
        {WIZARD_STEPS.map((step, index) => {
          const isCurrent = step.key === current;
          const isDone = index < currentIndex;
          const isReachable = reachable.includes(step.key);
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                disabled={!isReachable}
                onClick={() => onSelect(step.key)}
                className={cn(
                  "flex items-center gap-1.5 border px-2.5 py-1.5 font-bold whitespace-nowrap",
                  isCurrent
                    ? "border-primary bg-primary text-white"
                    : isDone
                      ? "border-primary text-primary"
                      : "border-border text-text-secondary",
                  !isReachable && "cursor-not-allowed opacity-50"
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px]">
                  {index + 1}
                </span>
                {step.label}
              </button>
              {index < WIZARD_STEPS.length - 1 && <span className="text-border">›</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
