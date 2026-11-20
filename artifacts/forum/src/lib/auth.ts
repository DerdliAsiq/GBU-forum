import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";
import { apiFetch } from "./api";

export type { AuthUser };

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

/** Full browser URL for an in-app path, honouring BASE_PATH. */
export function appUrl(path: string): string {
  return `${BASE}${path}`;
}

/** The current in-app path (without BASE_PATH), including the query string. */
export function currentAppPath(): string {
  const path = window.location.pathname.slice(BASE.length) || "/";
  return path + window.location.search;
}

/** Only same-app paths are allowed as a post-login destination. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) {
    return "/";
  }
  return next.startsWith("/giris") ? "/" : next;
}

/** In-app link to the sign-in page that returns to `next` afterwards. */
export function loginPath(next: string = "/"): string {
  const target = safeNextPath(next);
  return target === "/" ? "/giris" : `/giris?next=${encodeURIComponent(target)}`;
}

function loginUrl(next: string): string {
  return appUrl(loginPath(next));
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiFetch("/api/auth/user")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ user: AuthUser | null }>;
      })
      .then((data) => {
        if (!cancelled) {
          setUser(data.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    window.location.href = loginUrl(currentAppPath());
  }, []);

  const logout = useCallback(() => {
    // The API's /logout answers with a redirect to a path on *its own* origin,
    // so call it in the background and navigate within the frontend instead.
    apiFetch("/api/logout", { redirect: "manual" })
      .catch(() => undefined)
      .finally(() => {
        window.location.href = import.meta.env.BASE_URL;
      });
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
