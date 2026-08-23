// Relative + .ts-extensioned imports only (none needed here) — this file is
// deliberately NOT "server-only" marked, unlike the rest of lib/payments/,
// so scripts/test-payment-webhook-recovery.mts can import it directly under
// plain Node to construct/verify signatures the same way
// lib/payments/providers/mock.ts does at runtime, and so both share exactly
// one implementation instead of the test re-deriving its own HMAC logic.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * STEP 24 spec section 32 — server-only secret, never NEXT_PUBLIC_. This has
 * no real security value (MOCK never faces a real attacker), but exercising
 * an actual HMAC compare here is what makes "invalid signature rejected" a
 * genuinely testable scenario against the webhook route (STEP 24 spec
 * section 34), rather than MOCK's webhook always trivially verifying.
 */
export const MOCK_WEBHOOK_SECRET = process.env.MOCK_WEBHOOK_SECRET ?? "mock-dev-webhook-secret";

export function computeMockWebhookSignature(rawBody: string, secret: string = MOCK_WEBHOOK_SECRET): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyMockWebhookSignature(rawBody: string, providedSignature: string | undefined, secret: string = MOCK_WEBHOOK_SECRET): boolean {
  if (!providedSignature) return false;
  const expected = computeMockWebhookSignature(rawBody, secret);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
