import "server-only";

import type {
  CancelPaymentResult,
  ConfirmPaymentResult,
  CreatePaymentResult,
  ParsedWebhookEvent,
  PaymentProvider,
  PaymentProviderAdapter,
  RefundPaymentResult,
} from "@/lib/payments/types";

/**
 * Shared shape for the real-provider stubs (Korea/India/Global — STEP 11
 * spec sections 28-30). Every method fails clearly with NOT_CONFIGURED
 * rather than pretending to succeed; nothing here ever fabricates a
 * providerPaymentId or invents credentials. Fill in the real SDK calls once
 * actual merchant credentials exist — see .env.example for the variable
 * names each provider expects.
 */
export function createStubAdapter(provider: PaymentProvider, requiredEnvVars: string[]): PaymentProviderAdapter {
  const message = `${provider} is not connected yet — set ${requiredEnvVars.join(", ")} and implement its SDK calls before use.`;

  return {
    provider,
    async createPayment(): Promise<CreatePaymentResult> {
      return { ok: false, error: message };
    },
    async confirmPayment(): Promise<ConfirmPaymentResult> {
      return { ok: false, failureCode: "NOT_CONFIGURED", failureMessage: message };
    },
    async cancelPayment(): Promise<CancelPaymentResult> {
      return { ok: false, error: message };
    },
    async refundPayment(): Promise<RefundPaymentResult> {
      return { ok: false, error: message };
    },
    verifyWebhook(): boolean {
      return false;
    },
    parseWebhook(): ParsedWebhookEvent | null {
      return null;
    },
  };
}

export function isProviderConfigured(requiredEnvVars: string[]): boolean {
  return requiredEnvVars.every((name) => Boolean(process.env[name]));
}
