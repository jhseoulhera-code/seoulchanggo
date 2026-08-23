/**
 * STEP 17 spec section 9 — what's logged is deliberately narrow: admin
 * user id, which AI function ran, which provider handled it, latency, and
 * success/fail. Never the prompt, never the supplier text, never an API
 * key, never anything PII-shaped. console.error/console.log only — this
 * app has no external log sink to worry about leaking into.
 */
export function logAiCall(input: {
  adminId: string;
  functionType: string;
  provider: string;
  latencyMs: number;
  success: boolean;
}): void {
  console.log(
    `[ai/${input.functionType}] admin=${input.adminId} provider=${input.provider} latency_ms=${input.latencyMs} success=${input.success}`
  );
}
