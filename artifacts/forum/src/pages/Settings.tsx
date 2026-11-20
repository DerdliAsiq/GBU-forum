import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { ChevronLeft, Camera, User, Save, Check } from "lucide-react";
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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Şəkil çox böyükdür", description: "Maks 2MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
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
          profileImageUrl: avatarPreview ?? undefined,
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
            <p className="text-xs text-muted-foreground">JPG, PNG, GIF — Maks. 2MB</p>
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
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_\-.ğüşıöçĞÜŞİÖÇ]/g, ""))}
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
    </div>
  );
}
