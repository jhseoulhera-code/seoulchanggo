"use server";

import { resolveImageSearchProvider } from "@/lib/imageSearch/registry";
import { getMessages } from "@/messages";
import type { ImageSearchFileMeta, ImageSearchResult } from "@/lib/imageSearch/types";
import type { LocaleCode } from "@/types/market";

/**
 * Server-side entry point for the dev-only Mock image search (STEP 12 spec
 * sections 14, 21-30). This production check is deliberate defense-in-depth:
 * even though app/search/image/page.tsx already hides the upload UI in
 * production, this action refuses to run for real users too, so the Mock
 * can never "go live" just because a client somehow reaches it directly.
 */
export async function runImageSearchAction(meta: ImageSearchFileMeta, locale: LocaleCode): Promise<ImageSearchResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(getMessages(locale).search.imageSearchComingSoon);
  }
  const provider = resolveImageSearchProvider();
  return provider.search({ meta, locale });
}
