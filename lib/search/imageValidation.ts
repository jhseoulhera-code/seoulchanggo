/**
 * Upload guardrails for the image-search input (STEP 12 spec section 31) —
 * MIME type, extension, and size checked before the file is used for
 * anything, and independently of the /search/image page's dev-only gate.
 * These search-time uploads are never written to Storage or mixed into the
 * product_images bucket; see lib/imageSearch/providers/mock.ts.
 */
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export type ImageValidationResult = { ok: true } | { ok: false; error: string };

export function validateSearchImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: "JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다." };
  }
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return { ok: false, error: "지원하지 않는 파일 확장자입니다." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "이미지 용량은 8MB 이하여야 합니다." };
  }
  return { ok: true };
}
