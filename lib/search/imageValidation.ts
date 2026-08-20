/**
 * Upload guardrails for the image-search input (STEP 12 spec section 31) —
 * MIME type, extension, and size checked before the file is used for
 * anything, and independently of the /search/image page's dev-only gate.
 * These search-time uploads are never written to Storage or mixed into the
 * product_images bucket; see lib/imageSearch/providers/mock.ts.
 *
 * Returns an error code rather than a message string (STEP 13) — the caller
 * resolves it to locale-aware text via messages.search.*.
 */
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export type ImageValidationErrorCode = "INVALID_TYPE" | "INVALID_EXTENSION" | "TOO_LARGE";

export type ImageValidationResult = { ok: true } | { ok: false; code: ImageValidationErrorCode };

export function validateSearchImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, code: "INVALID_TYPE" };
  }
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return { ok: false, code: "INVALID_EXTENSION" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, code: "TOO_LARGE" };
  }
  return { ok: true };
}
