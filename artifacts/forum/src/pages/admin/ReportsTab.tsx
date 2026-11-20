import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

export interface AdminReport {
  id: number;
  reason: string;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
  reporterName: string | null;
  postId: number | null;
  replyId: number | null;
  postTitle: string | null;
  excerpt: string | null;
  authorName: string | null;
}

export const REPORTS_QUERY_KEY = ["admin-reports"] as const;

const REASON_LABELS: Record<string, string> = {
  spam: "Spam / reklam",
  insult: "Təhqir",
  inappropriate: "Uyğunsuz məzmun",
  off_topic: "Mövzudan kənar",
  other: "Digər",
};

const STATUS_TABS = [
  { value: "open", label: "Açıq" },
  { value: "resolved", label: "Silinənlər" },
  { value: "dismissed", label: "Rədd edilənlər" },
] as const;

export function useReports(status: string, enabled = true) {
  return useQuery({
    queryKey: [...REPORTS_QUERY_KEY, status],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<{ openCount: number; reports: AdminReport[] }> => {
      const res = await apiFetch(`/api/admin/reports?status=${status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

export function ReportsTab() {
  const [status, setStatus] = useState<string>("open");
  const { data, isLoading } = useReports(status);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resolve = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "remove" | "dismiss" }) => {
      const res = await apiFetch(`/api/admin/reports/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
    onSuccess: (_d, { action }) => {
      queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin-replies"] });
      toast({ title: action === "remove" ? "Məzmun silindi" : "Şikayət rədd edildi" });
    },
    onError: () => toast({ variant: "destructive", title: "Xəta baş verdi" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={status === t.value ? "default" : "outline"}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
            {t.value === "open" && data && data.openCount > 0 && (
              <Badge variant="destructive" className="ml-2">{data.openCount}</Badge>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : !data?.reports.length ? (
        <div className="bg-white rounded-lg border p-10 text-center text-muted-foreground">Şikayət yoxdur</div>
      ) : (
        data.reports.map((r) => (
          <div key={r.id} className="bg-white rounded-lg border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{REASON_LABELS[r.reason] ?? r.reason}</Badge>
              <span className="text-muted-foreground">
                {r.replyId ? "Cavab" : "Mövzu"} · şikayət edən: {r.reporterName ? `@${r.reporterName}` : "—"} · {formatDate(r.createdAt)}
              </span>
            </div>
            {r.postId ? (
              <Link href={`/post/${r.postId}${r.replyId ? `#reply-${r.replyId}` : ""}`} className="font-semibold text-sm hover:underline">
                {r.postTitle ?? "(mövzu)"}
              </Link>
            ) : (
              <p className="text-sm italic text-muted-foreground">Məzmun artıq silinib</p>
            )}
            {r.excerpt && (
              <blockquote className="text-sm border-l-2 pl-3 text-foreground/80 whitespace-pre-wrap break-words line-clamp-4">
                {r.authorName && <span className="font-semibold">@{r.authorName}: </span>}
                {r.excerpt}
              </blockquote>
            )}
            {r.details && <p className="text-sm text-muted-foreground">Açıqlama: {r.details}</p>}
            {r.status === "open" && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ id: r.id, action: "remove" })}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Məzmunu sil
                </Button>
                <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: r.id, action: "dismiss" })}>
                  <Check className="h-4 w-4 mr-1" /> Rədd et
                </Button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
