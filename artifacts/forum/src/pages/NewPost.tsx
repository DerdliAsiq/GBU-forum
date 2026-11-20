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
import { ChevronLeft, LogIn, PenLine } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { currentAppPath, loginPath, useAuth } from "@/lib/auth";

const postSchema = z.object({
  categoryId: z.coerce.number().min(1, "Kategoriya seçilməlidir"),
  title: z.string().min(3, "Başlıq çox qısadır").max(200, "Başlıq çox uzundur"),
  content: z.string().min(10, "Mətn çox qısadır"),
});

export default function NewPost() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4 animate-in fade-in duration-500">
        <div
          className="mx-auto flex items-center justify-center rounded-xl"
          style={{ width: 56, height: 56, background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
        >
          <LogIn className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-extrabold">Mövzu açmaq üçün daxil olun</h1>
        <p className="text-sm text-muted-foreground">
          Yeni mövzu yalnız hesabı olan istifadəçilər tərəfindən açıla bilər.
        </p>
        <Link
          href={loginPath(currentAppPath())}
          className="inline-block font-bold text-sm text-white px-6 py-2.5 rounded-lg"
          style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
        >
          Daxil ol / Qeydiyyat
        </Link>
      </div>
    );
  }

  return <NewPostForm />;
}

function NewPostForm() {
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
