import { getNotices } from "@/lib/repositories/notices";
import { getCategories } from "@/lib/repositories/categories";
import { getAllProducts } from "@/lib/repositories/products";
import { getActivePromotionSlugs } from "@/lib/repositories/promotions";
import { getSiteUrl } from "@/lib/seo";
import type { MetadataRoute } from "next";

/**
 * STEP 14 production hardening (spec section 26) — only public, indexable
 * customer content: HOME, Category, Product, Promotion, Notice. Admin, Auth,
 * Cart, Checkout, MyPage are excluded here (and disallowed in app/robots.ts)
 * since they're either access-gated or per-visitor state, not content.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const [categories, products, notices, promotionSlugs] = await Promise.all([
    getCategories(),
    getAllProducts(),
    getNotices(),
    getActivePromotionSlugs(),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/search`, changeFrequency: "daily", priority: 0.5 },
    { url: `${siteUrl}/faq`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/notices`, changeFrequency: "daily", priority: 0.5 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/shipping-policy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/return-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/category/${category.id}`,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${siteUrl}/product/${product.id}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const promotionEntries: MetadataRoute.Sitemap = promotionSlugs.map((slug) => ({
    url: `${siteUrl}/promotion/${slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const noticeEntries: MetadataRoute.Sitemap = notices.map((notice) => ({
    url: `${siteUrl}/notices/${notice.id}`,
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries, ...promotionEntries, ...noticeEntries];
}
