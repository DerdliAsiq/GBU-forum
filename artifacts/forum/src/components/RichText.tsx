import { Fragment } from "react";
import { Link } from "wouter";

// Same rule as the server's extractMentions (api-server/src/lib/mentions.ts).
const MENTION_RE = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9_\-.ğüşıöçəĞÜŞİÖÇƏ]{2,50})/gu;

/**
 * Plain user text with @username turned into profile links. Everything else is
 * rendered as text (React escapes it), never as HTML.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_RE)) {
    const name = match[2].replace(/[.\-]+$/, "");
    if (name.length < 2) continue;
    const start = (match.index ?? 0) + match[1].length;
    parts.push(text.slice(last, start));
    parts.push(
      <Link
        key={start}
        href={`/istifadeci/${encodeURIComponent(name)}`}
        className="font-semibold hover:underline"
        style={{ color: "#B8821E" }}
      >
        @{name}
      </Link>,
    );
    last = start + 1 + name.length;
  }
  parts.push(text.slice(last));
  return (
    <div className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </div>
  );
}

/** Author name linking to their public profile. */
export function UserLink({ name, className }: { name: string; className?: string }) {
  return (
    <Link href={`/istifadeci/${encodeURIComponent(name)}`} className={`hover:underline ${className ?? ""}`}>
      @{name}
    </Link>
  );
}
