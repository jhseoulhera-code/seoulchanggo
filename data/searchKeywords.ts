export type StaticSearchKeyword = { id: string; keyword: string; type: "POPULAR" | "RECOMMENDED" };

/**
 * Mock-mode stand-in for the admin-managed search_keywords table (STEP 12
 * spec section 9 — no fake real-time ranking; this is the same
 * "administrator decides the list" curation the real table holds, just
 * static since there's no DB to manage it in when Supabase isn't configured.
 */
export const staticSearchKeywords: StaticSearchKeyword[] = [
  { id: "sk-popular-1", keyword: "텀블러", type: "POPULAR" },
  { id: "sk-popular-2", keyword: "유아 물티슈", type: "POPULAR" },
  { id: "sk-popular-3", keyword: "무선 이어폰", type: "POPULAR" },
  { id: "sk-popular-4", keyword: "캠핑 의자", type: "POPULAR" },
  { id: "sk-popular-5", keyword: "강아지 사료", type: "POPULAR" },
  { id: "sk-recommended-1", keyword: "가을 신상", type: "RECOMMENDED" },
  { id: "sk-recommended-2", keyword: "주방 정리용품", type: "RECOMMENDED" },
  { id: "sk-recommended-3", keyword: "차량용 방향제", type: "RECOMMENDED" },
];
