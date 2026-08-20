import { Suspense } from "react";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutClient />
    </Suspense>
  );
}
