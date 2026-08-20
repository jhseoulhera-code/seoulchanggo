"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  clearSession,
  createMockUserId,
  findMockUserByEmail,
  getStoredSession,
  saveMockUser,
  saveSession,
} from "@/lib/auth";
import type { CountryCode, LocaleCode } from "@/types/market";
import type { User } from "@/types/auth";

/**
 * "loading" vs "ready" is deliberate: a plain `User | null` can't tell a genuinely
 * signed-out visitor apart from "haven't read localStorage yet" during hydration.
 * Consumers that redirect on being signed-out (e.g. /mypage) must wait for "ready" —
 * acting on "loading" would bounce an actually-signed-in user before the real
 * session loads, since a child component's effect can run before this provider's
 * own post-hydration correction.
 */
type AuthSnapshot = { status: "loading" } | { status: "ready"; user: User | null };

const LOADING_SNAPSHOT: AuthSnapshot = { status: "loading" };

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

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AuthSnapshot {
  ensureInitialized();
  return readySnapshot;
}

function getServerSnapshot(): AuthSnapshot {
  return LOADING_SNAPSHOT;
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

type LoginMockInput = {
  email: string;
};

type SignupMockInput = {
  displayName: string;
  email: string;
  market: CountryCode;
  locale: LocaleCode;
};

type SignupMockResult = { ok: true } | { ok: false; error: "DUPLICATE_EMAIL" };

type AuthContextValue = {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** True once the stored session has actually been read on the client. Gate any redirect-on-signed-out logic on this — see AuthSnapshot above. */
  isReady: boolean;
  /** Mock-only: there is no real password check yet, so any well-formed email signs in (creating the account on first use). */
  loginMock: (input: LoginMockInput) => void;
  signupMock: (input: SignupMockInput) => SignupMockResult;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = snapshot.status === "ready" ? snapshot.user : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser: user,
      isAuthenticated: user !== null,
      isReady: snapshot.status === "ready",
      loginMock: ({ email }) => {
        const existing = findMockUserByEmail(email);
        const nextUser: User =
          existing ?? {
            id: createMockUserId(),
            email,
            displayName: email.split("@")[0],
            authProvider: "EMAIL",
            locale: "ko",
            market: "KR",
            createdAt: new Date().toISOString(),
          };
        saveMockUser(nextUser);
        setSessionUser(nextUser);
      },
      signupMock: ({ displayName, email, market, locale }) => {
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
        return { ok: true };
      },
      logout: () => setSessionUser(null),
    }),
    [user, snapshot.status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
