"use client";

import Link from "next/link";
import { useState } from "react";
import { FormField } from "@/components/common/FormField";
import { findMockUserByEmail } from "@/lib/auth";
import { isNonEmpty, isValidEmail, isValidPassword } from "@/lib/validation";
import { getMessages } from "@/messages";
import type { Market } from "@/types/market";

type EmailSignupFormProps = {
  market: Market;
  onSubmit: (input: { displayName: string; email: string; marketingOptIn: boolean }) => void;
};

type FieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreement?: string;
};

/** Password never leaves this component — only email/displayName/marketingOptIn are forwarded to the caller. */
export function EmailSignupForm({ market, onSubmit }: EmailSignupFormProps) {
  const messages = getMessages(market.locale);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const allAgreed = agreeTerms && agreePrivacy && agreeMarketing;

  function toggleAgreeAll(checked: boolean) {
    setAgreeTerms(checked);
    setAgreePrivacy(checked);
    setAgreeMarketing(checked);
  }

  function handleSubmit() {
    const nextErrors: FieldErrors = {};
    if (!isNonEmpty(displayName)) nextErrors.displayName = messages.auth.nameRequired;
    if (!isValidEmail(email)) nextErrors.email = messages.auth.invalidEmail;
    else if (findMockUserByEmail(email)) nextErrors.email = messages.auth.duplicateEmail;
    if (!isValidPassword(password)) nextErrors.password = messages.auth.invalidPassword;
    if (password !== confirmPassword) nextErrors.confirmPassword = messages.auth.passwordMismatch;
    if (!agreeTerms || !agreePrivacy) nextErrors.agreement = messages.auth.termsRequired;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit({ displayName, email, marketingOptIn: agreeMarketing });
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField label={messages.auth.name} value={displayName} onChange={setDisplayName} error={errors.displayName} />
      <FormField label={messages.auth.email} value={email} onChange={setEmail} error={errors.email} type="email" />
      <FormField
        label={messages.auth.password}
        value={password}
        onChange={setPassword}
        error={errors.password}
        type="password"
      />
      <FormField
        label={messages.auth.confirmPassword}
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={errors.confirmPassword}
        type="password"
      />

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-2.5 text-sm font-bold text-text-main">
          <input
            type="checkbox"
            checked={allAgreed}
            onChange={(event) => toggleAgreeAll(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {messages.auth.agreeAll}
        </label>
        <div className="flex items-center justify-between gap-2.5 pl-0.5 text-sm text-text-secondary">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(event) => setAgreeTerms(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {messages.auth.agreeTerms}
          </label>
          <Link href="/legal/terms" className="shrink-0 text-xs underline">
            {messages.auth.viewDetails}
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2.5 pl-0.5 text-sm text-text-secondary">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={agreePrivacy}
              onChange={(event) => setAgreePrivacy(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            {messages.auth.agreePrivacy}
          </label>
          <Link href="/legal/privacy" className="shrink-0 text-xs underline">
            {messages.auth.viewDetails}
          </Link>
        </div>
        <label className="flex items-center gap-2.5 pl-0.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={agreeMarketing}
            onChange={(event) => setAgreeMarketing(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {messages.auth.agreeMarketing}
        </label>
        {errors.agreement && <span className="text-xs text-red-600">{errors.agreement}</span>}
      </div>

      <button type="button" onClick={handleSubmit} className="mt-1 h-12 bg-primary text-sm font-bold text-white">
        {messages.auth.signUp}
      </button>
    </div>
  );
}
