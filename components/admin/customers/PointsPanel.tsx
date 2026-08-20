"use client";

import { useState } from "react";
import { adjustPointsAction } from "@/lib/actions/adminPoints";
import type { AdminPointTransaction } from "@/types/admin";

const TYPE_LABEL: Record<AdminPointTransaction["type"], string> = {
  EARN: "적립",
  USE: "사용",
  CANCEL_EARN: "적립취소",
  REFUND: "환불",
  ADMIN_ADJUST: "관리자 조정",
};

export function PointsPanel({ userId, balance, history }: { userId: string; balance: number; history: AdminPointTransaction[] }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAdjust() {
    const numericAmount = Number(amount);
    if (!numericAmount) {
      setError("조정할 포인트 수치를 입력해주세요. (음수 가능)");
      return;
    }
    if (!reason.trim()) {
      setError("조정 사유를 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await adjustPointsAction(userId, numericAmount, reason.trim());
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount("");
    setReason("");
    setMessage("저장되었습니다.");
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-main">포인트</h2>
        <span className="text-lg font-bold text-primary">{balance.toLocaleString("ko-KR")}P</span>
      </div>

      <div className="flex flex-wrap items-end gap-2 border border-border p-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          조정 수치 (양수: 적립, 음수: 차감)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-40 border border-border px-2 py-1.5 text-sm outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          사유(필수)
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-64 border border-border px-2 py-1.5 text-sm outline-none" />
        </label>
        <button
          type="button"
          onClick={handleAdjust}
          disabled={pending}
          className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
        >
          조정
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-primary">{message}</p>}

      {history.length === 0 ? (
        <p className="border border-border p-4 text-sm text-text-secondary">포인트 내역이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
              <tr>
                <th className="px-3 py-2">일시</th>
                <th className="px-3 py-2">구분</th>
                <th className="px-3 py-2">변동</th>
                <th className="px-3 py-2">잔액</th>
                <th className="px-3 py-2">사유</th>
              </tr>
            </thead>
            <tbody>
              {history.map((tx) => (
                <tr key={tx.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-secondary">{new Date(tx.createdAt).toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2 text-text-secondary">{TYPE_LABEL[tx.type]}</td>
                  <td className={`px-3 py-2 font-medium ${tx.amount >= 0 ? "text-primary" : "text-red-600"}`}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-text-main">{tx.balanceAfter.toLocaleString("ko-KR")}</td>
                  <td className="px-3 py-2 text-text-secondary">{tx.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
