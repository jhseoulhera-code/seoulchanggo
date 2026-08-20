"use client";

import type { Session, User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { AuthSnapshot, LoginInput, LoginResult, SignupInput, SignupResult } from "@/lib/authTypes";
import { LOADING_SNAPSHOT } from "@/lib/authTypes";
import type { ProfileRow } from "@/types/database";
import type { User } from "@/types/auth";

/**
 * Real Supabase Auth backend, used once NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set
 * (see lib/supabase/config.ts). Mirrors lib/mockAuthStore.ts's external-store shape
 * so contexts/AuthContext.tsx can swap between them without consumers noticing.
 */
let readySnapshot: AuthSnapshot = LOADING_SNAPSHOT;
let initialized = false;
let client: ReturnType<typeof createClient> | null = null;
const listeners = new Set<() => void>();

function getBrowserClient() {
  if (!client) client = createClient();
  return client;
}

/** profiles is populated by the on_auth_user_created DB trigger; this falls back to auth metadata only if that row can't be read yet (e.g. a race right after signup). */
async function mapAuthUserToProfile(authUser: SupabaseAuthUser): Promise<User> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  const profile = data as unknown as ProfileRow | null;

  if (error || !profile) {
    return {
      id: authUser.id,
      email: authUser.email ?? "",
      displayName:
        (authUser.user_metadata?.display_name as string | undefined) ?? (authUser.email ?? "").split("@")[0],
      authProvider: "EMAIL",
      locale: "ko",
      market: "KR",
      createdAt: authUser.created_at,
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.display_name,
    authProvider: profile.auth_provider,
    locale: profile.preferred_locale,
    market: profile.preferred_market,
    createdAt: profile.created_at,
  };
}

async function handleSessionChange(session: Session | null) {
  const user = session?.user ? await mapAuthUserToProfile(session.user) : null;
  readySnapshot = { status: "ready", user };
  listeners.forEach((listener) => listener());
}

function ensureInitialized() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const supabase = getBrowserClient();
  // Fires once immediately with the current session (INITIAL_SESSION), then again on every sign-in/out/refresh.
  supabase.auth.onAuthStateChange((_event, session) => {
    void handleSessionChange(session);
  });
}

export function supabaseSubscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function supabaseGetSnapshot(): AuthSnapshot {
  ensureInitialized();
  return readySnapshot;
}

export function supabaseGetServerSnapshot(): AuthSnapshot {
  return LOADING_SNAPSHOT;
}

function mapLoginError(message: string): LoginResult {
  if (/invalid login credentials/i.test(message)) {
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }
  console.error("[auth] sign-in failed:", message);
  return { ok: false, error: "UNKNOWN" };
}

function mapSignupError(message: string): SignupResult {
  if (/already registered|already exists/i.test(message)) {
    return { ok: false, error: "DUPLICATE_EMAIL" };
  }
  console.error("[auth] sign-up failed:", message);
  return { ok: false, error: "UNKNOWN" };
}

export async function supabaseLogin({ email, password }: LoginInput): Promise<LoginResult> {
  const supabase = getBrowserClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return mapLoginError(error.message);
  return { ok: true };
}

export async function supabaseSignup({
  displayName,
  email,
  password,
  market,
  locale,
  marketingOptIn,
}: SignupInput): Promise<SignupResult> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        auth_provider: "EMAIL",
        preferred_locale: locale,
        preferred_market: market,
        marketing_opt_in: marketingOptIn,
      },
    },
  });
  if (error) return mapSignupError(error.message);

  // If the project requires email confirmation, signUp succeeds but returns no session —
  // the caller is NOT signed in yet. See STEP 08 report for the dashboard setting this depends on.
  return { ok: true, requiresEmailConfirmation: data.session === null };
}

export async function supabaseLogout(): Promise<void> {
  const supabase = getBrowserClient();
  await supabase.auth.signOut();
}
