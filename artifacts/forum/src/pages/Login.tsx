import { useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { appUrl, safeNextPath } from "@/lib/auth";

type Mode = "login" | "register";

/** One sign-in page for every account, admins included. */
export default function Login() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
  const isRegister = mode === "register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    try {
      const res = await apiFetch(isRegister ? "/api/auth/register" : "/api/auth/local-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { username, password, displayName: displayName.trim() || undefined }
            : { username, password },
        ),
      });

      if (res.ok) {
        // Full reload so every useAuth() instance picks up the new session.
        window.location.href = appUrl(next);
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast({
        variant: "destructive",
        title: isRegister ? "Qeydiyyat alınmadı" : "Giriş alınmadı",
        description: data.error ?? "Yenidən cəhd edin",
      });
    } catch {
      toast({ variant: "destructive", title: "Şəbəkə xətası", description: "Yenidən cəhd edin." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto py-6 animate-in fade-in duration-500">
      <div className="rounded-xl bg-card overflow-hidden" style={{ border: "1.5px solid #EAD9B8" }}>
        <div className="h-2" style={{ background: "linear-gradient(90deg, #C8922A, #E8B84B, #C8922A)" }} />
        <div className="p-7">
          <div className="flex items-center gap-2.5 mb-6">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 36, height: 36, background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
            >
              {isRegister ? <UserPlus className="h-4 w-4 text-white" /> : <LogIn className="h-4 w-4 text-white" />}
            </div>
            <div>
              <h1 className="font-extrabold text-lg">{isRegister ? "Qeydiyyat" : "Daxil ol"}</h1>
              <p className="text-xs text-muted-foreground">
                {isRegister ? "Mövzu açmaq üçün hesab yaradın" : "Hesabınıza daxil olun"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-bold text-foreground/80 uppercase tracking-wide">
                İstifadəçi adı
              </label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            {isRegister && (
              <div className="space-y-1.5">
                <label htmlFor="displayName" className="text-xs font-bold text-foreground/80 uppercase tracking-wide">
                  Görünən ad (könüllü)
                </label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="nickname"
                  maxLength={100}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-bold text-foreground/80 uppercase tracking-wide">
                Şifrə
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  minLength={isRegister ? 8 : undefined}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Şifrəni gizlət" : "Şifrəni göstər"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isRegister && <p className="text-xs text-muted-foreground">Ən azı 8 simvol</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:shadow-lg disabled:opacity-60 mt-2"
              style={{ background: "linear-gradient(135deg, #C8922A, #E8B84B)" }}
            >
              {loading ? "Gözləyin..." : isRegister ? "Hesab yarat" : "Daxil ol"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-border text-center text-sm text-muted-foreground">
            {isRegister ? "Artıq hesabınız var? " : "Hesabınız yoxdur? "}
            <button
              type="button"
              onClick={() => setMode(isRegister ? "login" : "register")}
              className="font-semibold hover:underline"
              style={{ color: "#B8821E" }}
            >
              {isRegister ? "Daxil olun" : "Qeydiyyatdan keçin"}
            </button>
          </div>
        </div>
      </div>
      <div className="text-center mt-4">
        <Link href="/" className="text-xs text-muted-foreground hover:text-primary">
          ← Foruma qayıt
        </Link>
      </div>
    </div>
  );
}
