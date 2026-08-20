"use client";

import { useState } from "react";
import { answerInquiryAction } from "@/lib/actions/adminInquiries";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AdminInquiry } from "@/types/admin";

const STATUS_LABEL: Record<AdminInquiry["status"], string> = { PENDING: "답변대기", ANSWERED: "답변완료", HIDDEN: "숨김" };

export function InquiryAnswerRow({ inquiry }: { inquiry: AdminInquiry }) {
  const [status, setStatus] = useState(inquiry.status);
  const [answer, setAnswer] = useState(inquiry.answer ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    const result = await answerInquiryAction(inquiry.id, answer);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStatus("ANSWERED");
    setEditing(false);
  }

  return (
    <tr className="border-b border-border last:border-b-0 align-top">
      <td className="px-3 py-2 text-text-main">{inquiry.productNameKo}</td>
      <td className="px-3 py-2 text-text-secondary">{inquiry.authorName}</td>
      <td className="px-3 py-2 text-text-main">
        <p>{inquiry.question}</p>
        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={2}
              className="border border-border px-2 py-1.5 text-sm outline-none"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={handleSave} disabled={pending} className="h-8 bg-primary px-3 text-xs font-bold text-white disabled:bg-border">
                {pending ? "저장 중..." : "저장"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-8 border border-border px-3 text-xs text-text-secondary">
                취소
              </button>
            </div>
          </div>
        ) : (
          answer && <p className="mt-2 bg-primary-light p-2 text-xs text-text-secondary">{answer}</p>
        )}
      </td>
      <td className="px-3 py-2 text-text-secondary">{new Date(inquiry.createdAt).toLocaleDateString("ko-KR")}</td>
      <td className="px-3 py-2">
        <StatusBadge label={STATUS_LABEL[status]} tone={status === "ANSWERED" ? "primary" : "default"} />
      </td>
      <td className="px-3 py-2">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-primary underline">
            {status === "ANSWERED" ? "답변수정" : "답변작성"}
          </button>
        )}
      </td>
    </tr>
  );
}
