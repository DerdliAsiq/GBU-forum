import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MessageCircle, MessageSquare, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatDate, formatFullDate } from "@/lib/date";
import NotFound from "@/pages/not-found";

interface PublicProfile {
  username: string;
  displayName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: string;
  postCount: number;
  replyCount: number;
  posts: { id: number; title: string; categoryName: string; replyCount: number; createdAt: string }[];
  replies: { id: number; postId: number; postTitle: string; excerpt: string; createdAt: string }[];
}

export default function Profile() {
  const { username = "" } = useParams<{ username: string }>();
  const name = decodeURIComponent(username);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", name],
    queryFn: async (): Promise<PublicProfile | null> => {
      const res = await apiFetch(`/api/users/${encodeURIComponent(name)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (isError) return <p className="text-center py-16 text-destructive">Profil yüklənmədi.</p>;
  if (!data) return <NotFound />;

  const shown = data.displayName || data.username;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-500">
      <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)" }}>
        <Avatar className="h-16 w-16" style={{ border: "2px solid #C8922A" }}>
          <AvatarImage src={data.profileImageUrl ?? undefined} alt={shown} />
          <AvatarFallback className="text-lg font-bold" style={{ background: "#B8821E", color: "#fff" }}>
            {shown.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2 truncate">
            {shown}
            {data.isAdmin && <Shield className="h-4 w-4" style={{ color: "#E8B84B" }} aria-label="Admin" />}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>@{data.username}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Qoşulub: {formatFullDate(data.createdAt)}</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {data.postCount} mövzu</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {data.replyCount} cavab</span>
          </div>
          {data.isBanned && <p className="text-xs mt-1 text-red-400">Bu hesab bloklanıb</p>}
        </div>
      </div>

      <section className="space-y-2.5">
        <h2 className="font-bold text-sm">Son mövzuları</h2>
        {data.posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hələ mövzu açmayıb.</p>
        ) : (
          data.posts.map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className="group block p-3.5 rounded-xl bg-card hover:shadow-md transition-all" style={{ border: "1.5px solid #EAD9B8" }}>
              <div className="font-semibold text-sm group-hover:text-primary transition-colors">{p.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {p.categoryName} · {formatDate(p.createdAt)} · {p.replyCount} cavab
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="font-bold text-sm">Son cavabları</h2>
        {data.replies.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hələ cavab yazmayıb.</p>
        ) : (
          data.replies.map((r) => (
            <Link key={r.id} href={`/post/${r.postId}#reply-${r.id}`} className="group block p-3.5 rounded-xl bg-card hover:shadow-md transition-all" style={{ border: "1.5px solid #EAD9B8" }}>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80 group-hover:text-primary">{r.postTitle}</span> · {formatDate(r.createdAt)}
              </div>
              <p className="text-sm mt-1 line-clamp-2">{r.excerpt}</p>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
