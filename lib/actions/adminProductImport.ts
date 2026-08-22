"use server";

import { checkAdminAccess } from "@/lib/repositories/admin/guard";
import { listAdminCategories } from "@/lib/repositories/admin/categories";
import { emptyAdminProductDraft, upsertAdminProduct } from "@/lib/repositories/admin/products";
import { CSV_REQUIRED_COLUMNS, validateCsvRows, type CsvCategoryLookup } from "@/lib/admin/csvImport";
import type { AdminProductDetail } from "@/types/admin";

export type BulkImportRowResult = { rowNumber: number; sku: string; ok: boolean; error?: string; productId?: string };

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * STEP 16 spec section 5's hard rule: "잘못된 행은 바로 DB insert 하지 말고
 * preview/validation 후 사용자가 확정해야 저장" — this re-runs the exact
 * same validateCsvRows() the browser preview used, server-side, against a
 * freshly-fetched category list (never trusting the client's copy), so a
 * stale/tampered preview payload can't slip an invalid row through. Every
 * imported product starts as DRAFT — bulk import populates a starting
 * point, an admin still reviews/registers each one through the Wizard.
 */
export async function bulkImportProductsAction(header: string[], dataRows: string[][]): Promise<BulkImportRowResult[] | { ok: false; error: string }> {
  const access = await checkAdminAccess();
  if (access.status !== "ok") {
    return { ok: false, error: "관리자 권한이 필요합니다." };
  }

  const missing = CSV_REQUIRED_COLUMNS.filter((col) => !header.map((h) => h.trim().toLowerCase()).includes(col));
  if (missing.length > 0) {
    return { ok: false, error: `필수 컬럼이 없습니다: ${missing.join(", ")}` };
  }

  const categories = await listAdminCategories();
  const categoriesBySlug: CsvCategoryLookup = new Map(categories.map((c) => [c.slug.toLowerCase(), c.id]));
  const validated = validateCsvRows(header, dataRows, categoriesBySlug);

  const results: BulkImportRowResult[] = [];
  for (const row of validated) {
    if (!row.parsed) {
      results.push({ rowNumber: row.rowNumber, sku: row.raw.sku || "(알 수 없음)", ok: false, error: row.errors.join("; ") });
      continue;
    }

    const p = row.parsed;
    const suffix = `${Date.now().toString(36)}${row.rowNumber}`;
    const draft: AdminProductDetail = {
      ...emptyAdminProductDraft(),
      sku: p.sku,
      slug: `${slugify(p.nameKo)}-${suffix}`,
      nameKo: p.nameKo,
      nameEn: p.nameEn,
      categoryId: p.categoryId,
      supplyType: p.supplyType,
      shippingType: p.shipping.shippingType,
      defaultShippingMethod: p.shipping.defaultShippingMethod,
      stockType: p.stockMode,
      stockQuantity: p.stockQuantity,
      status: "DRAFT",
      isActive: false,
      prices: [
        { marketCode: "KR", currencyCode: "KRW", originalPrice: p.priceKrw, salePrice: p.priceKrw },
        { marketCode: "IN", currencyCode: "INR", originalPrice: p.priceInr, salePrice: p.priceInr },
        { marketCode: null, currencyCode: "USD", originalPrice: p.priceUsd, salePrice: p.priceUsd },
      ],
    };

    const result = await upsertAdminProduct(draft);
    if (!result.ok) {
      results.push({ rowNumber: row.rowNumber, sku: p.sku, ok: false, error: result.error });
    } else {
      results.push({ rowNumber: row.rowNumber, sku: p.sku, ok: true, productId: result.id });
    }
  }

  return results;
}
