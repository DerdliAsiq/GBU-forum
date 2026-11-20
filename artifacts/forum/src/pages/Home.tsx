import { useGetStats, useListCategories, useListRecentPosts } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MessageSquare, Users, Folder, Clock, Pin, Eye, MessageCircle, BookOpen, Building2, Megaphone, Briefcase, HelpCircle } from "lucide-react";
import { formatDate } from "@/lib/date";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "tedris-imtahanlar": <BookOpen className="h-5 w-5 text-primary" />,
  "kampus-heyati": <Building2 className="h-5 w-5 text-primary" />,
  "elanlar-xeberler": <Megaphone className="h-5 w-5 text-primary" />,
  "pese-inkisaf": <Briefcase className="h-5 w-5 text-primary" />,
  "umumi-muzakire": <MessageSquare className="h-5 w-5 text-primary" />,
  "yardim-sual": <HelpCircle className="h-5 w-5 text-primary" />,
};

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const { data: recentPosts, isLoading: recentPostsLoading } = useListRecentPosts();

  return (
    <div className="space-y-7 animate-in fade-in duration-500">

      {/* Dark stats bar */}
      <section
        className="rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-5" style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
                <Skeleton className="h-11 w-11 rounded-xl" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="space-y-1.5">
                  <Skeleton className="h-6 w-10" style={{ background: "rgba(255,255,255,0.08)" }} />
                  <Skeleton className="h-3 w-20" style={{ background: "rgba(255,255,255,0.06)" }} />
                </div>
              </div>
            ))
          ) : stats ? (
            [
              { label: "Kateqoriyalar", val: stats.totalCategories, icon: <Folder className="h-5 w-5" style={{ color: "#E8B84B" }} /> },
              { label: "Mövzular", val: stats.totalPosts, icon: <MessageSquare className="h-5 w-5" style={{ color: "#E8B84B" }} /> },
              { label: "Cavablar", val: stats.totalReplies, icon: <MessageCircle className="h-5 w-5" style={{ color: "#E8B84B" }} /> },
              { label: "Bu gün aktiv", val: stats.activeToday, icon: <Users className="h-5 w-5" style={{ color: "#E8B84B" }} /> },
            ].map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-5"
                style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
              >
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ width: 44, height: 44, background: "rgba(200,146,42,0.15)" }}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="font-extrabold leading-none" style={{ fontSize: 22, color: "#E8B84B" }}>{s.val}</div>
                  <div className="text-xs font-medium mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
                </div>
              </div>
            ))
          ) : null}
        </div>
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">

        {/* Categories — 2 cols */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h2 className="text-base font-bold text-foreground">Forum Kateqoriyaları</h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {categoriesLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[68px] rounded-xl" />
                ))
              : categories?.length === 0
              ? (
                <div className="p-8 text-center rounded-xl bg-card border border-card-border text-muted-foreground">
                  Hələ heç bir kateqoriya yoxdur
                </div>
              )
              : categories?.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.id}`}
                    className="group flex items-center gap-4 p-4 rounded-xl bg-card transition-all hover:shadow-md"
                    style={{ border: "1.5px solid #EAD9B8" }}
                  >
                    {/* Icon box */}
                    <div
                      className="flex items-center justify-center rounded-[10px] flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{
                        width: 44, height: 44,
                        background: "linear-gradient(135deg, #FEF3DC, #FDEAB8)",
                        border: "1.5px solid rgba(200,146,42,0.2)",
                      }}
                    >
                      {CATEGORY_ICONS[cat.slug] ?? <Folder className="h-5 w-5 text-primary" />}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        {cat.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{cat.description}</div>
                    </div>

                    {/* Count badge */}
                    <div
                      className="flex-shrink-0 text-center rounded-lg px-3 py-1.5 min-w-[52px]"
                      style={{ background: "#C8922A" }}
                    >
                      <div className="font-extrabold text-white leading-none text-lg">{cat.postCount}</div>
                      <div className="text-[9px] font-bold tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>MÖVZU</div>
                    </div>
                  </Link>
                ))}
          </div>
        </section>

        {/* Recent posts — 1 col */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Son Mövzular
            </h2>
          </div>

          <div className="flex flex-col gap-2.5">
            {recentPostsLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[90px] rounded-xl" />
                ))
              : recentPosts?.length === 0
              ? (
                <div className="p-6 text-center rounded-xl bg-card border border-card-border text-muted-foreground text-sm">
                  Hələ heç bir mövzu yoxdur
                </div>
              )
              : recentPosts?.slice(0, 6).map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.id}`}
                    className="group block p-3.5 rounded-xl bg-card transition-all hover:shadow-md"
                    style={{ border: post.isPinned ? "1.5px solid #E8B84B" : "1.5px solid #EAD9B8" }}
                  >
                    {post.isPinned && (
                      <div
                        className="inline-flex items-center gap-1 text-white font-bold rounded-sm px-2 py-0.5 mb-2"
                        style={{
                          fontSize: 9,
                          letterSpacing: "0.4px",
                          background: "linear-gradient(135deg, #C8922A, #E8B84B)",
                        }}
                      >
                        <Pin className="h-2.5 w-2.5" /> SABİT
                      </div>
                    )}
                    <h4 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-muted-foreground">@{post.authorName}</span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{ background: "#FEF3DC", color: "#B8821E" }}
                      >
                        {post.categoryName}
                      </span>
                      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{post.replyCount}</span>
                        <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{post.viewCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        </section>
      </div>
    </div>
  );
}
