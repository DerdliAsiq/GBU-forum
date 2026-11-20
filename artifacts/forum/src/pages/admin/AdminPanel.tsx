import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { 
  useListAdminUsers, 
  useToggleAdminUser, 
  useListCategories, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory,
  useListPosts,
  useUpdatePost,
  useDeletePost,
  getListAdminUsersQueryKey,
  getListCategoriesQueryKey,
  getListPostsQueryKey,
  getListRecentPostsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldAlert, AlertCircle, Edit, Trash2, Pin, Plus, Users, Folder, MessageSquare, Info, Ban, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { apiFetch } from "@/lib/api";
import NotFound from "@/pages/not-found";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export default function AdminPanel() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  // Don't advertise that an admin area exists: anyone who isn't an admin
  // (signed in or not) just sees the normal "page not found".
  if (!isAuthenticated || !user?.isAdmin) {
    return <NotFound />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="bg-primary/10 p-2.5 rounded-lg">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin İdarəetmə Paneli</h1>
          <p className="text-sm text-slate-500">Sistem ayarları və məzmun idarəetməsi</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> <span className="hidden sm:inline">İstifadəçilər</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Folder className="h-4 w-4" /> <span className="hidden sm:inline">Kateqoriyalar</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> <span className="hidden sm:inline">Mövzular</span>
          </TabsTrigger>
          <TabsTrigger value="replies" className="flex items-center gap-2">
            <Info className="h-4 w-4" /> <span className="hidden sm:inline">Cavablar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0">
          <UsersTab />
        </TabsContent>
        
        <TabsContent value="categories" className="mt-0">
          <CategoriesTab />
        </TabsContent>
        
        <TabsContent value="posts" className="mt-0">
          <PostsTab />
        </TabsContent>
        
        <TabsContent value="replies" className="mt-0">
          <div className="bg-white rounded-lg border shadow-sm p-12 flex flex-col items-center justify-center text-center">
            <div className="bg-slate-100 p-4 rounded-full mb-4">
              <Info className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Cavabların İdarəedilməsi</h3>
            <p className="text-slate-500 max-w-md">
              Mərkəzləşdirilmiş cavab idarəetməsi hazırda dəstəklənmir. Cavabları və şərhləri birbaşa müvafiq mövzu səhifəsindən silə bilərsiniz.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersTab() {
  const { data: users, isLoading } = useListAdminUsers();
  const toggleAdmin = useToggleAdminUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [banPending, setBanPending] = useState<string | null>(null);

  const handleToggleAdmin = (id: string, currentStatus: boolean) => {
    toggleAdmin.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        toast({
          title: "Uğurlu əməliyyat",
          description: currentStatus ? "Admin səlahiyyəti alındı" : "Admin səlahiyyəti verildi",
        });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Xəta", description: "Əməliyyat zamanı xəta baş verdi." });
      }
    });
  };

  const handleToggleBan = async (id: string, currentBanned: boolean) => {
    setBanPending(id);
    try {
      const res = await apiFetch(`/api/admin/users/${id}/toggle-ban`, {
        method: "POST",
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        toast({
          title: "Uğurlu əməliyyat",
          description: currentBanned ? "İstifadəçinin bloku açıldı" : "İstifadəçi bloklandı",
        });
      } else {
        const data = await res.json();
        toast({ variant: "destructive", title: "Xəta", description: data.error ?? "Əməliyyat uğursuz oldu" });
      }
    } catch {
      toast({ variant: "destructive", title: "Xəta", description: "Şəbəkə xətası" });
    } finally {
      setBanPending(null);
    }
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>İstifadəçi</TableHead>
            <TableHead>Email / İstifadəçi Adı</TableHead>
            <TableHead>Qoşulma Tarixi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Əməliyyatlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((u) => (
            <TableRow key={u.id} className={u.isBanned ? "bg-red-50/40" : ""}>
              <TableCell className="font-medium">
                <div>
                  <div>{u.displayName || `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || <span className="text-muted-foreground italic">Göstərilməyib</span>}</div>
                  {u.username && <div className="text-xs text-muted-foreground">@{u.username}</div>}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
              <TableCell>{formatDate(u.createdAt)}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {u.isAdmin && <Badge variant="default" className="bg-primary/10 text-primary hover:bg-primary/20 w-fit">Admin</Badge>}
                  {u.isBanned ? (
                    <Badge variant="destructive" className="w-fit">Bloklanmış</Badge>
                  ) : (
                    !u.isAdmin && <Badge variant="secondary" className="w-fit">İstifadəçi</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Admin:</span>
                    <Switch 
                      checked={u.isAdmin} 
                      onCheckedChange={() => handleToggleAdmin(u.id, u.isAdmin)}
                      disabled={toggleAdmin.isPending}
                    />
                  </div>
                  {!u.isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={banPending === u.id}
                          className={u.isBanned ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-destructive hover:text-destructive hover:bg-red-50"}
                        >
                          {u.isBanned ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          <span className="ml-1 text-xs">{u.isBanned ? "Açıq" : "Blokla"}</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Əminsiniz?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {u.isBanned
                              ? `"${u.displayName || u.email || u.id}" istifadəçisinin blokunu açmaq istəyirsiniz?`
                              : `"${u.displayName || u.email || u.id}" istifadəçisini bloklamaq istəyirsiniz? Bu istifadəçi sistemə daxil ola bilməyəcək.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Ləğv et</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleToggleBan(u.id, u.isBanned)}
                            className={u.isBanned ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90"}
                          >
                            {u.isBanned ? "Bloku Aç" : "Blokla"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!users?.length && (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                İstifadəçi tapılmadı
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CategoriesTab() {
  const { data: categories, isLoading } = useListCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setSlug("");
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!name || !slug) return;
    createCategory.mutate({ data: { name, description, slug } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        setIsCreateOpen(false);
        resetForm();
        toast({ title: "Kateqoriya yaradıldı" });
      },
      onError: () => toast({ variant: "destructive", title: "Xəta baş verdi" })
    });
  };

  const handleUpdate = () => {
    if (!editingId || !name || !slug) return;
    updateCategory.mutate({ id: editingId, data: { name, description, slug } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        resetForm();
        toast({ title: "Kateqoriya yeniləndi" });
      },
      onError: () => toast({ variant: "destructive", title: "Xəta baş verdi" })
    });
  };

  const handleDelete = (id: number) => {
    deleteCategory.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
        toast({ title: "Kateqoriya silindi" });
      },
      onError: () => toast({ variant: "destructive", title: "Xəta baş verdi. Bəlkə bu kateqoriyaya aid mövzular var." })
    });
  };

  const openEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setDescription(cat.description || "");
    setSlug(cat.slug);
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Yeni Kateqoriya
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Kateqoriya Yaradın</DialogTitle>
              <DialogDescription>
                Forum üçün yeni bölmə yaradın.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ad</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Məsələn: Texnologiya" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slug (URL)</label>
                <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} placeholder="Məsələn: texnologiya" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Açıqlama</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Bu bölmə nə haqqındadır?" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Ləğv et</Button>
              <Button onClick={handleCreate} disabled={createCategory.isPending}>Yarat</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-1/3">Açıqlama</TableHead>
              <TableHead className="text-center">Mövzu Sayı</TableHead>
              <TableHead className="text-right">Əməliyyatlar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell><Badge variant="outline">{cat.slug}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">{cat.description}</TableCell>
                <TableCell className="text-center font-medium">{cat.postCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Dialog open={editingId === cat.id} onOpenChange={(open) => {
                      if (!open) resetForm();
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                          <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Kateqoriyanı Redaktə Et</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Ad</label>
                            <Input value={name} onChange={e => setName(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Slug (URL)</label>
                            <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Açıqlama</label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => resetForm()}>Ləğv et</Button>
                          <Button onClick={handleUpdate} disabled={updateCategory.isPending}>Yadda saxla</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Əminsiniz?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Bu kateqoriyanı silmək istədiyinizdən əminsiniz? Bu əməliyyat geri qaytarıla bilməz.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Ləğv et</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDelete(cat.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Sil
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!categories?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Kateqoriya tapılmadı
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function PostsTab() {
  const { data: postsData, isLoading } = useListPosts({ page: 1, limit: 50 });
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleTogglePin = (id: number, currentPinned: boolean) => {
    updatePost.mutate({ id, data: { isPinned: !currentPinned } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRecentPostsQueryKey() });
        toast({ title: "Mövzu yeniləndi" });
      },
      onError: () => toast({ variant: "destructive", title: "Xəta baş verdi" })
    });
  };

  const handleDelete = (id: number) => {
    deletePost.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRecentPostsQueryKey() });
        toast({ title: "Mövzu silindi" });
      },
      onError: () => toast({ variant: "destructive", title: "Xəta baş verdi" })
    });
  };

  if (isLoading) return <TableSkeleton />;

  const posts = postsData?.posts || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Başlıq</TableHead>
            <TableHead>Kateqoriya</TableHead>
            <TableHead>Müəllif</TableHead>
            <TableHead>Statistika</TableHead>
            <TableHead>Tarix</TableHead>
            <TableHead className="text-right">Əməliyyatlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <TableRow key={post.id} className={post.isPinned ? "bg-amber-50/50" : ""}>
              <TableCell className="font-medium max-w-[300px]">
                <div className="flex items-center gap-2">
                  {post.isPinned && <Pin className="h-4 w-4 text-accent shrink-0" />}
                  <Link href={`/post/${post.id}`} className="truncate hover:underline">
                    {post.title}
                  </Link>
                </div>
              </TableCell>
              <TableCell><Badge variant="outline">{post.categoryName}</Badge></TableCell>
              <TableCell>@{post.authorName}</TableCell>
              <TableCell className="text-muted-foreground text-sm">
                Baxış: {post.viewCount} | Cavab: {post.replyCount}
              </TableCell>
              <TableCell>{formatDate(post.createdAt)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant={post.isPinned ? "default" : "outline"} 
                    size="sm" 
                    className={post.isPinned ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
                    onClick={() => handleTogglePin(post.id, post.isPinned)}
                    disabled={updatePost.isPending}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Əminsiniz?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Bu mövzunu və ona aid bütün cavabları silmək istədiyinizdən əminsiniz?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Ləğv et</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDelete(post.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Sil
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!posts.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Mövzu tapılmadı
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}