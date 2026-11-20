import { ChevronLeft, ChevronRight } from "lucide-react";

/** Previous / next pager. Renders nothing when everything fits on one page. */
export function Pager({
  page,
  limit,
  total,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const btn =
    "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-50";
  return (
    <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Səhifələr">
      <button type="button" className={btn} style={{ borderColor: "#EAD9B8" }} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Əvvəlki
      </button>
      <span className="text-sm text-muted-foreground">
        {page} / {pages}
      </span>
      <button type="button" className={btn} style={{ borderColor: "#EAD9B8" }} disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Növbəti <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

/** Reads/writes ?page= so pages are linkable and survive refresh. */
export function readPageParam(): number {
  const n = parseInt(new URLSearchParams(window.location.search).get("page") ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
