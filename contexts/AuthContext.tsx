"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { LoginInput, LoginResult, SignupInput, SignupResult } from "@/lib/authTypes";
import { mockGetServerSnapshot, mockGetSnapshot, mockLogin, mockLogout, mockSignup, mockSubscribe } from "@/lib/mockAuthStore";
import {
  supabaseGetServerSnapshot,
  supabaseGetSnapshot,
  supabaseLogin,
  supabaseLogout,
  supabaseSignup,
  supabaseSubscribe,
} from "@/lib/supabaseAuthStore";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { User } from "@/types/auth";

const CONFIGURED = isSupabaseConfigured();

const subscribe = CONFIGURED ? supabaseSubscribe : mockSubscribe;
const getSnapshot = CONFIGURED ? supabaseGetSnapshot : mockGetSnapshot;
const getServerSnapshot = CONFIGURED ? supabaseGetServerSnapshot : mockGetServerSnapshot;

type AuthContextValue = {
  currentUser: User | null;
  isAuthenticated: boolean;
  /** True once the session has actually been resolved on the client. Gate any redirect-on-signed-out logic on this. */
  isReady: boolean;
  login: (input: LoginInput) => Promise<LoginResult>;
  signup: (input: SignupInput) => Promise<SignupResult>;
  logout: () => Promise<void>;
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
      login: CONFIGURED ? supabaseLogin : mockLogin,
      signup: CONFIGURED ? supabaseSignup : mockSignup,
      logout: CONFIGURED ? supabaseLogout : mockLogout,
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
