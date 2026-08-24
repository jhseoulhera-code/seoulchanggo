// STEP 26.5 — structural checks for the integration-audit corrective
// migration (20260906001000_step26_5_integration_audit_fixes.sql). No local
// Postgres is available in this environment, so these checks verify the SQL
// text itself: every revoked function name is a real function defined
// somewhere in the migration history (catches typos that would otherwise
// only surface as a failed `supabase db push`), every function this project
// calls via supabase.rpc() from a service-role-only route is covered, and no
// pre-existing migration file was edited.
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

let failures = 0;
function assert(condition: boolean, message: string) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

const MIGRATIONS_DIR = "supabase/migrations";
const FIX_FILE = `${MIGRATIONS_DIR}/20260906001000_step26_5_integration_audit_fixes.sql`;
const fixSource = readFileSync(FIX_FILE, "utf8");
// Strip `--` comment lines before checking for actual SQL statements below —
// the file's own prose comments mention "revoke"/"service_role" by name to
// explain the fix, which would otherwise false-positive against a naive
// substring/regex check of the raw file.
const fixSqlOnly = fixSource
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const allMigrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
const allMigrationSource = allMigrationFiles
  .map((f) => readFileSync(`${MIGRATIONS_DIR}/${f}`, "utf8"))
  .join("\n");

const REVOKED_FUNCTIONS = [
  "process_webhook_payment_event",
  "_apply_payment_result",
  "_check_order_access",
  "_compute_coupon_discount",
  "_is_valid_payment_method_for_market",
  "_cancel_unpaid_order_core",
  "cart_owner_key",
  "auto_cancel_stale_orders",
];

// 1. Every function this migration revokes execute from must actually be
// defined somewhere (catches a typo'd function name, which would otherwise
// only fail at `supabase db push` time against a real project).
for (const name of REVOKED_FUNCTIONS) {
  assert(
    new RegExp(`create (or replace )?function public\\.${name}\\s*\\(`).test(allMigrationSource),
    `(structural) revoked function "${name}" must be a real function defined in some migration — check for a typo`
  );
  assert(
    fixSqlOnly.includes(`revoke execute on function public.${name} from public, anon, authenticated;`),
    `(structural) the corrective migration must revoke execute on "${name}" from public, anon, authenticated`
  );
}

// 2. service_role/postgres must never be revoked — the webhook route and the
// internal cron route both use createServiceRoleClient() and must keep working.
assert(
  !/revoke execute[^;]*service_role/i.test(fixSqlOnly) && !/revoke execute[^;]*\bpostgres\b/i.test(fixSqlOnly),
  "(structural) the corrective migration must never revoke execute from service_role or postgres — that would break the webhook and cron routes, which use the service-role client"
);

// 3. Both routes that legitimately call these RPCs must use the service-role
// client, not the anon/authenticated client — otherwise this fix would break them.
const webhookRouteSource = readFileSync("app/api/webhooks/payments/[provider]/route.ts", "utf8");
assert(
  webhookRouteSource.includes("createServiceRoleClient()") &&
    webhookRouteSource.includes('supabase.rpc("process_webhook_payment_event"'),
  "(structural) the webhook route must call process_webhook_payment_event via the service-role client, which retains execute access after this migration"
);

const cronRouteSource = readFileSync("app/api/internal/cancel-stale-orders/route.ts", "utf8");
assert(
  cronRouteSource.includes("createServiceRoleClient()") &&
    cronRouteSource.includes('supabase.rpc("auto_cancel_stale_orders"'),
  "(structural) the internal cron route must call auto_cancel_stale_orders via the service-role client, which retains execute access after this migration"
);

// 4. Confirm no app/lib code calls any of the revoked functions through the
// anon/authenticated Supabase client (the browser or server "createClient()"
// helper) — if it did, this fix would break a real feature.
const grepResult = execSync(
  `grep -rn '\\.rpc("_\\|\\.rpc(.*process_webhook_payment_event\\|\\.rpc(.*auto_cancel_stale_orders' app lib --include="*.ts" --include="*.tsx" || true`,
  { encoding: "utf8" }
);
const rpcCallLines = grepResult.trim().split("\n").filter(Boolean);
assert(
  rpcCallLines.every((line) => line.includes("route.ts")),
  "(structural) every RPC call to a now-revoked function must live in a route.ts file (the two service-role-only routes checked above), not in a client-reachable action/component"
);
assert(rpcCallLines.length === 2, "(structural) exactly two call sites are expected for the now-revoked RPC functions (webhook route + cron route) — a new call site elsewhere would need this fix's safety analysis re-checked");

// 5. No pre-existing migration file was edited — this fix must be purely additive.
const gitDiffNames = execSync("git diff --name-only HEAD -- supabase/migrations", { encoding: "utf8" }).trim();
const modifiedMigrations = gitDiffNames.split("\n").filter(Boolean);
assert(
  modifiedMigrations.length === 0,
  `(structural) no existing migration file may be modified by this fix — found modified: ${modifiedMigrations.join(", ")}`
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log(
  "OK — STEP 26.5 corrective migration revokes execute on the webhook/cron/internal-helper functions Supabase's default privileges had silently exposed to anon/authenticated, without touching service_role access, existing migrations, or any legitimate call site."
);
