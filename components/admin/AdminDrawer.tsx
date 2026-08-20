"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type AdminDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Left-sliding nav drawer for tablet/mobile admin. Portal-rendered so it always
 * stacks above the page regardless of any ancestor's own stacking context —
 * the same fix BottomSheet needed for the customer app's MarketSelector. */
export function AdminDrawer({ open, onClose, children }: AdminDrawerProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" role="presentation" onClick={onClose} />
      <div className="relative flex h-full w-64 flex-col bg-white">{children}</div>
    </div>,
    document.body
  );
}
