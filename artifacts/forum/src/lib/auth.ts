import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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

export const AUTH_QUERY_KEY = ["auth-user"] as const;

async function fetchAuthUser(): Promise<AuthUser | null> {
  const res = await apiFetch("/api/auth/user", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

/**
 * Current user, shared by every component through the react-query cache.
 *
 * A failed request (server waking up, flaky network, 5xx) must not look like
 * "logged out": it is retried with backoff, and on a later refetch error the
 * last known user is kept. Only an explicit `{ user: null }` from the server
 * means signed out. Refetched when the tab regains focus.
 */
export function useAuth(): AuthState {
  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchAuthUser,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const user = query.data ?? null;

  const login = useCallback(() => {
    window.location.href = loginUrl(currentAppPath());
  }, []);

  const logout = useCallback(() => {
    // POST (never GET, so other sites can't log users out), then reload at home.
    apiFetch("/api/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        window.location.href = import.meta.env.BASE_URL;
      });
  }, []);

  return {
    user,
    isLoading: query.isPending,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
