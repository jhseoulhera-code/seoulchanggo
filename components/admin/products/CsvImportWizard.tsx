"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { bulkImportProductsAction, type BulkImportRowResult } from "@/lib/actions/adminProductImport";
import { buildCsvTemplate, parseCsv, validateCsvRows, type CsvValidatedRow } from "@/lib/admin/csvImport";
import type { AdminCategory } from "@/types/admin";

type CsvImportWizardProps = { categories: AdminCategory[] };

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImportWizard({ categories }: CsvImportWizardProps) {
  const [header, setHeader] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvValidatedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<BulkImportRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoriesBySlug = new Map(categories.map((c) => [c.slug.toLowerCase(), c.id]));

  function handleFile(file: File) {
    setFileName(file.name);
    setResults(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError("빈 파일입니다.");
        return;
      }
      const [headerRow, ...dataRows] = parsed;
      setHeader(headerRow);
      setRows(validateCsvRows(headerRow, dataRows, categoriesBySlug));
    };
    reader.readAsText(file, "utf-8");
  }

  const validCount = rows.filter((r) => r.parsed !== null).length;
  const invalidCount = rows.length - validCount;

  async function handleConfirmImport() {
    setImporting(true);
    setError(null);
    const dataRows = rows.map((r) => header.map((h) => r.raw[h.trim().toLowerCase()] ?? ""));
    const result = await bulkImportProductsAction(header, dataRows);
    setImporting(false);
    if (!Array.isArray(result)) {
      setError(result.error);
      return;
    }
    setResults(result);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 border border-border p-4">
        <button
          type="button"
          onClick={() => downloadTextFile("product-import-template.csv", buildCsvTemplate(), "text/csv;charset=utf-8;")}
          className="flex items-center gap-1.5 border border-primary px-3 py-2 text-sm font-bold text-primary"
        >
          <Download size={14} />
          CSV 템플릿 다운로드
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 bg-primary px-3 py-2 text-sm font-bold text-white"
        >
          <Upload size={14} />
          CSV 업로드
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {fileName && <span className="text-xs text-text-secondary">{fileName}</span>}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {rows.length > 0 && !results && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-main">
            총 {rows.length}행 — 정상 {validCount}행 / 오류 {invalidCount}행. 정상 행만 DRAFT 상태로 등록됩니다.
          </p>
          <div className="overflow-x-auto border border-border">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2">행</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">상품명</th>
                  <th className="px-3 py-2">카테고리</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">오류</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className={`border-b border-border last:border-b-0 ${row.errors.length > 0 ? "bg-red-50" : ""}`}>
                    <td className="px-3 py-2 text-text-secondary">{row.rowNumber}</td>
                    <td className="px-3 py-2 text-text-main">{row.raw.sku}</td>
                    <td className="px-3 py-2 text-text-main">{row.raw.name_ko}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.raw.category}</td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0 ? (
                        <span className="text-red-600">오류</span>
                      ) : (
                        <span className="text-primary">정상</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-red-600">{row.errors.join(" / ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={importing || validCount === 0}
            className="h-11 w-fit bg-primary px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-border"
          >
            {importing ? "가져오는 중..." : `확정하고 ${validCount}개 상품 가져오기 (DRAFT)`}
          </button>
        </div>
      )}

      {results && (
        <div className="flex flex-col gap-2 border border-border p-4">
          <p className="text-sm font-bold text-text-main">
            가져오기 완료 — 성공 {results.filter((r) => r.ok).length}건 / 실패 {results.filter((r) => !r.ok).length}건
          </p>
          <ul className="flex flex-col gap-1 text-xs">
            {results.map((r) => (
              <li key={r.rowNumber} className={r.ok ? "text-primary" : "text-red-600"}>
                행 {r.rowNumber} ({r.sku}) — {r.ok ? "성공" : `실패: ${r.error}`}
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-secondary">
            가져온 상품은 모두 DRAFT 상태입니다. 상품관리 목록의 &ldquo;등록상태: 임시저장&rdquo; 필터로 확인 후 각 상품을 검토/등록해주세요.
          </p>
        </div>
      )}
    </div>
  );
}
