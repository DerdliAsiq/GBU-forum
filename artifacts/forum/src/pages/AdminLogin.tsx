import { useState } from "react";
import { useLocation } from "wouter";
import { GraduationCap, Shield, Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        toast({ title: "Xoş gəldiniz!", description: "Admin panelinə daxil oldunuz." });
        window.location.href = "/admin";
      } else {
        const data = await res.json();
        toast({
          variant: "destructive",
          title: "Giriş xətası",
          description: data.error ?? "İstifadəçi adı və ya şifrə yanlışdır",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Şəbəkə xətası", description: "Yenidən cəhd edin." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 60%, #1a1a1a 100%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center rounded-2xl mb-4"
            style={{
              width: 72, height: 72,
              background: "linear-gradient(135deg, #C8922A, #E8B84B)",
              boxShadow: "0 8px 32px rgba(200,146,42,0.4)",
            }}
          >
            <GraduationCap className="h-9 w-9 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-white">Gəncə Bərəkət Universiteti</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Admin İdarəetmə Panelinə Giriş</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
        >
          {/* Gold top bar */}
          <div className="h-1.5" style={{ background: "linear-gradient(90deg, #C8922A, #E8B84B, #C8922A)" }} />

          <div className="p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 36, height: 36, background: "linear-gradient(135deg, #FEF3DC, #FDEAB8)", border: "1.5px solid #EAD9B8" }}
              >
                <Shield className="h-4.5 w-4.5 text-primary" style={{ color: "#C8922A" }} />
              </div>
              <div>
                <h2 className="font-bold text-sm text-foreground">Admin Girişi</h2>
                <p className="text-xs text-muted-foreground">Yalnız səlahiyyətli şəxslər</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase tracking-wide">
                  İstifadəçi Adı
                </label>
                <Input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin istifadəçi adı"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground/80 uppercase tracking-wide">
                  Şifrə
                </label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:shadow-lg disabled:opacity-60 mt-2"
                style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
              >
                {loading ? "Yoxlanılır..." : "Daxil Ol"}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-border">
              <a
                href="/"
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                ← Foruma qayıt
              </a>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.25)" }}>
          © {new Date().getFullYear()} GBU Tələbə Forumu
        </p>
      </div>
    </div>
  );
}
