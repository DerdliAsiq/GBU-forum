import { Link } from "wouter";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4 animate-in fade-in duration-500">
      <SearchX className="h-12 w-12 mx-auto text-muted-foreground" />
      <h1 className="text-xl font-extrabold">Səhifə tapılmadı</h1>
      <p className="text-sm text-muted-foreground">Axtardığınız səhifə mövcud deyil və ya silinib.</p>
      <Link href="/" className="inline-block text-sm font-semibold hover:underline" style={{ color: "#B8821E" }}>
        ← Ana səhifəyə qayıt
      </Link>
    </div>
  );
}
