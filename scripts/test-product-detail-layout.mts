/**
 * STEP 26.7 — structural checks for the product detail page's
 * Presentation-layer redesign (sticky right purchase panel on desktop,
 * continuous-scroll detail sections replacing the old click-to-swap tabs,
 * a same-category related-products section). Framework-free, same
 * convention as every other scripts/test-*.mts file — no live DOM/browser
 * available in this environment, so these assertions verify the actual
 * JSX/class source text.
 *
 * Run with: node --experimental-strip-types scripts/test-product-detail-layout.mts
 */
import { readFileSync, existsSync } from "node:fs";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const pageSource = readFileSync("app/product/[id]/page.tsx", "utf8");
const sectionsSource = readFileSync("components/product/ProductDetailSections.tsx", "utf8");
const gallerySource = readFileSync("components/product/ProductGallery.tsx", "utf8");
const purchasePanelSource = readFileSync("components/product/ProductPurchasePanel.tsx", "utf8");
const purchaseActionsSource = readFileSync("components/product/PurchaseActions.tsx", "utf8");
const layoutSource = readFileSync("app/layout.tsx", "utf8");
const koMessagesSource = readFileSync("messages/ko.ts", "utf8");
const enMessagesSource = readFileSync("messages/en.ts", "utf8");

// --- 1. DetailTabs fully retired, replaced by ProductDetailSections (structural) ---
{
  assert(!existsSync("components/product/DetailTabs.tsx"), "(structural) the old click-to-swap DetailTabs.tsx must be removed, not left alongside its replacement");
  assert(
    pageSource.includes('import { ProductDetailSections } from "@/components/product/ProductDetailSections"') &&
      !pageSource.includes("DetailTabs"),
    "(structural) the product detail page must import and use ProductDetailSections, with no remaining DetailTabs reference"
  );
}

// --- 2. right purchase column is sticky, spans both rows, not stretched (structural) ---
{
  const rightColumnMatch = pageSource.match(/<div className="[^"]*md:sticky[^"]*">\s*<ProductPurchasePanel/);
  assert(rightColumnMatch !== null, "(structural) the ProductPurchasePanel wrapper must carry md:sticky");
  const rightColumnClass = rightColumnMatch?.[0] ?? "";
  assert(rightColumnClass.includes("md:self-start"), "(structural) the sticky column must be md:self-start — a grid item defaults to stretching to its full row/area height, which would leave sticky no room to move");
  assert(rightColumnClass.includes("md:top-"), "(structural) the sticky column must declare an explicit md:top offset so it doesn't sit under the sticky DetailHeader");
  assert(
    rightColumnClass.includes("md:row-span-2"),
    "(structural) the sticky column must span both grid rows (md:row-span-2) so its containing block covers the FULL left-column height (Gallery + Sections combined) — without this, sticky would only have room to travel across the Gallery's own row, not the whole page"
  );
  assert(
    rightColumnClass.includes("md:overflow-y-auto") && rightColumnClass.includes("md:max-h-"),
    "(structural) the sticky column must cap its own height and scroll internally, so a purchase panel taller than the viewport (e.g. many variant options) stays reachable instead of being clipped off-screen"
  );
}

// --- 3. left column blocks are NOT their own scroll container (structural) ----------
{
  const galleryColumnMatch = pageSource.match(/<div className="[^"]*md:row-start-1[^"]*">/);
  const sectionsColumnMatch = pageSource.match(/<div className="[^"]*md:row-start-2[^"]*">/);
  assert(galleryColumnMatch !== null && sectionsColumnMatch !== null, "(structural) the Gallery and Sections grid cells must exist with the expected row-placement classes");
  for (const match of [galleryColumnMatch, sectionsColumnMatch]) {
    const cls = match?.[0] ?? "";
    assert(
      !cls.includes("overflow-y-auto") && !cls.includes("overflow-auto"),
      "(structural) the left content cells must NOT be their own scroll container — the page itself must scroll normally, only the right column is position:sticky"
    );
  }
}

// --- 4. desktop is a 2-column CSS grid, roughly 64-65/35-36 split (structural) -------
{
  assert(pageSource.includes("grid grid-cols-1") && pageSource.includes("md:items-start"), "(structural) the layout must be a single-column grid on mobile with items-start on desktop (never the default stretch)");
  assert(
    /md:grid-cols-\[6[0-9]%_1fr\]/.test(pageSource),
    "(structural) the left column must be an explicit ~62-69% track with the right column as the 1fr remainder — an explicit percentage on BOTH tracks would overflow once gap is added (grid, unlike flex, doesn't auto-shrink tracks to fit)"
  );
  assert(pageSource.includes("md:col-start-1") && pageSource.includes("md:col-start-2"), "(structural) Gallery/Sections must be pinned to column 1 and Purchase to column 2 via explicit grid placement");
}

