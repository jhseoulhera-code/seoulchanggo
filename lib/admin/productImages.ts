/**
 * STEP 18 spec section 6 — image upload limits, kept as constants (not
 * inlined) so the client-side pre-upload check in ImageUploadManager.tsx and
 * the STEP 18 migration's storage.buckets hardening
 * (20260905000200_step18_product_variants.sql) describe the exact same
 * numbers rather than risking drift between a comment and the real bucket
 * config. Real enforcement is the Storage bucket's own
 * file_size_limit/allowed_mime_types (a client check can always be bypassed
 * by calling the Storage API directly) — this module's isAllowedImageFile
 * is purely a fail-fast UX check.
 */

export const PRODUCT_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const PRODUCT_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const PRODUCT_IMAGE_MAX_COUNT = 10;

export type ImageValidationResult = { ok: true } | { ok: false; error: string };

export function validateProductImageFile(file: { type: string; size: number }): ImageValidationResult {
  if (!PRODUCT_IMAGE_ALLOWED_MIME_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: "jpg, png, webp 형식의 이미지만 업로드할 수 있습니다." };
  }
  if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
    return { ok: false, error: "이미지 1개당 최대 10MB까지 업로드할 수 있습니다." };
  }
  return { ok: true };
}
