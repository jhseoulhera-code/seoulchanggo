"use server";

import { resolveImageSearchProvider } from "@/lib/imageSearch/registry";
import type { ImageSearchFileMeta, ImageSearchResult } from "@/lib/imageSearch/types";

/**
 * Server-side entry point for the dev-only Mock image search (STEP 12 spec
 * sections 14, 21-30). This production check is deliberate defense-in-depth:
 * even though app/search/image/page.tsx already hides the upload UI in
 * production, this action refuses to run for real users too, so the Mock
 * can never "go live" just because a client somehow reaches it directly.
 */
export async function runImageSearchAction(meta: ImageSearchFileMeta): Promise<ImageSearchResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("이미지 검색 기능은 아직 제공되지 않습니다.");
  }
  const provider = resolveImageSearchProvider();
  return provider.search({ meta });
}
