// Pure request/query helpers (no DB import, so they can be unit-tested).

/** Page/limit from a query string, clamped so bad input can't error or overload the DB. */
export function parsePaging(
  query: Record<string, unknown>,
  { defaultLimit = 20, maxLimit = 50 } = {},
): { page: number; limit: number; offset: number } {
  const rawPage = parseInt(String(query.page ?? "1"), 10);
  const rawLimit = parseInt(String(query.limit ?? defaultLimit), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

/** Escapes LIKE/ILIKE wildcards so user text is matched literally. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
