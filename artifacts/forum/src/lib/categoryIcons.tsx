import {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Folder,
  GraduationCap,
  Heart,
  HelpCircle,
  Laptop,
  Megaphone,
  MessageSquare,
  Music,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Icons an admin can pick for a category; the key is stored in categories.icon. */
export const CATEGORY_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  "book-open": { icon: BookOpen, label: "Kitab (tədris)" },
  "graduation-cap": { icon: GraduationCap, label: "Papaq (universitet)" },
  building: { icon: Building2, label: "Bina (kampus)" },
  megaphone: { icon: Megaphone, label: "Elan" },
  briefcase: { icon: Briefcase, label: "Çanta (karyera)" },
  "message-square": { icon: MessageSquare, label: "Müzakirə" },
  "help-circle": { icon: HelpCircle, label: "Sual" },
  users: { icon: Users, label: "İcma" },
  calendar: { icon: Calendar, label: "Tədbir" },
  laptop: { icon: Laptop, label: "Texnologiya" },
  trophy: { icon: Trophy, label: "İdman" },
  music: { icon: Music, label: "İncəsənət" },
  heart: { icon: Heart, label: "Sosial" },
  folder: { icon: Folder, label: "Qovluq (standart)" },
};

// Categories created before icons were selectable are matched by slug.
const LEGACY_SLUG_ICONS: Record<string, string> = {
  "tedris-imtahanlar": "book-open",
  "kampus-heyati": "building",
  "elanlar-xeberler": "megaphone",
  "pese-inkisaf": "briefcase",
  "umumi-muzakire": "message-square",
  "yardim-sual": "help-circle",
};

export function CategoryIcon({
  icon,
  slug,
  className = "h-5 w-5 text-primary",
}: {
  icon?: string | null;
  slug?: string;
  className?: string;
}) {
  const key = (icon && CATEGORY_ICONS[icon] ? icon : null) ?? (slug ? LEGACY_SLUG_ICONS[slug] : null) ?? "folder";
  const Icon = CATEGORY_ICONS[key]?.icon ?? Folder;
  return <Icon className={className} />;
}
