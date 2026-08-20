import type { CountryCode } from "@/types/market";
import type { SocialAuthProvider } from "@/types/auth";

/** Social login options offered per market, in display order. Add a market's row here to extend. */
export const SOCIAL_PROVIDERS_BY_MARKET: Record<CountryCode, SocialAuthProvider[]> = {
  KR: ["KAKAO", "NAVER", "GOOGLE"],
  IN: ["GOOGLE"],
};
