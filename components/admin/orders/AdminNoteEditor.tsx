"use client";

import { useState } from "react";
import { setOrderNoteAction } from "@/lib/actions/adminOrders";

/** STEP 25 spec section 25 — internal-only; never rendered anywhere customer-facing. */
export function AdminNoteEditor({ orderId, initialNote }: { orderId: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await setOrderNoteAction(orderId, note);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <section className="border border-border p-3">
      <h2 className="mb-2 text-sm font-bold text-text-main">관리자 메모 (고객에게 노출되지 않음)</h2>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
        rows={3}
        className="w-full border border-border p-2 text-sm text-text-main outline-none"
        placeholder="운영 참고사항을 기록하세요."
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
        >
          {pending ? "저장 중..." : "메모 저장"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && !error && <p className="text-xs text-primary">저장되었습니다.</p>}
      </div>
    </section>
  );
}
