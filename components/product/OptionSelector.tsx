"use client";

import { cn } from "@/lib/utils";
import type { ProductOptionGroup } from "@/types";
import type { SelectedOptions } from "@/types/cart";
import type { OptionValueStatus } from "@/lib/storefront/productVariants";

type OptionSelectorProps = {
  options: ProductOptionGroup[];
  selected: SelectedOptions;
  onChange: (groupName: string, choice: string) => void;
  /** STEP 19 — per (group, choice) availability, e.g. from getOptionValueStatus. Omitted entirely means every choice is treated as "available" (the pre-STEP-19 behavior for a product with no real variant data). */
  getStatus?: (groupName: string, choice: string) => OptionValueStatus;
  soldOutLabel?: string;
};

export function OptionSelector({ options, selected, onChange, getStatus, soldOutLabel }: OptionSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      {options.map((group) => (
        <div key={group.name}>
          <h3 className="mb-2 text-xs font-bold text-text-secondary">{group.name}</h3>
          <div className="flex flex-wrap gap-2">
            {group.choices.map((choice) => {
              const isActive = selected[group.name] === choice;
              const status = getStatus?.(group.name, choice) ?? "available";
              const disabled = status !== "available";
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onChange(group.name, choice)}
                  disabled={disabled}
                  aria-pressed={isActive}
                  className={cn(
                    "border px-3.5 py-2 text-sm",
                    isActive && !disabled
                      ? "border-primary bg-primary-light font-medium text-primary"
                      : "border-border text-text-main",
                    status === "unavailable" && "cursor-not-allowed border-border text-text-secondary/40 line-through",
                    status === "soldOut" && "cursor-not-allowed border-border text-text-secondary line-through"
                  )}
                >
                  {choice}
                  {status === "soldOut" && soldOutLabel ? ` (${soldOutLabel})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
