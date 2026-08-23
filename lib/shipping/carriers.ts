// Relative-import-free, pure — Node-testable like the rest of lib/shipping/.
// STEP 25 spec sections 16/17 — no real carrier API is connected yet; an
// admin picks/types a carrier CODE (never a display string) so this list
// can grow without touching any DB column (shipping_groups.carrier stays a
// plain text column storing the code) or any UI beyond this one file.

export type CarrierCode =
  | "CJ_LOGISTICS"
  | "HANJIN"
  | "LOTTE"
  | "EPOST"
  | "LOGEN"
  | "DHL"
  | "FEDEX"
  | "UPS"
  | "EMS"
  | "OTHER";

export const CARRIER_LABEL: Record<CarrierCode, string> = {
  CJ_LOGISTICS: "CJ대한통운",
  HANJIN: "한진택배",
  LOTTE: "롯데택배",
  EPOST: "우체국택배",
  LOGEN: "로젠택배",
  DHL: "DHL",
  FEDEX: "FedEx",
  UPS: "UPS",
  EMS: "EMS",
  OTHER: "기타",
};

/** Offered for domestic shipping groups. */
export const DOMESTIC_CARRIERS: CarrierCode[] = ["CJ_LOGISTICS", "HANJIN", "LOTTE", "EPOST", "LOGEN", "OTHER"];

/** Offered for overseas-direct and overseas-agency groups — both cross a border before reaching the customer. */
export const INTERNATIONAL_CARRIERS: CarrierCode[] = ["DHL", "FEDEX", "UPS", "EMS", "OTHER"];

const ALL_CARRIER_CODES = new Set<string>([...DOMESTIC_CARRIERS, ...INTERNATIONAL_CARRIERS]);

export function isValidCarrierCode(value: string): value is CarrierCode {
  return ALL_CARRIER_CODES.has(value);
}

/** Falls back to the raw stored value for a carrier code this list doesn't (yet) recognize, rather than hiding it. */
export function carrierLabel(code: string | null): string {
  if (!code) return "-";
  return isValidCarrierCode(code) ? CARRIER_LABEL[code] : code;
}
