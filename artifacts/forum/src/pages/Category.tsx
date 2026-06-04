import { useParams, Link } from "wouter";
import { useGetCategory, useListPosts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Eye, Pin, ChevronLeft, PlusCircle } from "lucide-react";
import { formatDate } from "@/lib/date";

export default function Category() {
  const params = useParams();
  const id = Number(params.id);

  const { data: category, isLoading: categoryLoading } = useGetCategory(id, { query: { enabled: !!id } });
  const { data: postList, isLoading: postsLoading } = useListPosts({ categoryId: id }, { query: { enabled: !!id } });

  if (categoryLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-1/3 rounded-lg" />
        <Skeleton className="h-4 w-1/4 rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold">Kateqoriya tapılmadı</h2>
        <p className="text-muted-foreground mt-2">Axtardığınız kateqoriya mövcud deyil.</p>
        <Link href="/"><Button variant="outline" className="mt-5">Ana səhifəyə qayıt</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Category header */}
      <div
        className="rounded-xl p-5"
        style={{ background: "linear-gradient(135deg, #1a1a1a, #2d2d2d)" }}
      >
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium mb-3 transition-colors"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Forumlara qayıt
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-white leading-tight">{category.name}</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>{category.description}</p>
          </div>
          <Link href={`/new-post?categoryId=${category.id}`}>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold flex-shrink-0 transition-all hover:shadow-lg"
              style={{ background: "#C8922A", color: "#fff" }}
            >
              <PlusCircle className="h-4 w-4" /> Yeni mövzu aç
            </button>
          </Link>
        </div>
      </div>

      {/* Posts list */}
      <div className="flex flex-col gap-2.5">
        {postsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : postList?.posts.length === 0 ? (
          <div
            className="p-12 text-center rounded-xl bg-card"
            style={{ border: "1.5px solid #EAD9B8" }}
          >
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #FEF3DC, #FDEAB8)" }}
            >
              <MessageCircle className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-base font-bold mb-1">Hələ heç bir mövzu yoxdur</h3>
            <p className="text-muted-foreground text-sm mb-5">Bu kateqoriyada ilk mövzunu siz yaradın.</p>
            <Link href={`/new-post?categoryId=${category.id}`}>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Yeni mövzu aç</Button>
            </Link>
          </div>
        ) : (
          postList?.posts.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="group flex items-start justify-between gap-4 p-4 rounded-xl bg-card transition-all hover:shadow-md"
              style={{ border: post.isPinned ? "1.5px solid #E8B84B" : "1.5px solid #EAD9B8" }}
            >
              <div className="flex-1 min-w-0">
                {post.isPinned && (
                  <div
                    className="inline-flex items-center gap-1 text-white font-bold rounded-sm px-2 py-0.5 mb-2"
                    style={{ fontSize: 9, letterSpacing: "0.4px", background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
                  >
                    <Pin className="h-2.5 w-2.5" /> SABİT
                  </div>
                )}
                <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-snug">
                  {post.title}
                </h3>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span className="font-semibold text-foreground/70">{post.authorName || "Anonim"}</span>
                  <span>·</span>
                  <span>{formatDate(post.createdAt)}</span>
                  {post.lastReplyAt && (
                    <>
                      <span>·</span>
                      <span>Son cavab: {formatDate(post.lastReplyAt)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex flex-col items-center min-w-[44px]">
                  <span className="font-bold text-foreground text-sm">{post.replyCount}</span>
                  <span className="text-[9px] uppercase font-semibold text-muted-foreground flex items-center gap-0.5 mt-0.5">
                    <MessageCircle className="h-2.5 w-2.5" /> Cavab
                  </span>
                </div>
                <div className="flex flex-col items-center min-w-[44px]">
                  <span className="font-bold text-foreground text-sm">{post.viewCount}</span>
                  <span className="text-[9px] uppercase font-semibold text-muted-foreground flex items-center gap-0.5 mt-0.5">
                    <Eye className="h-2.5 w-2.5" /> Baxış
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
