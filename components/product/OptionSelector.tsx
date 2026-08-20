"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductOptionGroup } from "@/types";

type OptionSelectorProps = {
  options: ProductOptionGroup[];
};

export function OptionSelector({ options }: OptionSelectorProps) {
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((group) => [group.name, group.choices[0]]))
  );

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
                  onClick={() =>
                    setSelected((prev) => ({ ...prev, [group.name]: choice }))
                  }
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
