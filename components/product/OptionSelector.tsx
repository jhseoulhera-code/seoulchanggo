"use client";

import { cn } from "@/lib/utils";
import type { ProductOptionGroup } from "@/types";
import type { SelectedOptions } from "@/types/cart";

type OptionSelectorProps = {
  options: ProductOptionGroup[];
  selected: SelectedOptions;
  onChange: (groupName: string, choice: string) => void;
};

export function OptionSelector({ options, selected, onChange }: OptionSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      {options.map((group) => (
        <div key={group.name}>
          <h3 className="mb-2 text-xs font-bold text-text-secondary">{group.name}</h3>
          <div className="flex flex-wrap gap-2">
            {group.choices.map((choice) => {
              const isActive = selected[group.name] === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => onChange(group.name, choice)}
                  className={cn(
                    "border px-3.5 py-2 text-sm",
                    isActive
                      ? "border-primary bg-primary-light font-medium text-primary"
                      : "border-border text-text-main"
                  )}
                >
                  {choice}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
