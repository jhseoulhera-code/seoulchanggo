import { Suspense } from "react";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";
import { getAllProducts } from "@/lib/repositories/products";

export default async function CheckoutPage() {
  const products = await getAllProducts();
  return (
    <Suspense fallback={null}>
      <CheckoutClient products={products} />
    </Suspense>
  );
}
