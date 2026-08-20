import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  tone?: "default" | "primary" | "warning";
};

const TONE_CLASS: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  default: "border-border text-text-secondary",
  primary: "border-primary text-primary",
  warning: "border-red-500 text-red-600",
};

export function StatusBadge({ label, tone = "default" }: StatusBadgeProps) {
  return (
    <span className={cn("inline-flex border px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone])}>{label}</span>
  );
}
