import React from "react";
import { Link } from "wouter";
import { GraduationCap, LogOut, Shield, Settings } from "lucide-react";
import { loginPath, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function ForumLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  const displayName = user
    ? (user.displayName || user.username || user.firstName || user.email || "İstifadəçi")
    : "";
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col w-full" style={{ background: "#FAFAF6" }}>
      {/* Gold gradient header */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "linear-gradient(135deg, #B8821E 0%, #E8B84B 50%, #B8821E 100%)",
          boxShadow: "0 4px 20px rgba(184,130,30,0.35)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 h-[68px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
            <div
              className="flex items-center justify-center rounded-[10px]"
              style={{
                width: 42, height: 42,
                background: "rgba(255,255,255,0.2)",
                border: "2px solid rgba(255,255,255,0.4)",
              }}
            >
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-white leading-tight hidden sm:block" style={{ fontSize: 17, letterSpacing: "-0.3px" }}>
                Gəncə Bərəkət Universiteti
              </h1>
              <h1 className="font-extrabold text-white leading-tight sm:hidden" style={{ fontSize: 17 }}>GBU</h1>
              <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.82)" }}>Tələbə Forumu</p>
            </div>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden sm:block text-sm font-semibold transition-colors"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              Ana Səhifə
            </Link>

            <Link
              href={isAuthenticated ? "/new-post" : loginPath("/new-post")}
              className="text-sm font-bold px-4 py-2 rounded-lg transition-all hover:shadow-md"
              style={{
                background: "#fff",
                color: "#B8821E",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              Yeni mövzu aç
            </Link>

            <div className="flex items-center ml-1">
              {isLoading ? (
                <Skeleton className="h-8 w-8 rounded-full" style={{ background: "rgba(255,255,255,0.25)" }} />
              ) : !isAuthenticated ? (
                <button
                  onClick={login}
                  className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:bg-white/20"
                  style={{
                    color: "#fff",
                    border: "2px solid rgba(255,255,255,0.55)",
                    background: "rgba(0,0,0,0.12)",
                  }}
                >
                  Daxil ol
                </button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 hover:bg-white/20">
                      <Avatar className="h-9 w-9" style={{ border: "2px solid rgba(255,255,255,0.5)" }}>
                        <AvatarImage src={user?.profileImageUrl ?? undefined} alt={displayName} />
                        <AvatarFallback
                          className="text-xs font-bold"
                          style={{ background: "#B8821E", color: "#fff" }}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex flex-col gap-1 leading-none">
                        <p className="font-semibold text-sm">{displayName}</p>
                        {user?.username && (
                          <p className="w-[200px] truncate text-xs text-muted-foreground">@{user.username}</p>
                        )}
                      </div>
                    </div>
                    <div className="h-px bg-border my-1" />
                    <Link href="/settings">
                      <DropdownMenuItem className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Profil Ayarları</span>
                      </DropdownMenuItem>
                    </Link>
                    {user?.isAdmin && (
                      <>
                        <div className="h-px bg-border my-1" />
                        <Link href="/admin">
                          <DropdownMenuItem className="cursor-pointer font-semibold text-primary">
                            <Shield className="mr-2 h-4 w-4" />
                            <span>Admin Paneli</span>
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}
                    <div className="h-px bg-border my-1" />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      onClick={logout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Çıxış</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 py-7">
        {children}
      </main>

      <footer
        className="text-sm text-center py-7"
        style={{ background: "#1a1a1a", color: "rgba(255,255,255,0.45)", borderTop: "1px solid #2a2a2a" }}
      >
        <div className="flex flex-col items-center gap-2">
          <GraduationCap className="h-5 w-5" style={{ color: "#C8922A" }} />
          <p>© {new Date().getFullYear()} Gəncə Bərəkət Universiteti Tələbə Forumu.</p>
          <p>Bu platforma tələbələr üçün müzakirə məkanıdır.</p>
        </div>
      </footer>
    </div>
  );
}
