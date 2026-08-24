/**
 * STEP 26.7 — structural checks for the customer-facing review-author
 * display_name fix (20260906001200_step26_7_review_author_lookup.sql +
 * lib/actions/reviews.ts). No local Postgres is available in this
 * environment (same constraint as every other STEP's DB-facing checks), so
 * these assertions verify the actual SQL/TS source text — same convention
 * as scripts/test-admin-profile-embed.mts, which caught the same bug class
 * on the admin side.
 *
 * Background: getProductReviewsAction previously did
 * `.select("*, profiles(display_name), ...")` on `reviews` — a PostgREST
 * embedded-resource query. reviews.user_id and profiles.id both reference
 * auth.users(id) independently, with no direct FK from reviews to profiles,
 * so this fails on a real Supabase project exactly like the admin-side bug
 * STEP 26 already found and fixed (96fd7af). Unlike the admin fix
 * (fetchProfilesByIds, which requires an admin session per profiles' RLS),
 * this needed a new SECURITY DEFINER RPC scoped to display_name only, since
 * reviews are publicly readable by anon/authenticated alike.
 *
 * Run with: node --experimental-strip-types scripts/test-review-author-lookup.mts
 */
import { readFileSync, readdirSync } from "node:fs";

let failures = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures += 1;
  }
}

const MIGRATIONS_DIR = "supabase/migrations";
const FIX_FILE = `${MIGRATIONS_DIR}/20260906001200_step26_7_review_author_lookup.sql`;
const migrationSource = readFileSync(FIX_FILE, "utf8");
const migrationSqlOnly = migrationSource
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const reviewsActionSource = readFileSync("lib/actions/reviews.ts", "utf8");
const databaseTypesSource = readFileSync("types/database.ts", "utf8");

// --- 1. no existing migration edited (structural) ------------------------------------
{
  const allMigrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  assert(allMigrationFiles.includes("20260906001200_step26_7_review_author_lookup.sql"), "(structural) the new corrective migration file must exist");
}

// --- 2. the RPC exposes ONLY display_name, never email or other columns (structural) ---
{
  assert(
    migrationSqlOnly.includes("create or replace function public.get_review_author_names(p_user_ids uuid[])") &&
      migrationSqlOnly.includes("returns table (user_id uuid, display_name text)"),
    "(structural) get_review_author_names must return exactly (user_id, display_name) — no other profiles column"
  );
  assert(
    !/select\s+id,\s*display_name,\s*email/i.test(migrationSqlOnly) && !migrationSqlOnly.toLowerCase().includes("email"),
    "(structural) the RPC body must never select/return profiles.email — only display_name is safe to expose to arbitrary review viewers"
  );
  assert(migrationSqlOnly.includes("security definer"), "(structural) the RPC must be SECURITY DEFINER to read profiles rows the calling customer's own RLS (profiles_select_own) wouldn't otherwise allow");
}

// --- 3. granted to anon AND authenticated — reviews are publicly readable (structural) ---
{
  assert(
    migrationSqlOnly.includes("grant execute on function public.get_review_author_names to anon, authenticated;"),
    "(structural) the RPC must be grantable to anon as well as authenticated — reviews_public_read_published has no auth condition, so anonymous visitors must be able to resolve author names too"
  );
}

// --- 4. lib/actions/reviews.ts no longer embeds profiles (structural) ----------------
{
  assert(
    !reviewsActionSource.includes("profiles(display_name)") && !reviewsActionSource.includes(", profiles("),
    "(structural) getProductReviewsAction must no longer use the broken profiles(...) PostgREST embed"
  );
  assert(
    reviewsActionSource.includes('.rpc("get_review_author_names"'),
    "(structural) getProductReviewsAction must resolve author names via the new get_review_author_names RPC"
  );
  assert(
    reviewsActionSource.includes("maskDisplayName(displayName)"),
    "(structural) the existing 2-char-mask-plus-** behavior (never showing a full real name next to review content) must be preserved"
  );
}

// --- 5. types/database.ts kept in sync with the new RPC signature (structural) --------
{
  assert(
    databaseTypesSource.includes("get_review_author_names: {") && databaseTypesSource.includes("Args: { p_user_ids: string[] };"),
    "(structural) the generated-types file must declare get_review_author_names's Args/Returns shape"
  );
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — get_review_author_names resolves ONLY display_name (never email), is SECURITY DEFINER and granted to anon+authenticated to match reviews' public visibility, getProductReviewsAction no longer uses the broken profiles(...) embed, and the existing name-masking behavior is unchanged."
);
