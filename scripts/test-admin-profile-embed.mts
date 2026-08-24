/**
 * STEP 26 hotfix — on the real Supabase Cloud project (after `db push`ing
 * every STEP17-26 migration), several admin repositories broke with real
 * PostgREST errors that never surfaced against this sandbox's mocked/
 * structural tests:
 *
 *   [admin/orders] listAdminOrders failed:
 *     Could not find a relationship between 'orders' and 'profiles' in the schema cache
 *   [admin/dashboard] getAdminRecentOrders failed:
 *     Could not find a relationship between 'orders' and 'profiles' in the schema cache
 *   [admin/reviews] listAdminReviews failed:
 *     Could not embed because more than one relationship was found for 'reviews' and 'profiles'
 *
 * Root cause: orders.user_id (and reviews.user_id) reference auth.users(id)
 * directly — profiles.id ALSO references auth.users(id), but there is no
 * foreign key directly between orders/reviews and profiles that PostgREST's
 * embedded-resource syntax (`.select("*, profiles(...)")`) can resolve.
 * The fix replaces every such embed with a separate, explicit
 * fetchProfilesByIds() lookup (lib/repositories/admin/profiles.ts) — no FK
 * required, no embedding ambiguity possible, no RLS/security change. This
 * script is a structural regression guard so the same embed never creeps
 * back in.
 *
 * Run with: node --experimental-strip-types scripts/test-admin-profile-embed.mts
 */
import { readFileSync } from "node:fs";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const profilesHelperSource = readFileSync(new URL("../lib/repositories/admin/profiles.ts", import.meta.url), "utf8");
const ordersRepoSource = readFileSync(new URL("../lib/repositories/admin/orders.ts", import.meta.url), "utf8");
const dashboardRepoSource = readFileSync(new URL("../lib/repositories/admin/dashboard.ts", import.meta.url), "utf8");
const customersRepoSource = readFileSync(new URL("../lib/repositories/admin/customers.ts", import.meta.url), "utf8");
const reviewsRepoSource = readFileSync(new URL("../lib/repositories/admin/reviews.ts", import.meta.url), "utf8");

// --- 1. shared helper exists and never embeds — a plain keyed lookup only ---------------
{
  assert(
    profilesHelperSource.includes("export async function fetchProfilesByIds") && profilesHelperSource.includes('.from("profiles")') && profilesHelperSource.includes('.in("id", uniqueIds)'),
    "(structural) fetchProfilesByIds must exist and resolve profiles via a plain .in('id', ...) query, never an embedded-resource select"
  );
  assert(profilesHelperSource.includes('import "server-only"'), "(structural) the shared profile-lookup helper must be server-only");
}

// --- 2. admin/orders.ts: no embedded profiles() anywhere (list + detail) ----------------------
{
  assert(!/[,\s]profiles\(display_name/.test(ordersRepoSource), "(structural) lib/repositories/admin/orders.ts must never embed profiles(display_name...) — orders.user_id has no FK to profiles");
  assert(
    ordersRepoSource.includes('import { fetchProfilesByIds } from "@/lib/repositories/admin/profiles"'),
    "(structural) listAdminOrders/getAdminOrderDetail must resolve customer name/email via fetchProfilesByIds"
  );
  assert(
    (ordersRepoSource.match(/fetchProfilesByIds\(supabase,/g) ?? []).length >= 2,
    "(structural) both listAdminOrders and getAdminOrderDetail must call fetchProfilesByIds"
  );
}

// --- 3. admin/dashboard.ts: no embedded profiles() ----------------------------------------------
{
  assert(!/[,\s]profiles\(display_name/.test(dashboardRepoSource), "(structural) lib/repositories/admin/dashboard.ts must never embed profiles(display_name...)");
  assert(
    dashboardRepoSource.includes('import { fetchProfilesByIds } from "@/lib/repositories/admin/profiles"'),
    "(structural) getAdminRecentOrders must resolve customer name/email via fetchProfilesByIds"
  );
}

// --- 4. admin/customers.ts: no embedded profiles() (redundant — profile already known) ---------
{
  assert(!/[,\s]profiles\(display_name/.test(customersRepoSource), "(structural) lib/repositories/admin/customers.ts must never embed profiles(display_name...)");
  assert(
    customersRepoSource.includes("customerName: profile.display_name,") && customersRepoSource.includes("customerEmail: profile.email,"),
    "(structural) getAdminCustomerDetail must use the already-fetched single profile row directly — every order in the list belongs to the SAME customer, so no per-row lookup is needed at all"
  );
}

// --- 5. admin/reviews.ts: no embedded profiles() (was the ambiguous-relationship case) ----------
{
  assert(!/profiles\(/.test(reviewsRepoSource), "(structural) lib/repositories/admin/reviews.ts must never embed profiles(...)");
  assert(
    reviewsRepoSource.includes('import { fetchProfilesByIds } from "@/lib/repositories/admin/profiles"'),
    "(structural) listAdminReviews must resolve author display name via fetchProfilesByIds"
  );
  // The products(name_ko) embed is untouched — only the ambiguous profiles embed was ever broken.
  assert(reviewsRepoSource.includes('.select("*, products(name_ko)")'), "(structural) the unrelated products(name_ko) embed must remain unchanged");
}

// --- 6. guest orders (user_id null) never crash the lookup, always fall back cleanly ------------
{
  assert(
    ordersRepoSource.includes('(row.user_id && profileMap.get(row.user_id)?.displayName) ?? "비회원"'),
    "(structural) a null user_id (guest order) must short-circuit to the guest fallback, never call profileMap.get(null)"
  );
  assert(
    dashboardRepoSource.includes('(row.user_id && profileMap.get(row.user_id)?.displayName) ?? "비회원"'),
    "(structural) getAdminRecentOrders must apply the same guest-safe fallback"
  );
  assert(
    profilesHelperSource.includes("userIds.filter((id): id is string => id !== null)"),
    "(structural) fetchProfilesByIds itself must filter out null ids before querying, so a guest order's null user_id is never passed to .in()"
  );
}

// --- 7. no RLS/migration changed by this hotfix (per the task's explicit constraint) -------------
{
  const step25MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000600_step25_admin_order_fulfillment.sql", import.meta.url), "utf8");
  const step26MigrationSource = readFileSync(new URL("../supabase/migrations/20260906000700_step26_refunds.sql", import.meta.url), "utf8");
  assert(
    step25MigrationSource.includes("create policy order_status_history_admin_read_all") && step26MigrationSource.includes("create policy payment_refund_items_admin_read_all"),
    "(structural) existing RLS policies from STEP25/26 must remain completely untouched by this hotfix — this is a pure TypeScript query-shape fix, no new migration"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — no admin repository embeds profiles(...) via a nonexistent/ambiguous PostgREST relationship anymore; orders/dashboard/customers/reviews all resolve customer/author names via the shared fetchProfilesByIds() lookup, guest orders fall back safely, and no RLS/migration was touched."
);
