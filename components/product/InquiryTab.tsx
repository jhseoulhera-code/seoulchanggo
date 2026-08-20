import { CornerDownRight } from "lucide-react";
import { inquiries } from "@/data/inquiries";
import { cn } from "@/lib/utils";

export function InquiryTab() {
  return (
    <div className="flex flex-col gap-4 py-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-main">
          상품문의 <span className="font-bold text-primary">{inquiries.length}</span>건
        </p>
        <button
          type="button"
          className="cursor-not-allowed border border-primary px-3 py-1.5 text-xs font-bold text-primary"
        >
          상품문의 작성
        </button>
      </div>

      <div className="flex flex-col">
        {inquiries.map((inquiry) => (
          <div key={inquiry.id} className="border-t border-border py-4 first:border-t-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-[10px] font-bold",
                  inquiry.status === "answered"
                    ? "border-primary bg-primary-light text-primary"
                    : "border-border text-text-secondary"
                )}
              >
                {inquiry.status === "answered" ? "답변완료" : "답변대기"}
              </span>
              <span className="text-xs text-text-secondary">{inquiry.date}</span>
            </div>
            <p className="mt-2 text-sm text-text-main">{inquiry.question}</p>
            <p className="mt-1 text-xs text-text-secondary">{inquiry.author}</p>

            {inquiry.answer && (
              <div className="mt-3 flex items-start gap-2 bg-primary-light p-3 text-xs leading-relaxed text-text-secondary">
                <CornerDownRight size={13} className="mt-0.5 shrink-0 text-primary" />
                <p>{inquiry.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
