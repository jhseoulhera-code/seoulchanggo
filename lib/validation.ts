export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidKrPhone(value: string): boolean {
  return /^01[016789]-?\d{3,4}-?\d{4}$/.test(value.trim());
}

export function isValidInPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value.replace(/[\s-]/g, ""));
}

export function isValidKrPostcode(value: string): boolean {
  return /^\d{5}$/.test(value.trim());
}

export function isValidInPincode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function isValidCustomsCode(value: string): boolean {
  return /^P\d{12}$/i.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

/**
 * STEP 25 spec section 18 — no specific carrier's tracking-number format is
 * enforced (that would need real carrier specs this project doesn't have);
 * only structural sanity: trimmed non-empty, a generous length cap, and no
 * control characters (which could otherwise corrupt admin UI rendering or
 * any future export).
 */
export function isValidTrackingNumber(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 40) return false;
  return !/[\x00-\x1f\x7f]/.test(trimmed);
}
