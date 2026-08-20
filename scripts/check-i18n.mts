/**
 * Defense-in-depth i18n key-parity check (STEP 13 spec section 6).
 *
 * ko.ts and en.ts are both typed as `Messages` (messages/index.ts), so
 * TypeScript already refuses to compile if either dictionary is missing a
 * key or has an extra one — `npx tsc --noEmit` is the primary guard, and it
 * runs on every change in this project. This script is a lightweight
 * runtime double-check with the same effect, useful for a quick manual run
 * or a CI step that doesn't already type-check the whole project.
 *
 * There is no flat "i18n.t('some.key')" lookup anywhere in this app (see
 * messages/index.ts's getMessages/t) — every read is a typed property
 * access, so a missing translation can never render as a raw key string in
 * the UI the way it can with string-keyed i18n libraries.
 *
 * Run with: node --experimental-strip-types scripts/check-i18n.mts
 * (A "MODULE_TYPELESS_PACKAGE_JSON" warning on stderr is expected and
 * harmless — this repo intentionally doesn't set "type" in package.json
 * since Next.js's own build tooling assumes CommonJS-by-default `.ts`
 * files; the warning doesn't affect this script's exit code.)
 */
import { ko } from "../messages/ko.ts";
import { en } from "../messages/en.ts";

function collectKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    collectKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

const koKeys = new Set(collectKeys(ko));
const enKeys = new Set(collectKeys(en));

const missingInEn = [...koKeys].filter((key) => !enKeys.has(key)).sort();
const missingInKo = [...enKeys].filter((key) => !koKeys.has(key)).sort();

if (missingInEn.length > 0 || missingInKo.length > 0) {
  if (missingInEn.length > 0) {
    console.error(`Missing in en.ts (${missingInEn.length}):`);
    missingInEn.forEach((key) => console.error(`  - ${key}`));
  }
  if (missingInKo.length > 0) {
    console.error(`Missing in ko.ts (${missingInKo.length}):`);
    missingInKo.forEach((key) => console.error(`  - ${key}`));
  }
  process.exit(1);
}

console.log(`OK — ${koKeys.size} keys match between ko.ts and en.ts.`);
