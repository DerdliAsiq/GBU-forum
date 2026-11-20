/**
 * Posts and replies are anonymous and take a free-text author name. Reject
 * names that would let someone pose as staff ("Admin", "İdarəçi", "M0derator").
 */

const RESERVED_SUBSTRINGS = ["admin", "moderator", "idareci", "inzibat", "rehberlik"];
const RESERVED_EXACT = ["mod", "sistem", "system", "gbu", "staff", "support"];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ə/g, "e")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[^a-z]/g, "");
}

export function isReservedAuthorName(name: string): boolean {
  const n = normalize(name);
  if (!n) return false;
  const adminUsername = process.env.ADMIN_USERNAME ? normalize(process.env.ADMIN_USERNAME) : "";
  return (
    RESERVED_SUBSTRINGS.some((s) => n.includes(s)) ||
    RESERVED_EXACT.includes(n) ||
    (adminUsername !== "" && n === adminUsername)
  );
}

export const RESERVED_AUTHOR_ERROR = "Bu müəllif adından istifadə etmək olmaz";
