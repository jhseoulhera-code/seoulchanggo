"use client";

import { useState } from "react";
import { setReviewStatusAction } from "@/lib/actions/adminReviews";

export function ReviewStatusButton({ id, status }: { id: string; status: "PUBLISHED" | "HIDDEN" | "REPORTED" }) {
  const [current, setCurrent] = useState(status);
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = current === "HIDDEN" ? "PUBLISHED" : "HIDDEN";
    setPending(true);
    const result = await setReviewStatusAction(id, next);
    setPending(false);
    if (result.ok) setCurrent(next);
  }

  return (
    <button type="button" onClick={toggle} disabled={pending} className="text-xs text-primary underline disabled:opacity-50">
      {current === "HIDDEN" ? "복구" : "숨김"}
    </button>
  );
}
