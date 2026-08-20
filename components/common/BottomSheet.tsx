"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full flex-col bg-white md:max-w-md md:border md:border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-text-main">{title}</h3>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
