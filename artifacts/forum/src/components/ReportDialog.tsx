import { useState } from "react";
import { Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam / reklam" },
  { value: "insult", label: "Təhqir və ya təcavüz" },
  { value: "inappropriate", label: "Uyğunsuz məzmun" },
  { value: "off_topic", label: "Mövzudan kənar" },
  { value: "other", label: "Digər" },
];

/** "Şikayət et" button + dialog for a topic (postId) or a reply (replyId). */
export function ReportDialog({ postId, replyId }: { postId?: number; replyId?: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      const res = await apiFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, replyId, reason, details: details.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: data.alreadyReported ? "Bu məzmun artıq şikayət edilib" : "Şikayət göndərildi",
          description: data.alreadyReported ? "Moderatorlar artıq yoxlayır." : "Moderatorlar baxacaq. Təşəkkürlər.",
        });
        setOpen(false);
        setDetails("");
      } else {
        toast({ variant: "destructive", title: "Göndərilmədi", description: data.error ?? "Yenidən cəhd edin" });
      }
    } catch {
      toast({ variant: "destructive", title: "Şəbəkə xətası" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Şikayət et"
        >
          <Flag className="h-3.5 w-3.5" /> Şikayət et
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Şikayət et</DialogTitle>
          <DialogDescription>Bu {replyId ? "cavab" : "mövzu"} niyə uyğun deyil?</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              {r.label}
            </label>
          ))}
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Əlavə açıqlama (könüllü)"
            maxLength={500}
            className="mt-2"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Ləğv et
          </Button>
          <Button onClick={submit} disabled={sending} className="bg-destructive hover:bg-destructive/90">
            {sending ? "Göndərilir..." : "Göndər"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
