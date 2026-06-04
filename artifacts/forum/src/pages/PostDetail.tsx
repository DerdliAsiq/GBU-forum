import { useParams, Link } from "wouter";
import { useGetPost, useListReplies, useCreateReply, getGetPostQueryKey, getListRepliesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MessageCircle, Clock, User, Pin, Eye } from "lucide-react";
import { formatFullDate, formatDate } from "@/lib/date";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const replySchema = z.object({
  content: z.string().min(2, "Mətn çox qısadır").max(2000, "Mətn çox uzundur"),
  authorName: z.string().max(50, "Ad çox uzundur").optional()
});

export default function PostDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const repliesEndRef = useRef<HTMLDivElement>(null);

  const { data: post, isLoading: postLoading } = useGetPost(id, { query: { enabled: !!id } });
  const { data: replies, isLoading: repliesLoading } = useListReplies(id, { query: { enabled: !!id } });
  const createReply = useCreateReply();

  const form = useForm<z.infer<typeof replySchema>>({
    resolver: zodResolver(replySchema),
    defaultValues: { content: "", authorName: "" }
  });

  const onSubmit = (values: z.infer<typeof replySchema>) => {
    createReply.mutate(
      { id, data: values },
      {
        onSuccess: () => {
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListRepliesQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetPostQueryKey(id) });
          toast({ title: "Cavab əlavə edildi", description: "Cavabınız uğurla paylaşıldı." });
          setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        },
        onError: () => {
          toast({ title: "Xəta baş verdi", description: "Cavab əlavə edilərkən xəta baş verdi.", variant: "destructive" });
        }
      }
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
        {/* Post header */}
        <div className="p-5" style={{ background: "linear-gradient(135deg, #FEF9EE, #FEF3DC)", borderBottom: "1px solid #EAD9B8" }}>
          {post.isPinned && (
            <div
              className="inline-flex items-center gap-1 text-white font-bold rounded-sm px-2 py-0.5 mb-3"
              style={{ fontSize: 10, letterSpacing: "0.4px", background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
            >
              <Pin className="h-3 w-3" /> SABİT MÖVZU
            </div>
          )}
          <h1 className="text-xl font-extrabold text-foreground leading-tight mb-4">{post.title}</h1>
          <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-full p-1"
                style={{ background: "rgba(200,146,42,0.15)" }}
              >
                <User className="h-3 w-3 text-primary" />
              </div>
              <span className="font-bold text-foreground/80">{post.authorName || "Anonim"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary/70" />
              <span>{formatFullDate(post.createdAt)}</span>
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
        {/* Post body */}
        <div className="p-6 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </div>
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
          <div
            className="text-center py-8 text-sm text-muted-foreground rounded-xl bg-card"
            style={{ border: "1.5px dashed #EAD9B8" }}
          >
            Hələ heç bir cavab yoxdur. İlk cavabı siz yazın.
          </div>
        ) : (
          replies?.map((reply, i) => (
            <div
              key={reply.id}
              className="flex rounded-xl bg-card overflow-hidden"
              style={{ border: "1.5px solid #EAD9B8" }}
            >
              {/* Gold accent side bar */}
              <div
                className="w-1 flex-shrink-0"
                style={{ background: i % 2 === 0 ? "#C8922A" : "#E8B84B" }}
              />
              <div className="p-4 flex-1">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="rounded-full flex items-center justify-center font-bold text-white text-xs"
                      style={{ width: 28, height: 28, background: "linear-gradient(135deg, #C8922A, #E8B84B)", flexShrink: 0 }}
                    >
                      {(reply.authorName || "A")[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-sm text-foreground/80">{reply.authorName || "Anonim"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(reply.createdAt)}</span>
                </div>
                <div className="text-sm text-foreground/85 whitespace-pre-wrap leading-relaxed">
                  {reply.content}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={repliesEndRef} />
      </div>

      {/* Reply form */}
      <div
        className="rounded-xl bg-card overflow-hidden"
        style={{ border: "1.5px solid #EAD9B8" }}
      >
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
        >
          <MessageCircle className="h-4 w-4 text-white" />
          <h3 className="text-sm font-bold text-white">Cavab yaz</h3>
        </div>
        <div className="p-5">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Mövzuya cavabınızı buraya yazın..."
                        className="min-h-[110px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div
                className="flex flex-col sm:flex-row items-end gap-4 justify-between rounded-lg p-4"
                style={{ background: "#FEF9EE", border: "1px solid #EAD9B8" }}
              >
                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem className="w-full sm:max-w-xs">
                      <FormLabel className="text-xs font-semibold text-muted-foreground">Adınız (Könüllü)</FormLabel>
                      <FormControl>
                        <Input placeholder="Anonim" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Siz anonim paylaşırsınız. Ad yazmaq istəyirsinizsə, yuxarıya daxil edin.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={createReply.isPending}
                  className="w-full sm:w-auto font-bold"
                  style={{ background: "#C8922A", color: "#fff" }}
                >
                  {createReply.isPending ? "Göndərilir..." : "Cavabı Göndər"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
