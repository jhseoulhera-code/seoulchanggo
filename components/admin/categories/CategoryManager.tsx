"use client";

import { useState } from "react";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/adminCategories";
import type { AdminCategory } from "@/types/admin";

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoryManager({ categories }: { categories: AdminCategory[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold text-text-main">카테고리 관리</h2>
      <CategoryTable categories={categories} />
      <AddCategoryForm categories={categories} />
    </section>
  );
}

function CategoryTable({ categories }: { categories: AdminCategory[] }) {
  const nameById = new Map(categories.map((c) => [c.id, c.nameKo]));

  return (
    <div className="overflow-x-auto border border-border">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-b border-border bg-primary-light/40 text-xs text-text-secondary">
          <tr>
            <th className="px-3 py-2">이름(한글)</th>
            <th className="px-3 py-2">이름(영문)</th>
            <th className="px-3 py-2">상위 카테고리</th>
            <th className="px-3 py-2">레벨</th>
            <th className="px-3 py-2">정렬순서</th>
            <th className="px-3 py-2">노출</th>
            <th className="px-3 py-2">HOME 노출</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} parentName={category.parentId ? nameById.get(category.parentId) ?? "-" : "-"} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoryRow({ category, parentName }: { category: AdminCategory; parentName: string }) {
  const [nameKo, setNameKo] = useState(category.nameKo);
  const [nameEn, setNameEn] = useState(category.nameEn);
  const [sortOrder, setSortOrder] = useState(String(category.sortOrder));
  const [isVisible, setIsVisible] = useState(category.isVisible);
  const [showOnHome, setShowOnHome] = useState(category.showOnHome);
  const [saving, setSaving] = useState(false);

  async function save(patch: Parameters<typeof updateCategoryAction>[1]) {
    setSaving(true);
    await updateCategoryAction(category.id, patch);
    setSaving(false);
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2" style={{ paddingLeft: `${12 + (category.level - 1) * 16}px` }}>
        <input
          value={nameKo}
          onChange={(e) => setNameKo(e.target.value)}
          onBlur={() => nameKo !== category.nameKo && save({ nameKo })}
          disabled={saving}
          className="w-32 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          onBlur={() => nameEn !== category.nameEn && save({ nameEn })}
          disabled={saving}
          className="w-32 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2 text-text-secondary">{parentName}</td>
      <td className="px-3 py-2 text-text-secondary">{category.level}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          onBlur={() => Number(sortOrder) !== category.sortOrder && save({ sortOrder: Number(sortOrder) || 0 })}
          disabled={saving}
          className="w-16 border border-border px-2 py-1 text-sm outline-none"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={isVisible}
          onChange={(e) => {
            setIsVisible(e.target.checked);
            void save({ isVisible: e.target.checked });
          }}
          disabled={saving}
          className="h-4 w-4 accent-primary"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={showOnHome}
          onChange={(e) => {
            setShowOnHome(e.target.checked);
            void save({ showOnHome: e.target.checked });
          }}
          disabled={saving}
          className="h-4 w-4 accent-primary"
        />
      </td>
    </tr>
  );
}

function AddCategoryForm({ categories }: { categories: AdminCategory[] }) {
  const [nameKo, setNameKo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [parentId, setParentId] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [showOnHome, setShowOnHome] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parent = categories.find((c) => c.id === parentId) ?? null;
  const level = parent ? parent.level + 1 : 1;
  const levelBlocked = level > 3;

  async function handleAdd() {
    if (!nameKo.trim()) {
      setError("한글 이름을 입력해주세요.");
      return;
    }
    if (levelBlocked) {
      setError("카테고리는 최대 3단계까지만 생성할 수 있습니다.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await createCategoryAction({
      slug: slugify(nameKo),
      nameKo,
      nameEn: nameEn || nameKo,
      parentId: parentId || null,
      level,
      sortOrder: categories.filter((c) => c.parentId === (parentId || null)).length,
      isVisible,
      showOnHome,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNameKo("");
    setNameEn("");
    setParentId("");
  }

  return (
    <div className="flex flex-wrap items-end gap-2 border border-border p-3">
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        이름(한글)
        <input value={nameKo} onChange={(e) => setNameKo(e.target.value)} className="w-36 border border-border px-2 py-1.5 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        이름(영문)
        <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="w-36 border border-border px-2 py-1.5 text-sm outline-none" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        상위 카테고리
        <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-40 border border-border px-2 py-1.5 text-sm outline-none">
          <option value="">(최상위)</option>
          {categories
            .filter((c) => c.level < 3)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {"　".repeat(c.level - 1)}
                {c.nameKo}
              </option>
            ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs text-text-secondary">
        <input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} className="h-4 w-4 accent-primary" />
        노출
      </label>
      <label className="flex items-center gap-1.5 text-xs text-text-secondary">
        <input type="checkbox" checked={showOnHome} onChange={(e) => setShowOnHome(e.target.checked)} className="h-4 w-4 accent-primary" />
        HOME 노출
      </label>
      <button
        type="button"
        onClick={handleAdd}
        disabled={pending}
        className="h-[34px] bg-primary px-4 text-sm font-bold text-white disabled:bg-border"
      >
        추가
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
