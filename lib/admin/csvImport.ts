/**
 * STEP 16 spec section 5 — Bulk Product Import, minimum viable version:
 * CSV only for now (xlsx is a drop-in extension of parseCsv()'s output
 * shape — CsvRow[] — once needed, without touching validateCsvRows()).
 *
 * Pure, dependency-free, and Supabase-free on purpose: this whole module
 * is unit-testable with plain Node (see scripts/test-csv-import.mts) and
 * runs the same way client-side (Wizard preview) and server-side (the
 * import Server Action re-validates instead of trusting the browser).
 */

export const CSV_REQUIRED_COLUMNS = [
  "sku",
  "name_ko",
  "name_en",
  "category",
  "supply_type",
  "shipping_method",
  "price_krw",
  "price_inr",
  "price_usd",
  "stock_mode",
  "stock_quantity",
] as const;

export type CsvColumn = (typeof CSV_REQUIRED_COLUMNS)[number];

const SUPPLY_TYPES = new Set(["DOMESTIC_STOCK", "OVERSEAS_DIRECT", "OVERSEAS_AGENCY"]);
const STOCK_MODES = new Set(["TRACKED", "UNLIMITED"]);

/** category column values a caller can resolve against — usually every admin category's slug. */
export type CsvCategoryLookup = Map<string, string>; // slug -> id

export type CsvShippingResolution = { shippingType: "DOMESTIC" | "OVERSEAS_DIRECT" | "OVERSEAS_AGENCY"; defaultShippingMethod: "SEA" | "AIR" | null };

/**
 * shipping_method in the CSV uses the same three labels Step 3 of the
 * Wizard shows (DOMESTIC_PARCEL/OVERSEAS_SEA/OVERSEAS_AIR) rather than the
 * raw shipping_type_enum values, since that's what an operator filling out
 * a spreadsheet actually recognizes. OVERSEAS_SEA/AIR both resolve to
 * shipping_type=OVERSEAS_DIRECT (the CSV has no separate column for the
 * OVERSEAS_AGENCY case — an operator importing agency-fulfilled products
 * in bulk should use the Wizard directly, where that distinction has its
 * own explicit field).
 */
function resolveShippingMethod(value: string): CsvShippingResolution | null {
  switch (value.trim().toUpperCase()) {
    case "DOMESTIC_PARCEL":
      return { shippingType: "DOMESTIC", defaultShippingMethod: null };
    case "OVERSEAS_SEA":
      return { shippingType: "OVERSEAS_DIRECT", defaultShippingMethod: "SEA" };
    case "OVERSEAS_AIR":
      return { shippingType: "OVERSEAS_DIRECT", defaultShippingMethod: "AIR" };
    default:
      return null;
  }
}

/** RFC4180-ish parser: handles quoted fields, escaped `""`, and commas/newlines inside quotes. No external dependency. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export function buildCsvTemplate(): string {
  const header = CSV_REQUIRED_COLUMNS.join(",");
  const example = [
    "SKU-EXAMPLE-1",
    "예시 상품명",
    "Example Product",
    "kitchen",
    "DOMESTIC_STOCK",
    "DOMESTIC_PARCEL",
    "29900",
    "",
    "",
    "TRACKED",
    "10",
  ].join(",");
  return `${header}\n${example}\n`;
}

export type CsvValidatedRow = {
  rowNumber: number; // 1-based, header excluded (row 1 = first data row)
  raw: Record<string, string>;
  errors: string[];
  parsed: {
    sku: string;
    nameKo: string;
    nameEn: string;
    categoryId: string;
    supplyType: "DOMESTIC_STOCK" | "OVERSEAS_DIRECT" | "OVERSEAS_AGENCY";
    shipping: CsvShippingResolution;
    priceKrw: number;
    priceInr: number;
    priceUsd: number;
    stockMode: "TRACKED" | "UNLIMITED";
    stockQuantity: number;
  } | null;
};

function parseOptionalPrice(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export function validateCsvRows(header: string[], dataRows: string[][], categoriesBySlug: CsvCategoryLookup): CsvValidatedRow[] {
  const normalizedHeader = header.map((h) => h.trim().toLowerCase());
  const missingColumns = CSV_REQUIRED_COLUMNS.filter((col) => !normalizedHeader.includes(col));

  return dataRows.map((cells, index) => {
    const raw: Record<string, string> = {};
    normalizedHeader.forEach((col, i) => {
      raw[col] = (cells[i] ?? "").trim();
    });

    const errors: string[] = [];
    if (missingColumns.length > 0) {
      errors.push(`헤더에 필수 컬럼이 없습니다: ${missingColumns.join(", ")}`);
      return { rowNumber: index + 1, raw, errors, parsed: null };
    }

    if (!raw.sku) errors.push("sku가 비어 있습니다.");
    if (!raw.name_ko) errors.push("name_ko가 비어 있습니다.");

    const categoryId = categoriesBySlug.get(raw.category?.toLowerCase());
    if (!raw.category) errors.push("category가 비어 있습니다.");
    else if (!categoryId) errors.push(`category "${raw.category}"에 해당하는 카테고리를 찾을 수 없습니다.`);

    if (!SUPPLY_TYPES.has(raw.supply_type)) {
      errors.push(`supply_type은 ${[...SUPPLY_TYPES].join("/")} 중 하나여야 합니다.`);
    }

    const shipping = resolveShippingMethod(raw.shipping_method ?? "");
    if (!shipping) errors.push("shipping_method는 DOMESTIC_PARCEL/OVERSEAS_SEA/OVERSEAS_AIR 중 하나여야 합니다.");

    const priceKrw = parseOptionalPrice(raw.price_krw ?? "");
    const priceInr = parseOptionalPrice(raw.price_inr ?? "");
    const priceUsd = parseOptionalPrice(raw.price_usd ?? "");
    if (Number.isNaN(priceKrw) || Number.isNaN(priceInr) || Number.isNaN(priceUsd)) {
      errors.push("가격 값은 0 이상의 숫자여야 합니다.");
    } else if (priceKrw <= 0 && priceInr <= 0 && priceUsd <= 0) {
      errors.push("price_krw/price_inr/price_usd 중 최소 1개는 0보다 커야 합니다.");
    }

    if (!STOCK_MODES.has(raw.stock_mode)) {
      errors.push(`stock_mode는 ${[...STOCK_MODES].join("/")} 중 하나여야 합니다.`);
    }
    const stockQuantity = Number(raw.stock_quantity || "0");
    if (raw.stock_mode === "TRACKED" && (!Number.isFinite(stockQuantity) || stockQuantity <= 0)) {
      errors.push("stock_mode가 TRACKED이면 stock_quantity는 0보다 커야 합니다.");
    }

    if (errors.length > 0 || !shipping || !categoryId) {
      return { rowNumber: index + 1, raw, errors, parsed: null };
    }

    return {
      rowNumber: index + 1,
      raw,
      errors: [],
      parsed: {
        sku: raw.sku,
        nameKo: raw.name_ko,
        nameEn: raw.name_en ?? "",
        categoryId,
        supplyType: raw.supply_type as "DOMESTIC_STOCK" | "OVERSEAS_DIRECT" | "OVERSEAS_AGENCY",
        shipping,
        priceKrw,
        priceInr,
        priceUsd,
        stockMode: raw.stock_mode as "TRACKED" | "UNLIMITED",
        stockQuantity,
      },
    };
  });
}
