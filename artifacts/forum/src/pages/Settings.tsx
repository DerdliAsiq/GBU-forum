import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { ChevronLeft, Camera, User, Save, Check, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

export default function Settings() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? user.firstName ?? "");
      setUsername(user.username ?? "");
      setAvatarPreview(user.profileImageUrl ?? null);
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Şəkil uyğun deyil", description: "Şəkil faylı seçin (maks. 10MB)" });
      return;
    }
    try {
      setAvatarPreview(await resizeToDataUrl(file, 256));
    } catch {
      toast({ variant: "destructive", title: "Şəkil oxunmadı", description: "Başqa şəkil seçin." });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName || undefined,
          username: username || undefined,
          // Only send the avatar when it changed ("" removes it).
          profileImageUrl: avatarPreview === (user?.profileImageUrl ?? null) ? undefined : (avatarPreview ?? ""),
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        toast({ title: "Profil yeniləndi", description: "Dəyişiklikləriniz saxlanıldı." });
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await res.json();
        toast({ variant: "destructive", title: "Xəta", description: data.error ?? "Yenidən cəhd edin" });
      }
    } catch {
      toast({ variant: "destructive", title: "Şəbəkə xətası", description: "Yenidən cəhd edin." });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-6 pt-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h2 className="text-xl font-bold mb-2">Giriş tələb olunur</h2>
        <p className="text-muted-foreground text-sm">Profil ayarlarına daxil olmaq üçün sistemə giriş edin.</p>
        <Link href="/"><Button variant="outline" className="mt-5">Ana Səhifəyə qayıt</Button></Link>
      </div>
    );
  }

  const initials = (displayName || user?.firstName || "A").substring(0, 2).toUpperCase();

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <Link href="/" className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Geri qayıt
        </Link>
        <h1 className="text-xl font-extrabold flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
          >
            <User className="h-4 w-4 text-white" />
          </div>
          Profil Ayarları
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">Hesabınızı idarə edin</p>
      </div>

      <div className="rounded-xl bg-card overflow-hidden" style={{ border: "1.5px solid #EAD9B8" }}>
        <div className="h-1.5" style={{ background: "linear-gradient(90deg, #C8922A, #E8B84B, #C8922A)" }} />
        <div className="p-6 space-y-6">

          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div
                className="rounded-full flex items-center justify-center overflow-hidden"
                style={{ width: 88, height: 88, border: "3px solid #EAD9B8" }}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-extrabold text-2xl"
                    style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                style={{ width: 28, height: 28, background: "linear-gradient(135deg, #C8922A, #E8B84B)", border: "2px solid white" }}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP — avtomatik kiçildilir</p>
            {avatarPreview && (
              <button type="button" onClick={() => setAvatarPreview(null)} className="text-xs text-muted-foreground hover:text-destructive">
                Şəkli sil
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Görünən Ad</label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Adınız necə görünsün?"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">Forumda göstəriləcək adınız</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground/80 uppercase tracking-wide">İstifadəçi Adı</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^A-Za-z0-9_\-.ğüşıöçəĞÜŞİÖÇƏ]/g, ""))}
                  placeholder="istifadeci_adi"
                  maxLength={50}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">Yalnız hərf, rəqəm, _ simvolu</p>
            </div>

            {user?.email && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase tracking-wide">Email</label>
                <Input value={user.email} disabled className="bg-muted/30" />
                <p className="text-xs text-muted-foreground">Email dəyişdirilə bilməz</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full font-bold"
            style={{ background: saved ? "#22c55e" : "linear-gradient(135deg, #C8922A, #E8B84B)", color: "#fff", border: "none" }}
          >
            {saved ? (
              <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Saxlanıldı</span>
            ) : saving ? (
              "Saxlanılır..."
            ) : (
              <span className="flex items-center gap-2"><Save className="h-4 w-4" /> Dəyişiklikləri Saxla</span>
            )}
          </Button>
        </div>
      </div>

      <PasswordCard />
    </div>
  );
}

/** Downscales an image file to at most `size`×`size` and returns a JPEG data URL. */
function resizeToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, size / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

function PasswordCard() {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast({ variant: "destructive", title: "Yeni şifrə ən azı 8 simvol olmalıdır" });
      return;
    }
    if (next !== repeat) {
      toast({ variant: "destructive", title: "Yeni şifrələr eyni deyil" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok) {
        setCurrent("");
        setNext("");
        setRepeat("");
        toast({ title: "Şifrə dəyişdirildi", description: "Digər cihazlardakı sessiyalar bağlandı." });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Şifrə dəyişmədi", description: data.error ?? "Yenidən cəhd edin" });
      }
    } catch {
      toast({ variant: "destructive", title: "Şəbəkə xətası" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl bg-card p-6 space-y-4" style={{ border: "1.5px solid #EAD9B8" }}>
      <h2 className="font-bold flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" /> Şifrəni dəyiş
      </h2>
      <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Cari şifrə" autoComplete="current-password" required />
      <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Yeni şifrə (ən azı 8 simvol)" autoComplete="new-password" minLength={8} required />
      <Input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} placeholder="Yeni şifrə (təkrar)" autoComplete="new-password" minLength={8} required />
      <Button type="submit" disabled={saving} className="w-full font-bold" variant="outline">
        {saving ? "Dəyişdirilir..." : "Şifrəni dəyiş"}
      </Button>
    </form>
  );
}
