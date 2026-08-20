import type { Product } from "@/types";
import type { LocaleCode } from "@/types/market";

export type ImageSearchProviderName = "MOCK" | "FUTURE_VISION_PROVIDER";

export type ImageSearchFileMeta = { fileName: string; fileSize: number; mimeType: string };

export type ImageSearchInput = { meta: ImageSearchFileMeta; locale: LocaleCode };

export type ImageSearchResultItem = { product: Product };

export type ImageSearchResult = {
  provider: ImageSearchProviderName;
  /** true whenever the result set is not a real image match — always true until a real Vision provider exists. */
  isFallback: boolean;
  /** User-facing, honest explanation of what the result actually is. Always shown alongside the items. */
  message: string;
  items: ImageSearchResultItem[];
};

/**
 * Common adapter shape every image-search provider implements (STEP 12 spec
 * section 13) — mirrors the Provider Adapter pattern from STEP 11's
 * lib/payments/types.ts so a real Vision provider can be dropped in later
 * without touching the calling code. FUTURE_VISION_PROVIDER is a placeholder
 * name only; no real vendor is decided in this step.
 */
export interface ImageSearchProviderAdapter {
  readonly name: ImageSearchProviderName;
  search(input: ImageSearchInput): Promise<ImageSearchResult>;
}
