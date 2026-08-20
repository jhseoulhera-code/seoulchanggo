"use client";

import { cn } from "@/lib/utils";
import type { AuthProvider } from "@/types/auth";

/** Brand colors are a legitimate one-off outside the design system tokens — these identify third-party providers, not app UI. */
const PROVIDER_STYLE: Record<AuthProvider, string> = {
  KAKAO: "bg-[#FEE500] text-[#191919]",
  NAVER: "bg-[#03C75A] text-white",
  GOOGLE: "border border-border bg-white text-text-main",
  EMAIL: "border border-primary text-primary",
};

type SocialLoginButtonProps = {
  provider: AuthProvider;
  label: string;
  onClick: () => void;
};

export function SocialLoginButton({ provider, label, onClick }: SocialLoginButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-12 w-full items-center justify-center text-sm font-bold", PROVIDER_STYLE[provider])}
    >
      {label}
    </button>
  );
}
