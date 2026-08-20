import type { CountryCode, LocaleCode } from "@/types/market";
import type { User } from "@/types/auth";

/**
 * "loading" vs "ready" is deliberate: a plain `User | null` can't tell a genuinely
 * signed-out visitor apart from "haven't resolved the session yet" during hydration.
 * Consumers that redirect on being signed-out (e.g. /mypage) must wait for "ready" —
 * acting on "loading" would bounce an actually-signed-in user before the real
 * session loads, since a child component's effect can run before the provider's
 * own post-hydration correction. Shared by both the mock and Supabase backends
 * so contexts/AuthContext.tsx can treat them identically.
 */
export type AuthSnapshot = { status: "loading" } | { status: "ready"; user: User | null };

export const LOADING_SNAPSHOT: AuthSnapshot = { status: "loading" };

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = { ok: true } | { ok: false; error: "INVALID_CREDENTIALS" | "UNKNOWN" };

export type SignupInput = {
  displayName: string;
  email: string;
  password: string;
  market: CountryCode;
  locale: LocaleCode;
  marketingOptIn: boolean;
};

export type SignupResult =
  | { ok: true; requiresEmailConfirmation: boolean }
  | { ok: false; error: "DUPLICATE_EMAIL" | "UNKNOWN" };
