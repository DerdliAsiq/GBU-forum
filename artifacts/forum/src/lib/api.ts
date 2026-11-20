import { setBaseUrl } from "@workspace/api-client-react";

/**
 * Origin of the API server, e.g. "https://gbu-forum-api.onrender.com".
 *
 * Read from `VITE_API_URL` at build time. Empty means same-origin: requests go
 * to a relative `/api/...` path (API and frontend served from one origin, or a
 * reverse proxy in front of both).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

/** Point the generated react-query client at the API. Call once, before rendering. */
export function configureApi(): void {
  setBaseUrl(API_BASE_URL || null);
}

/** Absolute URL for an API path such as `/api/profile`. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * `fetch` for endpoints that are not in the OpenAPI spec (so have no generated
 * hook). Prefixes the API origin and sends the session cookie.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(apiUrl(path), { credentials: "include", ...init });
}
