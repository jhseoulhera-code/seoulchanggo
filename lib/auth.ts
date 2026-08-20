import type { User } from "@/types/auth";

const SESSION_KEY = "seoulchanggo:auth:session";
const USERS_KEY = "seoulchanggo:auth:users";

/** The signed-in user's profile only — no password or token is ever stored here. */
export function getStoredSession(): User | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveSession(user: User): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

/** Mock "registered users" directory, used only for email de-duplication and to keep a display name stable across repeat logins. */
export function getStoredMockUsers(): User[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as User[];
  } catch {
    return [];
  }
}

export function findMockUserByEmail(email: string): User | null {
  const normalized = email.trim().toLowerCase();
  return getStoredMockUsers().find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export function saveMockUser(user: User): void {
  if (typeof window === "undefined") return;
  const others = getStoredMockUsers().filter((existing) => existing.id !== user.id);
  window.localStorage.setItem(USERS_KEY, JSON.stringify([user, ...others]));
}

export function createMockUserId(): string {
  return `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Only same-origin internal paths are allowed as a post-login redirect target — never an external URL. */
export function isSafeReturnTo(value: string | null): value is string {
  if (!value) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("://")) return false;
  return true;
}
