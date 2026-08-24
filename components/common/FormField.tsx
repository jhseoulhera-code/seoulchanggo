"use client";

import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  optionalTag?: string;
  disabled?: boolean;
};

export function FormField({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  optionalTag,
  disabled,
}: FormFieldProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium text-text-secondary">
        {label}
        {optionalTag && <span className="ml-1 text-text-secondary">{optionalTag}</span>}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={cn(
          "border px-3 py-2.5 text-sm text-text-main outline-none disabled:cursor-not-allowed disabled:bg-primary-light/30 disabled:text-text-secondary",
          error ? "border-red-500" : "border-border"
        )}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
