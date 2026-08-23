/**
 * STEP 17 spec section 8: "최소한의 rate limit 또는 usage guard." A plain
 * in-memory sliding window, keyed by caller (admin user id). This is
 * explicitly a best-effort cost/abuse guard, not a precise multi-instance
 * quota system — on a serverless deployment with multiple instances each
 * instance tracks its own counts, so the real ceiling is
 * (limit × instance count), not exactly `limit`. That's an acceptable
 * trade-off for "minimal" per the spec; a real quota would need a shared
 * store (e.g. a DB table or Redis), which is more than this step asks for.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxCalls: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count >= maxCalls) {
    return { allowed: false, retryAfterMs: windowMs - (now - bucket.windowStart) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
