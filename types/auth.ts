import type { CountryCode, LocaleCode } from "@/types/market";

/** Add a new provider here (e.g. "APPLE") when it's ready to launch. */
export type AuthProvider = "EMAIL" | "GOOGLE" | "KAKAO" | "NAVER";

export type SocialAuthProvider = Exclude<AuthProvider, "EMAIL">;

/**
 * Shaped to map cleanly onto a future Supabase Auth user + profile row.
 * Never carries a password or any server-issued token.
 */
export type User = {
  id: string;
  email: string;
  displayName: string;
  authProvider: AuthProvider;
  locale: LocaleCode;
  market: CountryCode;
  createdAt: string;
};
