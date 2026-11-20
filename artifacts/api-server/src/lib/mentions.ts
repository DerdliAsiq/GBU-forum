/**
 * `@username` mentions. The character set matches USERNAME_PATTERN in
 * userValidation.ts; the frontend renders mentions with the same rule.
 */
const MENTION_RE = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9_\-.ğüşıöçəĞÜŞİÖÇƏ]{2,50})/gu;

/** Unique usernames mentioned in `text` (trailing dots/dashes trimmed), at most `max`. */
export function extractMentions(text: string, max = 10): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[2].replace(/[.\-]+$/, "");
    if (name.length >= 2) found.add(name);
    if (found.size >= max) break;
  }
  return [...found];
}
