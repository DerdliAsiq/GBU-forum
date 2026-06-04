import { useListCategories, useCreatePost } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, PenLine } from "lucide-react";
import { Link } from "wouter";

const postSchema = z.object({
  categoryId: z.coerce.number().min(1, "Kategoriya seçilməlidir"),
  title: z.string().min(3, "Başlıq çox qısadır").max(200, "Başlıq çox uzundur"),
  content: z.string().min(10, "Mətn çox qısadır"),
  authorName: z.string().max(50, "Ad çox uzundur").optional().transform(val => val === "" ? undefined : val)
});

export default function NewPost() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const searchParams = new URLSearchParams(window.location.search);
  const initialCategoryId = searchParams.get("categoryId") || "";

  const { data: categories, isLoading: categoriesLoading } = useListCategories();
  const createPost = useCreatePost();

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      categoryId: initialCategoryId ? Number(initialCategoryId) : 0,
      title: "",
      content: "",
      authorName: ""
    }
  });

  const onSubmit = (values: z.infer<typeof postSchema>) => {
    createPost.mutate(
      { data: values },
      {
        onSuccess: (post) => {
          toast({ title: "Mövzu yaradıldı", description: "Mövzunuz uğurla forumda paylaşıldı." });
          setLocation(`/post/${post.id}`);
        },
        onError: () => {
          toast({ title: "Xəta baş verdi", description: "Mövzu yaradılarkən xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <Link href="/" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Geri qayıt
        </Link>
        <h1 className="text-xl font-extrabold flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
          >
            <PenLine className="h-4 w-4 text-white" />
          </div>
          Yeni Mövzu Aç
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Forumda yeni bir müzakirə başladın. Qaydalarımıza əməl etdiyiniz üçün təşəkkürlər.
        </p>
      </div>

      <div className="rounded-xl bg-card overflow-hidden" style={{ border: "1.5px solid #EAD9B8" }}>
        {/* Form header bar */}
        <div
          className="h-2"
          style={{ background: "linear-gradient(90deg, #C8922A, #E8B84B, #C8922A)" }}
        />
        <div className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Kateqoriya</FormLabel>
                    <Select
                      disabled={categoriesLoading}
                      onValueChange={field.onChange}
                      defaultValue={field.value ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Kateqoriya seçin" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Mövzu başlığı</FormLabel>
                    <FormControl>
                      <Input placeholder="Mövzunun qısa və aydın başlığı" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Mətn</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Mövzunun ətraflı izahını buraya yazın..."
                        className="min-h-[180px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg p-4" style={{ background: "#FEF9EE", border: "1px solid #EAD9B8" }}>
                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Adınız (Könüllü)</FormLabel>
                      <FormControl>
                        <Input placeholder="Anonim" {...field} />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Siz anonim paylaşırsınız. Ad yazmaq istəyirsinizsə, yuxarıya daxil edin.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  size="lg"
                  disabled={createPost.isPending}
                  className="font-bold px-8"
                  style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)", color: "#fff", border: "none" }}
                >
                  {createPost.isPending ? "Göndərilir..." : "Mövzunu Paylaş"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
