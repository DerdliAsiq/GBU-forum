import { useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/date";

interface NotificationItem {
  id: number;
  type: "reply_to_post" | "reply_in_thread" | string;
  postId: number | null;
  postTitle: string | null;
  replyId: number | null;
  actorName: string | null;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  unreadCount: number;
  items: NotificationItem[];
}

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await apiFetch("/api/notifications", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function describe(n: NotificationItem): string {
  const who = n.actorName ? `@${n.actorName}` : "Bir istifadəçi";
  switch (n.type) {
    case "reply_to_post":
      return `${who} mövzunuza cavab yazdı`;
    case "mention":
      return `${who} sizi qeyd etdi`;
    case "report":
      return `${who} məzmundan şikayət etdi`;
    default:
      return `${who} iştirak etdiyiniz mövzuya cavab yazdı`;
  }
}

/** Header bell: unread badge + latest notifications. Only rendered for signed-in users. */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: (id: number | "all") =>
      apiFetch(id === "all" ? "/api/notifications/read-all" : `/api/notifications/${id}/read`, {
        method: "POST",
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  // Show the unread count in the browser tab, e.g. "(2) Gəncə Bərəkət ...".
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  const open = (n: NotificationItem) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.type === "report") setLocation("/admin?tab=reports");
    else if (n.postId) setLocation(`/post/${n.postId}${n.replyId ? `#reply-${n.replyId}` : ""}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Bildirişlər (${unread} oxunmamış)` : "Bildirişlər"}
          className="relative flex items-center justify-center rounded-full transition-colors hover:bg-white/20"
          style={{ width: 36, height: 36 }}
        >
          <Bell className="h-5 w-5 text-white" />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: "#DC2626", color: "#fff", border: "2px solid #E8B84B" }}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="font-bold text-sm">Bildirişlər</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate("all")}
              className="flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: "#B8821E" }}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Hamısını oxunmuş et
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Hələ bildiriş yoxdur</p>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onSelect={() => open(n)}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-none cursor-pointer"
                style={n.read ? undefined : { background: "#FEF9EE" }}
              >
                <MessageCircle
                  className="h-4 w-4 mt-0.5 flex-shrink-0"
                  style={{ color: n.read ? "#9CA3AF" : "#C8922A" }}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${n.read ? "text-muted-foreground" : "font-semibold"}`}>
                    {describe(n)}
                  </p>
                  {n.postTitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{n.postTitle}</p>}
                  <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(n.createdAt)}</p>
                </div>
                {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full flex-shrink-0" style={{ background: "#DC2626" }} />}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
