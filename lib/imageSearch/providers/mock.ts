import { getBestProducts } from "@/lib/repositories/products";
import type { ImageSearchProviderAdapter, ImageSearchResult } from "@/lib/imageSearch/types";

/**
 * Dev-only stand-in for a real Vision-based image search (STEP 12 spec
 * sections 14, 21-30). Deliberately never inspects the uploaded image — no
 * embedding generation, no vision API call, per this step's explicit scope
 * ("실제 embedding 생성 금지"). Returns the same curated "BEST" set /search
 * and HOME already use, honestly framed as a fallback recommendation, never
 * as a real match. See lib/imageSearch/registry.ts and
 * lib/actions/imageSearch.ts for why this never runs in production.
 */
export const mockImageSearchProvider: ImageSearchProviderAdapter = {
  name: "MOCK",
  async search(): Promise<ImageSearchResult> {
    const products = await getBestProducts(12);
    return {
      provider: "MOCK",
      isFallback: true,
      message: "이미지 기반 검색은 아직 준비 중입니다. 지금은 인기 상품을 대신 보여드려요.",
      items: products.map((product) => ({ product })),
    };
  },
};
