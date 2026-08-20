"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/PageContainer";
import { Toast } from "@/components/common/Toast";
import type { ToastState } from "@/components/common/Toast";
import { ListHeader } from "@/components/layout/ListHeader";
import { EmailLoginForm } from "@/components/auth/EmailLoginForm";
import { EmailSignupForm } from "@/components/auth/EmailSignupForm";
import { SocialLoginButton } from "@/components/auth/SocialLoginButton";
import { useAuth } from "@/contexts/AuthContext";
import { useMarket } from "@/contexts/MarketContext";
import { SOCIAL_PROVIDERS_BY_MARKET } from "@/data/authProviders";
import { isSafeReturnTo } from "@/lib/auth";
import { getMessages, t } from "@/messages";
import type { Messages } from "@/messages";
import type { LoginResult, SignupResult } from "@/lib/authTypes";
import type { AuthProvider, SocialAuthProvider } from "@/types/auth";

const SOCIAL_DISPLAY_NAME: Record<SocialAuthProvider, string> = {
  GOOGLE: "Google",
  KAKAO: "카카오",
  NAVER: "네이버",
};

const PROVIDER_LABEL_KEY: Record<AuthProvider, keyof Messages["auth"]> = {
  GOOGLE: "continueWithGoogle",
  KAKAO: "continueWithKakao",
  NAVER: "continueWithNaver",
  EMAIL: "continueWithEmail",
};

type View = "providers" | "email-login" | "email-signup";

export function AuthClient() {
  const { market } = useMarket();
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const messages = getMessages(market.locale);

  const rawReturnTo = searchParams.get("returnTo");
  const returnTo = isSafeReturnTo(rawReturnTo) ? rawReturnTo : "/";

  const [view, setView] = useState<View>("providers");
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (auth.isReady && auth.isAuthenticated) {
      router.replace(returnTo);
    }
  }, [auth.isReady, auth.isAuthenticated, returnTo, router]);

  function showToast(next: ToastState) {
    setToast(next);
    window.setTimeout(() => setToast(null), 2600);
  }

  function handleProviderClick(provider: AuthProvider) {
    if (provider === "EMAIL") {
      setView("email-login");
      return;
    }
    showToast({ message: t(messages.auth.socialComingSoon, { provider: SOCIAL_DISPLAY_NAME[provider] }), tone: "success" });
  }

  async function handleLogin({ email, password }: { email: string; password: string }): Promise<LoginResult> {
    const result = await auth.login({ email, password });
    if (result.ok) {
      router.push(returnTo);
    }
    return result;
  }

  async function handleSignup({
    displayName,
    email,
    password,
    marketingOptIn,
  }: {
    displayName: string;
    email: string;
    password: string;
    marketingOptIn: boolean;
  }): Promise<SignupResult> {
    const result = await auth.signup({
      displayName,
      email,
      password,
      market: market.countryCode,
      locale: market.locale,
      marketingOptIn,
    });
    if (result.ok) {
      if (result.requiresEmailConfirmation) {
        showToast({ message: messages.auth.signupCheckEmail, tone: "success" });
      } else {
        router.push(returnTo);
      }
    }
    return result;
  }

  const providers: AuthProvider[] = [...SOCIAL_PROVIDERS_BY_MARKET[market.countryCode], "EMAIL"];

  return (
    <>
      <ListHeader title={messages.auth.pageTitle} hideCartIcon />
      <main className="pb-16">
        <PageContainer className="mx-auto flex max-w-sm flex-col gap-6 pt-8">
          {view === "providers" && (
            <div className="flex flex-col gap-2">
              {providers.map((provider) => (
                <SocialLoginButton
                  key={provider}
                  provider={provider}
                  label={messages.auth[PROVIDER_LABEL_KEY[provider]]}
                  onClick={() => handleProviderClick(provider)}
                />
              ))}
            </div>
          )}

          {view === "email-login" && (
            <div className="flex flex-col gap-4">
              <EmailLoginForm market={market} onSubmit={handleLogin} />
              <button
                type="button"
                onClick={() => setView("email-signup")}
                className="text-center text-sm text-text-secondary underline"
              >
                {messages.auth.switchToSignup}
              </button>
              <button
                type="button"
                onClick={() => setView("providers")}
                className="text-center text-xs text-text-secondary"
              >
                {messages.auth.backToProviders}
              </button>
            </div>
          )}

          {view === "email-signup" && (
            <div className="flex flex-col gap-4">
              <EmailSignupForm market={market} onSubmit={handleSignup} />
              <button
                type="button"
                onClick={() => setView("email-login")}
                className="text-center text-sm text-text-secondary underline"
              >
                {messages.auth.switchToLogin}
              </button>
              <button
                type="button"
                onClick={() => setView("providers")}
                className="text-center text-xs text-text-secondary"
              >
                {messages.auth.backToProviders}
              </button>
            </div>
          )}
        </PageContainer>
      </main>
      <Toast toast={toast} />
    </>
  );
}
