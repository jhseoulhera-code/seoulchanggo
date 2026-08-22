"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StepBasicInfo } from "@/components/admin/products/wizard/steps/StepBasicInfo";
import { StepMediaOptions } from "@/components/admin/products/wizard/steps/StepMediaOptions";
import { StepPricing } from "@/components/admin/products/wizard/steps/StepPricing";
import { StepReview } from "@/components/admin/products/wizard/steps/StepReview";
import { StepSupplyShipping } from "@/components/admin/products/wizard/steps/StepSupplyShipping";
import { StepIndicator, WIZARD_STEPS, type WizardStepKey } from "@/components/admin/products/wizard/StepIndicator";
import { validateProductForRegistration } from "@/components/admin/products/wizard/validation";
import { saveProductAction } from "@/lib/actions/adminProducts";
import type { AdminCategory, AdminProductDetail } from "@/types/admin";

type ProductWizardProps = {
  initialDetail: AdminProductDetail;
  categories: AdminCategory[];
  mode: "create" | "edit";
};

export function ProductWizard({ initialDetail, categories, mode }: ProductWizardProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdminProductDetail>(initialDetail);
  const [step, setStep] = useState<WizardStepKey>("basic");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function patch(next: Partial<AdminProductDetail>) {
    setDetail((prev) => ({ ...prev, ...next }));
  }

  async function persist(overrides?: Partial<AdminProductDetail>): Promise<AdminProductDetail | null> {
    setSaving(true);
    setMessage(null);
    const toSave = overrides ? { ...detail, ...overrides } : detail;
    const result = await saveProductAction(toSave);
    setSaving(false);

    if (!result.ok) {
      setMessage({ tone: "error", text: result.error });
      return null;
    }
    const saved = { ...toSave, id: result.data.id };
    setDetail(saved);
    return saved;
  }

  async function handleSaveDraft() {
    const saved = await persist();
    if (!saved) return;
    setMessage({ tone: "success", text: "임시저장되었습니다." });
    if (mode === "create") {
      router.replace(`/admin/products/${saved.id}/edit`);
    }
  }

  async function handleRegister() {
    const issues = validateProductForRegistration(detail);
    if (issues.length > 0) return;

    const saved = await persist({ status: "ACTIVE", isActive: true });
    if (!saved) return;
    setMessage({ tone: "success", text: mode === "edit" ? "수정 내용이 저장되었습니다." : "상품이 등록되었습니다." });
    router.push("/admin/products");
  }

  const currentIndex = WIZARD_STEPS.findIndex((s) => s.key === step);
  const reachable = WIZARD_STEPS.filter((s, index) => index <= currentIndex || Boolean(detail.id)).map((s) => s.key);

  function goToStep(next: WizardStepKey) {
    if (!reachable.includes(next)) return;
    setStep(next);
  }

  function goNext() {
    if (currentIndex < WIZARD_STEPS.length - 1) setStep(WIZARD_STEPS[currentIndex + 1].key);
  }
  function goPrev() {
    if (currentIndex > 0) setStep(WIZARD_STEPS[currentIndex - 1].key);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-text-main">{mode === "edit" ? "상품 수정" : "상품 등록"}</h1>
        {detail.id && <span className="text-xs text-text-secondary">임시저장됨 · ID {detail.id.slice(0, 8)}</span>}
      </div>

      <StepIndicator current={step} onSelect={goToStep} reachable={reachable} />

      <div className="pb-4">
        {step === "basic" && <StepBasicInfo detail={detail} categories={categories} onChange={patch} />}
        {step === "pricing" && <StepPricing detail={detail} onChange={patch} />}
        {step === "supply" && <StepSupplyShipping detail={detail} onChange={patch} />}
        {step === "media" && (
          <StepMediaOptions detail={detail} onChange={patch} onSaveDraft={handleSaveDraft} saving={saving} />
        )}
        {step === "review" && (
          <StepReview
            detail={detail}
            categories={categories}
            mode={mode}
            saving={saving}
            message={message}
            onSaveDraft={handleSaveDraft}
            onRegister={handleRegister}
          />
        )}
      </div>

      {step !== "review" && (
        <div className="sticky bottom-0 -mx-4 flex items-center justify-between border-t border-border bg-background px-4 py-3 md:-mx-6 md:px-6">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="border border-border px-4 py-2 text-sm font-bold text-text-main disabled:opacity-40"
          >
            이전
          </button>
          <div className="flex items-center gap-3">
            {message && (
              <span className={`text-xs ${message.tone === "success" ? "text-primary" : "text-red-600"}`}>{message.text}</span>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="border border-primary px-4 py-2 text-sm font-bold text-primary disabled:opacity-40"
            >
              임시저장
            </button>
            <button type="button" onClick={goNext} className="bg-primary px-5 py-2 text-sm font-bold text-white">
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
