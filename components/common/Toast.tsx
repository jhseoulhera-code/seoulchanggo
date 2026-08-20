"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export type ToastState = {
  message: string;
  tone: "success" | "error";
  actionHref?: string;
  actionLabel?: string;
};

type ToastProps = {
  toast: ToastState | null;
};

export function Toast({ toast }: ToastProps) {
  if (!toast) return null;

  const Icon = toast.tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 border border-text-main bg-text-main px-4 py-3 text-white shadow-none md:bottom-6">
      <div className="flex items-center gap-2 text-sm">
        <Icon size={16} className="shrink-0" />
        <span>{toast.message}</span>
      </div>
      {toast.actionHref && toast.actionLabel && (
        <Link href={toast.actionHref} className="shrink-0 text-sm font-bold underline">
          {toast.actionLabel}
        </Link>
      )}
    </div>
  );
}
