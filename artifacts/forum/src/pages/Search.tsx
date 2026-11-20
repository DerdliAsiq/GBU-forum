import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Eye, MessageCircle, Search as SearchIcon } from "lucide-react";
import type { PostList } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pager } from "@/components/Pager";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

const PAGE_SIZE = 20;

function readQuery() {
  const p = new URLSearchParams(window.location.search);
  const page = parseInt(p.get("page") ?? "1", 10);
  return { q: p.get("q") ?? "", page: Number.isFinite(page) && page > 0 ? page : 1 };
}

export default function Search() {
  const initial = readQuery();
  const [input, setInput] = useState(initial.q);
  const [q, setQ] = useState(initial.q);
  const [page, setPage] = useState(initial.page);

  // Keep the URL shareable (?q=...&page=...).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    if (page > 1) url.searchParams.set("page", String(page));
    else url.searchParams.delete("page");
    window.history.replaceState(null, "", url);
  }, [q, page]);

  const enabled = q.trim().length >= 2;
  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", q, page],
    enabled,
    queryFn: async (): Promise<PostList> => {
      const res = await apiFetch(`/api/search?q=${encodeURIComponent(q.trim())}&page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">
      <h1 className="text-xl font-extrabold flex items-center gap-2">
        <SearchIcon className="h-5 w-5 text-primary" /> Axtarış
      </h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(input.trim());
        }}
        className="flex gap-2"
        role="search"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Mövzu, mətn və ya cavab axtarın..."
          maxLength={100}
          autoFocus
          aria-label="Axtarış sözü"
        />
        <button
          type="submit"
          className="px-5 rounded-lg text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
        >
          Axtar
        </button>
      </form>

      {!enabled ? (
        <p className="text-sm text-muted-foreground">Ən azı 2 simvol yazın.</p>
      ) : isFetching && !data ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Axtarış alınmadı. Yenidən cəhd edin.</p>
      ) : data && data.posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">"{q}" üçün nəticə tapılmadı.</p>
      ) : (
        data && (
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">{data.total} nəticə</p>
            {data.posts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="group block p-4 rounded-xl bg-card transition-all hover:shadow-md"
                style={{ border: "1.5px solid #EAD9B8" }}
              >
                <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{post.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="font-semibold">@{post.authorName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#FEF3DC", color: "#B8821E" }}>
                    {post.categoryName}
                  </span>
                  <span>{formatDate(post.createdAt)}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{post.replyCount}</span>
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.viewCount}</span>
                  </span>
                </div>
              </Link>
            ))}
            <Pager page={page} limit={PAGE_SIZE} total={data.total} onChange={setPage} />
          </div>
        )
      )}
    </div>
  );
}
