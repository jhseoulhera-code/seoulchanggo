"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { duplicateProductAction } from "@/lib/actions/adminProducts";

export function DuplicateProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const result = await duplicateProductAction(productId);
    setPending(false);
    if (!result.ok) {
      window.alert(result.error);
      return;
    }
    router.push(`/admin/products/${result.data.id}/edit`);
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className="text-text-secondary underline disabled:opacity-50">
      {pending ? "복제 중..." : "복제"}
    </button>
  );
}
