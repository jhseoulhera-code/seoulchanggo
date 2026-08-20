"use client";

import { useState } from "react";
import { FormField } from "@/components/common/FormField";
import { isValidEmail, isValidPassword } from "@/lib/validation";
import { getMessages } from "@/messages";
import type { Market } from "@/types/market";

type EmailLoginFormProps = {
  market: Market;
  onSubmit: (input: { email: string }) => void;
};

/** Mock-only: there is no real server auth yet, so a well-formed email/password pair is enough to sign in. */
export function EmailLoginForm({ market, onSubmit }: EmailLoginFormProps) {
  const messages = getMessages(market.locale);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function handleSubmit() {
    const nextErrors: { email?: string; password?: string } = {};
    if (!isValidEmail(email)) nextErrors.email = messages.auth.invalidEmail;
    if (!isValidPassword(password)) nextErrors.password = messages.auth.invalidPassword;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit({ email });
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField label={messages.auth.email} value={email} onChange={setEmail} error={errors.email} type="email" />
      <FormField
        label={messages.auth.password}
        value={password}
        onChange={setPassword}
        error={errors.password}
        type="password"
      />
      <button type="button" onClick={handleSubmit} className="mt-1 h-12 bg-primary text-sm font-bold text-white">
        {messages.auth.signIn}
      </button>
    </div>
  );
}
