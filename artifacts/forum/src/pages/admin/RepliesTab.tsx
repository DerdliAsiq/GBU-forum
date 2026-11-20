import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeleteReply } from "@workspace/api-client-react";
import { Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Pager } from "@/components/Pager";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

interface AdminReply {
  id: number;
  postId: number;
  postTitle: string;
  content: string;
  authorName: string;
  createdAt: string;
  editedAt: string | null;
}

const PAGE_SIZE = 50;

/** Every reply across the forum, newest first, searchable and deletable. */
export function RepliesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteReply = useDeleteReply();
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-replies", q, page],
    queryFn: async (): Promise<{ replies: AdminReply[]; total: number }> => {
      const res = await apiFetch(`/api/admin/replies?page=${page}&limit=${PAGE_SIZE}&q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const remove = (id: number) =>
    deleteReply.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["admin-replies"] });
          toast({ title: "Cavab silindi" });
        },
        onError: () => toast({ variant: "destructive", title: "Xəta baş verdi" }),
      },
    );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(input.trim());
        }}
        className="flex gap-2 max-w-md"
      >
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mətn, müəllif və ya mövzu axtar" maxLength={100} />
        <Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Cavab</TableHead>
                <TableHead>Müəllif</TableHead>
                <TableHead>Mövzu</TableHead>
                <TableHead>Tarix</TableHead>
                <TableHead className="text-right">Əməliyyat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.replies.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">
                    <p className="line-clamp-2 whitespace-pre-wrap break-words">{r.content}</p>
                    {r.editedAt && <span className="text-xs text-muted-foreground italic">(redaktə edilib)</span>}
                  </TableCell>
                  <TableCell className="text-sm">@{r.authorName}</TableCell>
                  <TableCell className="text-sm max-w-[200px]">
                    <Link href={`/post/${r.postId}#reply-${r.id}`} className="truncate block hover:underline">
                      {r.postTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(r.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cavabı silmək?</AlertDialogTitle>
                          <AlertDialogDescription>@{r.authorName} istifadəçisinin cavabı silinəcək. Geri qaytarıla bilməz.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Ləğv et</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(r.id)} className="bg-destructive hover:bg-destructive/90">
                            Sil
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {!data?.replies.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Cavab tapılmadı
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
      {data && <Pager page={page} limit={PAGE_SIZE} total={data.total} onChange={setPage} />}
    </div>
  );
}
