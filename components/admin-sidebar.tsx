"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { ClipboardList, FileCheck2, FileText, LayoutDashboard, Newspaper, Store, Users, X } from "lucide-react";
import { normalizePath } from "@/components/site-header";
import { can, useAdminSession } from "@/features/admin/session";
import type { StaffProfile } from "@/types/pelayanan";

/** Hanya menu yang sudah berfungsi. Modul lain ditambahkan saat dikerjakan. */
export const adminLinks = [
  { title: "Dashboard", href: "/admin", Icon: LayoutDashboard },
  { title: "Permohonan", href: "/admin/permohonan", Icon: ClipboardList },
  { title: "Persetujuan", href: "/admin/persetujuan", Icon: FileCheck2 },
  { title: "Antrean RT", href: "/admin/antrean-rt", Icon: ClipboardList },
  { title: "Antrean RW", href: "/admin/antrean-rw", Icon: ClipboardList },
  { title: "Siap diambil", href: "/admin/surat", Icon: FileCheck2 },
  { title: "Buku registrasi", href: "/admin/register", Icon: ClipboardList },
  { title: "Berita", href: "/admin/berita", Icon: Newspaper },
  { title: "UMKM", href: "/admin/umkm", Icon: Store },
  { title: "Konten desa", href: "/admin/konten", Icon: FileText },
  { title: "Konten profil", href: "/admin/konten/profil", Icon: ClipboardList },
  { title: "Konten sejarah", href: "/admin/konten/sejarah", Icon: ClipboardList },
  { title: "Akun", href: "/admin/akun", Icon: Users },
] as const;

export function adminPageTitle(path: string) {
  if (normalizePath(path) === "/admin/permohonan/detail") return "Detail permohonan";
  if (normalizePath(path) === "/admin/berita/tulis") return "Tulis berita";
  if (normalizePath(path) === "/admin/berita/ubah") return "Sunting berita";
  if (normalizePath(path) === "/admin/umkm/tambah") return "Tambah UMKM";
  if (normalizePath(path) === "/admin/umkm/ubah") return "Sunting UMKM";
  if (normalizePath(path) === "/admin/konten/kontak") return "Konten kontak kantor";
  if (normalizePath(path) === "/admin/konten/transparansi") return "Konten transparansi";
  if (normalizePath(path) === "/admin/konten/struktur") return "Konten struktur pemerintahan";
  if (normalizePath(path) === "/admin/konten/video") return "Konten video";
  return adminLinks.find((link) => link.href === normalizePath(path))?.title ?? "Panel Petugas";
}
function isActive(path: string, href: string) {
  // Subhalaman konten tanpa item sendiri (mis. kontak) menandai "Konten desa".
  if (href === "/admin/konten") return path === href || (path.startsWith(`${href}/`) && !adminLinks.some((link) => link.href === path));
  return path === href || (["/admin/permohonan", "/admin/berita", "/admin/umkm"].includes(href) && path.startsWith(`${href}/`));
}

export function canAccessAdminPath(user: StaffProfile | null, path: string) {
  path = normalizePath(path);
  if (!can(user, "panel")) return false;
  if (path === "/admin/berita" || path.startsWith("/admin/berita/") || path === "/admin/umkm" || path.startsWith("/admin/umkm/")) return can(user, "media:manage");
  if (path === "/admin/konten" || path.startsWith("/admin/konten/")) return can(user, "site:manage");
  if (path === "/admin/akun") return user?.role === "admin";
  if (!can(user, "applications:manage")) return false;
  const queue = user?.role === "rt_head" ? "/admin/antrean-rt" : user?.role === "rw_head" ? "/admin/antrean-rw" : null;
  if (queue) return path === "/admin" || (!!user?.features.neighborhood_approval && (path === queue || path === "/admin/permohonan/detail"));
  if (path === "/admin/antrean-rt" || path === "/admin/antrean-rw") return false;
  if (path === "/admin/persetujuan") return user?.role === "village_head";
  return ["/admin", "/admin/permohonan", "/admin/permohonan/detail", "/admin/surat", "/admin/register"].includes(path);
}

type Props = { open: boolean; onClose: () => void };

export const AdminSidebar = forwardRef<HTMLElement, Props>(function AdminSidebar({ open, onClose }, ref) {
  const path = normalizePath(usePathname());
  const { user } = useAdminSession();
  const links = adminLinks.filter((link) => canAccessAdminPath(user, link.href));
  return (
    <aside ref={ref} id="admin-sidebar" className="admin-sidebar" data-open={open} aria-label="Menu petugas">
      <div className="admin-sidebar-top">
        <Link href={user?.role === "kim" ? "/admin/berita/" : "/admin/"} className="admin-brand">
          <Image
            className="admin-brand-logo"
            src="/brand/logo-watuagung-128.png"
            alt="Logo Desa Watuagung"
            width={56}
            height={56}
          />
          <span className="admin-brand-text">
            <strong>WATUAGUNG</strong>
            <small>ADMINISTRASI DESA</small>
          </span>
        </Link>
        <button type="button" className="admin-sidebar-close" aria-label="Tutup menu" onClick={onClose}>
          <X size={24} aria-hidden="true" />
        </button>
      </div>
      <nav aria-label="Navigasi admin">
        {links.map(({ title, href, Icon }) => (
          <Link key={href} href={href} className={isActive(path, href) ? "active" : ""} aria-current={isActive(path, href) ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            {title}
          </Link>
        ))}
      </nav>
    </aside>
  );
});
