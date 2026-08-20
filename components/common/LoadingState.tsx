import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-text-secondary">
      <Loader2 size={28} className="animate-spin" />
    </div>
  );
}
