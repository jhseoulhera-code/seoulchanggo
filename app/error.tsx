"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled page error:", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertTriangle size={32} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
      <button
        type="button"
        onClick={reset}
        className="border border-primary px-4 py-2 text-sm font-bold text-primary"
      >
        다시 시도
      </button>
    </div>
  );
}
