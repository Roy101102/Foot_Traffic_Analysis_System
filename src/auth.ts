import { useSyncExternalStore } from "react";

export type UserRole = "admin" | "manager" | "viewer";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

let currentUser: AuthUser | null = null;
let hasCheckedSession = false;
let inFlightCheck: Promise<AuthUser | null> | null = null;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function setCurrentUser(user: AuthUser | null) {
  currentUser = user;
  hasCheckedSession = true;
  notifyListeners();
}

/**
 * Verifies the HttpOnly cookie session against GET /api/auth/me.
 * Deduplicates concurrent calls when parent and child route loaders run together.
 */
export async function checkAuth(force = false): Promise<AuthUser | null> {
  if (hasCheckedSession && !force) {
    return currentUser;
  }

  if (inFlightCheck && !force) {
    return inFlightCheck;
  }

  inFlightCheck = (async () => {
    try {
      const res = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        setCurrentUser(null);
        return null;
      }

      const user: AuthUser = await res.json();
      setCurrentUser(user);
      return user;
    } catch {
      setCurrentUser(null);
      return null;
    } finally {
      inFlightCheck = null;
    }
  })();

  return inFlightCheck;
}

/**
 * Authenticates credentials against POST /api/auth/login and sets HttpOnly cookies.
 */
export async function login(
  email: string,
  password: string,
  rememberMe = false
): Promise<AuthUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      email: email.trim(),
      password,
      remember_me: rememberMe,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Invalid email or password");
  }

  // Purge any leftover fake login keys from localStorage
  localStorage.removeItem("user");
  localStorage.removeItem("email");
  localStorage.removeItem("isAuthenticated");

  setCurrentUser(data as AuthUser);
  return data as AuthUser;
}

/**
 * Revokes the server-side session and clears HttpOnly cookies via POST /api/auth/logout.
 */
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } finally {
    setCurrentUser(null);
  }
}

export const getCurrentUser = (): AuthUser | null => currentUser;
export const isAuthenticated = (): boolean => Boolean(currentUser);

/**
 * React hook for components (such as Layout.tsx) to reactively read the authenticated user & role.
 */
export function useCurrentUser(): AuthUser | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    () => currentUser
  );
}