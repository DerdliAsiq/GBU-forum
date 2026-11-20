import { useEffect, useRef, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetPost,
  useListReplies,
  useCreateReply,
  useUpdatePost,
  useDeletePost,
  useUpdateReply,
  useDeleteReply,
  getGetPostQueryKey,
  getListRepliesQueryKey,
  type Reply,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, MessageCircle, Clock, User, Pin, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatFullDate, formatDate } from "@/lib/date";
import { currentAppPath, loginPath, useAuth, type AuthUser } from "@/lib/auth";
import { NOTIFICATIONS_QUERY_KEY } from "@/components/layout/NotificationBell";
import { RichText, UserLink } from "@/components/RichText";
import { ReportDialog } from "@/components/ReportDialog";

const replySchema = z.object({
  content: z.string().min(2, "Mətn çox qısadır").max(5000, "Mətn çox uzundur"),
});

function canModify(user: AuthUser | null, authorId: string | null | undefined) {
  return !!user && (user.isAdmin || (!!authorId && user.id === authorId));
}

function EditedMark({ at }: { at?: string | null }) {
  if (!at) return null;
  return (
    <span className="text-xs text-muted-foreground italic" title={formatFullDate(at)}>
      (redaktə edilib)
    </span>
  );
}

function ConfirmDelete({ what, onConfirm, disabled }: { what: string; onConfirm: () => void; disabled?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" /> Sil
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Əminsiniz?</AlertDialogTitle>
          <AlertDialogDescription>Bu {what} silinəcək. Bu əməliyyat geri qaytarıla bilməz.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Ləğv et</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function PostDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const repliesEndRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: post, isLoading: postLoading } = useGetPost(id, { query: { queryKey: getGetPostQueryKey(id), enabled: !!id } });
  const { data: replies, isLoading: repliesLoading } = useListReplies(id, { query: { queryKey: getListRepliesQueryKey(id), enabled: !!id } });
  const createReply = useCreateReply();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const updateReply = useUpdateReply();
  const deleteReply = useDeleteReply();

  const [editingPost, setEditingPost] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  // Opening a topic marks its notifications read on the server; refresh the bell.
  useEffect(() => {
    if (post?.id && isAuthenticated) {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    }
  }, [post?.id, isAuthenticated, queryClient]);

  // #reply-<id> links (notifications, profiles, admin) scroll to that reply once loaded.
  useEffect(() => {
    const hash = window.location.hash;
    if (!replies?.length || !hash.startsWith("#reply-")) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.boxShadow = "0 0 0 2px #E8B84B";
      setTimeout(() => (el.style.boxShadow = ""), 2500);
    }
  }, [replies]);

  const form = useForm<z.infer<typeof replySchema>>({
    resolver: zodResolver(replySchema),
    defaultValues: { content: "" },
  });

  const refreshPost = () => queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
  const refreshReplies = () => queryClient.invalidateQueries({ queryKey: getListRepliesQueryKey(id) });
  const failed = (title = "Xəta baş verdi") => toast({ variant: "destructive", title, description: "Yenidən cəhd edin." });

  const onSubmit = (values: z.infer<typeof replySchema>) => {
    createReply.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          form.reset();
          refreshReplies();
          refreshPost();
          toast({ title: "Cavab əlavə edildi" });
          setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        },
        onError: () => failed("Cavab əlavə edilmədi"),
      },
    );
  };

  const savePost = () => {
    if (postTitle.trim().length < 3 || postContent.trim().length < 10) {
      toast({ variant: "destructive", title: "Başlıq ən azı 3, mətn ən azı 10 simvol olmalıdır" });
      return;
    }
    updatePost.mutate(
      { id, data: { title: postTitle.trim(), content: postContent } },
      {
        onSuccess: () => {
          setEditingPost(false);
          refreshPost();
          toast({ title: "Mövzu yeniləndi" });
        },
        onError: () => failed(),
      },
    );
  };

  const togglePin = () => {
    if (!post) return;
    updatePost.mutate({ id, data: { isPinned: !post.isPinned } }, { onSuccess: refreshPost, onError: () => failed() });
  };

  const removePost = () => {
    deletePost.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Mövzu silindi" });
          queryClient.invalidateQueries();
          setLocation(post ? `/category/${post.categoryId}` : "/");
        },
        onError: () => failed(),
      },
    );
  };

  const saveReply = (replyId: number) => {
    if (replyDraft.trim().length < 2) {
      toast({ variant: "destructive", title: "Mətn çox qısadır" });
      return;
    }
    updateReply.mutate(
      { id: replyId, data: { content: replyDraft } },
      {
        onSuccess: () => {
          setEditingReplyId(null);
          refreshReplies();
          toast({ title: "Cavab yeniləndi" });
        },
        onError: () => failed(),
      },
    );
  };

  const removeReply = (replyId: number) => {
    deleteReply.mutate(
      { id: replyId },
      {
        onSuccess: () => {
          refreshReplies();
          refreshPost();
          toast({ title: "Cavab silindi" });
        },
        onError: () => failed(),
      },
    );
  };

  if (postLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-1/3 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold">Mövzu tapılmadı</h2>
        <p className="text-muted-foreground mt-2">Axtardığınız mövzu mövcud deyil.</p>
        <Link href="/"><Button variant="outline" className="mt-5">Ana səhifəyə qayıt</Button></Link>
      </div>
    );
  }

  const ownsPost = canModify(user, post.authorId);
  const isAuthorOfPost = !!user && user.id === post.authorId;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <Link
        href={`/category/${post.categoryId}`}
        className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> {post.categoryName} kateqoriyasına qayıt
      </Link>

      {/* Main post card */}
      <div className="rounded-xl overflow-hidden bg-card" style={{ border: "1.5px solid #EAD9B8" }}>
        <div className="p-5" style={{ background: "linear-gradient(135deg, #FEF9EE, #FEF3DC)", borderBottom: "1px solid #EAD9B8" }}>
          {post.isPinned && (
            <div
              className="inline-flex items-center gap-1 text-white font-bold rounded-sm px-2 py-0.5 mb-3"
              style={{ fontSize: 10, letterSpacing: "0.4px", background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
            >
              <Pin className="h-3 w-3" /> SABİT MÖVZU
            </div>
          )}
          {editingPost ? (
            <Input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} maxLength={200} className="mb-4 font-bold" />
          ) : (
            <h1 className="text-xl font-extrabold text-foreground leading-tight mb-4">{post.title}</h1>
          )}
          <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="rounded-full p-1" style={{ background: "rgba(200,146,42,0.15)" }}>
                <User className="h-3 w-3 text-primary" />
              </div>
              <UserLink name={post.authorName} className="font-bold text-foreground/80" />
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary/70" />
              <span>{formatFullDate(post.createdAt)}</span>
              <EditedMark at={post.editedAt} />
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-primary/70" />
              <span>{post.replyCount} cavab</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary/70" />
              <span>{post.viewCount} baxış</span>
            </div>
          </div>
        </div>

        {editingPost ? (
          <div className="p-5 space-y-3">
            <Textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} className="min-h-[180px]" maxLength={20000} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPost(false)}>Ləğv et</Button>
              <Button onClick={savePost} disabled={updatePost.isPending} style={{ background: "#C8922A", color: "#fff" }}>
                Yadda saxla
              </Button>
            </div>
          </div>
        ) : (
          <RichText text={post.content} className="p-6 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words" />
        )}

        {isAuthenticated && !editingPost && (
          <div className="flex items-center gap-4 px-6 pb-4">
            {ownsPost && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setPostTitle(post.title);
                    setPostContent(post.content);
                    setEditingPost(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" /> Redaktə et
                </button>
                <ConfirmDelete what="mövzu və bütün cavabları" onConfirm={removePost} disabled={deletePost.isPending} />
              </>
            )}
            {user?.isAdmin && (
              <button
                type="button"
                onClick={togglePin}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <Pin className="h-3.5 w-3.5" /> {post.isPinned ? "Sabitdən çıxar" : "Sabitlə"}
              </button>
            )}
            {!isAuthorOfPost && <ReportDialog postId={post.id} />}
          </div>
        )}
      </div>

      {/* Replies */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 rounded-full bg-primary" />
          <h3 className="font-bold text-sm">{replies?.length ?? 0} Cavab</h3>
        </div>

        {repliesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : replies?.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground rounded-xl bg-card" style={{ border: "1.5px dashed #EAD9B8" }}>
            Hələ heç bir cavab yoxdur. İlk cavabı siz yazın.
          </div>
        ) : (
          replies?.map((reply: Reply, i) => {
            const ownsReply = canModify(user, reply.authorId);
            const isEditing = editingReplyId === reply.id;
            return (
              <div
                key={reply.id}
                id={`reply-${reply.id}`}
                className="flex rounded-xl bg-card overflow-hidden"
                style={{ border: "1.5px solid #EAD9B8" }}
              >
                <div className="w-1 flex-shrink-0" style={{ background: i % 2 === 0 ? "#C8922A" : "#E8B84B" }} />
                <div className="p-4 flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2.5 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="rounded-full flex items-center justify-center font-bold text-white text-xs"
                        style={{ width: 28, height: 28, background: "linear-gradient(135deg, #C8922A, #E8B84B)", flexShrink: 0 }}
                      >
                        {(reply.authorName || "?")[0].toUpperCase()}
                      </div>
                      <UserLink name={reply.authorName} className="font-bold text-sm text-foreground/80 truncate" />
                      <EditedMark at={reply.editedAt} />
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(reply.createdAt)}</span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <Textarea value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} className="min-h-[90px]" maxLength={5000} />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingReplyId(null)}>Ləğv et</Button>
                        <Button size="sm" onClick={() => saveReply(reply.id)} disabled={updateReply.isPending} style={{ background: "#C8922A", color: "#fff" }}>
                          Yadda saxla
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <RichText text={reply.content} className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed break-words" />
                  )}

                  {isAuthenticated && !isEditing && (
                    <div className="flex items-center gap-4 mt-3">
                      {ownsReply && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyDraft(reply.content);
                              setEditingReplyId(reply.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Redaktə et
                          </button>
                          <ConfirmDelete what="cavab" onConfirm={() => removeReply(reply.id)} disabled={deleteReply.isPending} />
                        </>
                      )}
                      {user?.id !== reply.authorId && <ReportDialog replyId={reply.id} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply form */}
      <div className="rounded-xl bg-card overflow-hidden" style={{ border: "1.5px solid #EAD9B8" }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}>
          <MessageCircle className="h-4 w-4 text-white" />
          <h3 className="text-sm font-bold text-white">Cavab yaz</h3>
        </div>
        <div className="p-5">
          {authLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : !isAuthenticated ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">Cavab yazmaq üçün hesabınıza daxil olun.</p>
              <Link
                href={loginPath(currentAppPath())}
                className="inline-block font-bold text-sm text-white px-6 py-2.5 rounded-lg"
                style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
              >
                Daxil ol / Qeydiyyat
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Mövzuya cavabınızı buraya yazın... (@istifadeci_adi ilə kimisə qeyd edə bilərsiniz)"
                          className="min-h-[110px] resize-y"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={createReply.isPending} className="w-full sm:w-auto font-bold" style={{ background: "#C8922A", color: "#fff" }}>
                    {createReply.isPending ? "Göndərilir..." : "Cavabı Göndər"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