// --- 5. mobile stacks single-column in Gallery -> Purchase -> Sections DOM order -----
{
  const galleryIdx = pageSource.indexOf("<ProductGallery");
  const purchaseIdx = pageSource.indexOf("<ProductPurchasePanel");
  const sectionsIdx = pageSource.indexOf("<ProductDetailSections");
  assert(
    galleryIdx !== -1 && purchaseIdx !== -1 && sectionsIdx !== -1 && galleryIdx < purchaseIdx && purchaseIdx < sectionsIdx,
    "(structural) DOM order must be Gallery, then ProductPurchasePanel, then ProductDetailSections — mobile (grid-cols-1, no explicit placement) simply stacks grid items in DOM order, so this is what actually determines the mobile visual order. Getting this wrong (e.g. nesting Sections inside the same cell as Gallery) pushes the whole purchase panel below all the detail/review/inquiry content on mobile."
  );
}

// --- 6. ProductPurchasePanel itself is untouched business logic (regression guard) ---
{
  assert(
    purchasePanelSource.includes("resolveSellPrice({ product, variant: matchedVariant, market })"),
    "(structural) ProductPurchasePanel must still resolve variant pricing through the shared resolveSellPrice (STEP 26.6) — this STEP must not reintroduce duplicate pricing logic"
  );
  assert(
    purchasePanelSource.includes("cart.addItem(product.dbId, variant?.id ?? null, quantity)"),
    "(structural) ProductPurchasePanel's cart action must be unchanged — STEP 26.7 is presentation-only"
  );
  // The mobile fixed-bottom CTA bar and the desktop inline CTA are already
  // mutually exclusive by breakpoint (PurchaseActions.tsx) — confirms no
  // double-CTA is introduced by wrapping the panel in a sticky column.
  assert(
    purchaseActionsSource.includes('"fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background md:hidden"') &&
      purchaseActionsSource.includes('"hidden md:block"'),
    "(structural) the fixed mobile CTA bar and the inline desktop CTA must remain mutually exclusive by breakpoint — otherwise the new sticky desktop panel would duplicate the fixed mobile bar's CTA"
  );
}

// --- 7. ProductDetailSections renders every section unconditionally (structural) ----
{
  assert(
    !/activeTab ===/.test(sectionsSource) && !sectionsSource.includes("useState"),
    "(structural) sections must render continuously (no active-tab state/conditional swapping) — the whole point of the redesign is a single scrollable flow, not a re-skinned tab switcher"
  );
  for (const [id, component] of [
    ["info", "<ProductInfoTab"],
    ["review", "<ReviewsTab"],
    ["shipping", "<ShippingExchangeTab"],
    ["inquiry", "<InquiryTab"],
  ]) {
    assert(sectionsSource.includes(`id="${id}"`), `(structural) a #${id} anchor section must exist for anchor-nav navigation`);
    assert(sectionsSource.includes(component), `(structural) the #${id} section must render ${component}, reusing the existing content component unchanged`);
  }
  assert(
    (sectionsSource.match(/href={`#\$\{section\.id\}`}/g) ?? []).length === 1,
    "(structural) the anchor nav must link to each section via a real #anchor href (not a click-handler-only tab switcher)"
  );
}

// --- 8. related products reuse the existing category listing (structural) -----------
{
  assert(
    pageSource.includes("getProductsByCategory(product.category)"),
    "(structural) related products must be fetched via the existing getProductsByCategory — no new recommendation engine introduced"
  );
  assert(
    pageSource.includes("candidate.id !== product.id"),
    "(structural) the related-products list must exclude the current product itself"
  );
  assert(
    sectionsSource.includes("<ProductGrid products={relatedProducts} />"),
    "(structural) related products must render through the existing ProductGrid/ProductCard, not a new grid implementation"
  );
}

// --- 9. gallery still handles the 0/1/many image cases without layout breakage ------
{
  assert(
    gallerySource.includes("slides.length === 0") && gallerySource.includes("ProductImagePlaceholder"),
    "(structural) a product with zero images must still render the placeholder, not a broken empty gallery"
  );
  assert(
    gallerySource.includes("slides.length > 1") && gallerySource.includes("onClick={() => setActiveIndex(index)}"),
    "(structural) the thumbnail strip (and its click-to-select behavior) must still exist for multi-image products"
  );
  assert(
    gallerySource.includes('alt={displayName}') && gallerySource.includes("aria-label={t(messages.a11y.viewImageAt"),
    "(structural) image alt text and thumbnail aria-labels must be preserved"
  );
}

// --- 10. anchor scrolling doesn't hide content behind the sticky header (structural) --
{
  assert(
    (sectionsSource.match(/scroll-mt-/g) ?? []).length >= 4,
    "(structural) every anchor-target section must declare a scroll-margin-top so jumping to it doesn't tuck the heading under the sticky DetailHeader/anchor-nav"
  );
  assert(layoutSource.includes("scroll-smooth"), "(structural) the root html element should enable smooth scrolling for anchor-nav jumps");
}

// --- 11. new i18n keys exist in both locales (check-i18n covers key-set parity) -----
{
  assert(
    koMessagesSource.includes("relatedProductsHeading:") && enMessagesSource.includes("relatedProductsHeading:"),
    "(structural) relatedProductsHeading must exist in both ko.ts and en.ts"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — sticky (non-stretched, height-capped) desktop purchase column, a normally-scrolling left column, continuous (non-tabbed) detail sections with anchor nav, a reused-category related-products section, gallery 0/1/many-image handling, and ProductPurchasePanel/PurchaseActions business-logic non-regression checks passed."
);
