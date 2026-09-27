"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sprout,
  LayoutDashboard,
  ClipboardList,
  Files,
  Newspaper,
  Megaphone,
  TreePine,
  ChartColumn,
  Settings,
} from "lucide-react";
export const adminLinks = [
  ["Dashboard", "", LayoutDashboard],
  ["Permohonan", "permohonan", ClipboardList],
  ["Surat", "surat", Files],
  ["Berita", "berita", Newspaper],
  ["Pengumuman", "pengumuman", Megaphone],
  ["Potensi Desa", "potensi", TreePine],
  ["Statistik", "statistik", ChartColumn],
  ["Pengaturan", "pengaturan", Settings],
] as const;
export function AdminSidebar() {
  const path = usePathname().replace(/\/$/, "");
  return (
    <aside className="admin-sidebar">
      <Link href="/" className="brand">
        <span className="brand-icon">
          <Sprout />
        </span>
        <span>
          WATUAGUNG<small>ADMINISTRASI DESA</small>
        </span>
      </Link>
      <nav aria-label="Navigasi admin">
        {adminLinks.map(([title, slug, Icon]) => (
          <Link
            key={title}
            href={"/admin" + (slug ? "/" + slug : "")}
            className={
              path === "/admin" + (slug ? "/" + slug : "") ? "active" : ""
            }
          >
            <Icon size={19} />
            {title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
