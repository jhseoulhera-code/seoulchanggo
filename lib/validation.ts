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
