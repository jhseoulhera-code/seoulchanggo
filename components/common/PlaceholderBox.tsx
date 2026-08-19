import { cn } from "@/lib/utils";

type PlaceholderBoxProps = {
  label: string;
  className?: string;
};

export function PlaceholderBox({ label, className }: PlaceholderBoxProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-dashed border-border bg-primary-light text-sm text-text-secondary",
        className
      )}
    >
      {label}
    </div>
  );
}
