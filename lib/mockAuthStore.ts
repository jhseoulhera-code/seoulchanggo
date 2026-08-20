"use client";

import { clearSession, createMockUserId, findMockUserByEmail, getStoredSession, saveMockUser, saveSession } from "@/lib/auth";
import type { CountryCode, LocaleCode } from "@/types/market";
import type { User } from "@/types/auth";
import type { AuthSnapshot, LoginInput, LoginResult, SignupInput, SignupResult } from "@/lib/authTypes";
import { LOADING_SNAPSHOT } from "@/lib/authTypes";

/**
 * Dev-only fallback used while Supabase isn't configured (see lib/supabase/config.ts).
 * Mirrors the Cart/Market external-store pattern: module-level state + a listener set,
 * read through useSyncExternalStore for hydration-safe access.
 */
let readySnapshot: AuthSnapshot = { status: "ready", user: null };
let currentUser: User | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  currentUser = getStoredSession();
  readySnapshot = { status: "ready", user: currentUser };
  initialized = true;
}

function setSessionUser(user: User | null) {
  currentUser = user;
  readySnapshot = { status: "ready", user };
  if (user) {
    saveSession(user);
  } else {
    clearSession();
  }
  listeners.forEach((listener) => listener());
}

export function mockSubscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function mockGetSnapshot(): AuthSnapshot {
  ensureInitialized();
  return readySnapshot;
}

export function mockGetServerSnapshot(): AuthSnapshot {
  return LOADING_SNAPSHOT;
}

/** No real password check yet — any well-formed email signs in, creating the mock account on first use. */
export async function mockLogin({ email }: LoginInput): Promise<LoginResult> {
  const existing = findMockUserByEmail(email);
  const nextUser: User =
    existing ?? {
      id: createMockUserId(),
      email,
      displayName: email.split("@")[0],
      authProvider: "EMAIL",
      locale: "ko" as LocaleCode,
      market: "KR" as CountryCode,
      createdAt: new Date().toISOString(),
    };
  saveMockUser(nextUser);
  setSessionUser(nextUser);
  return { ok: true };
}

export async function mockSignup({ displayName, email, market, locale }: SignupInput): Promise<SignupResult> {
  if (findMockUserByEmail(email)) {
    return { ok: false, error: "DUPLICATE_EMAIL" };
  }
  const nextUser: User = {
    id: createMockUserId(),
    email,
    displayName,
    authProvider: "EMAIL",
    locale,
    market,
    createdAt: new Date().toISOString(),
  };
  saveMockUser(nextUser);
  setSessionUser(nextUser);
  return { ok: true, requiresEmailConfirmation: false };
}

export async function mockLogout(): Promise<void> {
  setSessionUser(null);
}
