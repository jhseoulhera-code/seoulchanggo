import { CartPageClient } from "@/components/cart/CartPageClient";
import { getAllProducts } from "@/lib/repositories/products";

export default async function CartPage() {
  const products = await getAllProducts();
  return <CartPageClient products={products} />;
}
