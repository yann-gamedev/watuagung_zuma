"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { ClipboardList, FileCheck2, FileText, LayoutDashboard, Newspaper, Users, X } from "lucide-react";
import { normalizePath } from "@/components/site-header";
import { useAdminSession } from "@/features/admin/session";

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
  { title: "Konten desa", href: "/admin/konten", Icon: FileText },
  { title: "Konten profil", href: "/admin/konten/profil", Icon: ClipboardList },
  { title: "Konten sejarah", href: "/admin/konten/sejarah", Icon: ClipboardList },
  { title: "Akun", href: "/admin/akun", Icon: Users },
] as const;

export function adminPageTitle(path: string) {
  if (normalizePath(path) === "/admin/permohonan/detail") return "Detail permohonan";
  if (normalizePath(path) === "/admin/berita/tulis") return "Tulis berita";
  if (normalizePath(path) === "/admin/berita/ubah") return "Sunting berita";
  if (normalizePath(path) === "/admin/konten/kontak") return "Konten kontak kantor";
  if (normalizePath(path) === "/admin/konten/transparansi") return "Konten transparansi";
  if (normalizePath(path) === "/admin/konten/struktur") return "Konten struktur pemerintahan";
  if (normalizePath(path) === "/admin/konten/video") return "Konten video";
  return adminLinks.find((link) => link.href === normalizePath(path))?.title ?? "Panel Petugas";
}
function isActive(path: string, href: string) {
  // Subhalaman konten tanpa item sendiri (mis. kontak) menandai "Konten desa".
  if (href === "/admin/konten") return path === href || (path.startsWith(`${href}/`) && !adminLinks.some((link) => link.href === path));
  return path === href || (["/admin/permohonan", "/admin/berita"].includes(href) && path.startsWith(`${href}/`));
}

type Props = { open: boolean; onClose: () => void };

export const AdminSidebar = forwardRef<HTMLElement, Props>(function AdminSidebar({ open, onClose }, ref) {
  const path = normalizePath(usePathname());
  const { user } = useAdminSession();
  const queue = user?.role === "rt_head" ? "/admin/antrean-rt" : user?.role === "rw_head" ? "/admin/antrean-rw" : null;
  const links = adminLinks.filter((link) => {
    if (queue) return link.href === "/admin" || (user?.features.neighborhood_approval && link.href === queue);
    if (link.href === "/admin/antrean-rt" || link.href === "/admin/antrean-rw") return false;
    if (link.href === "/admin/akun") return user?.role === "admin";
    if (link.href === "/admin/berita" || link.href.startsWith("/admin/konten")) return user?.role === "admin" || user?.role === "staff";
    return link.href !== "/admin/persetujuan" || user?.role === "village_head";
  });
  return (
    <aside ref={ref} id="admin-sidebar" className="admin-sidebar" data-open={open} aria-label="Menu petugas">
      <div className="admin-sidebar-top">
        <Link href="/admin" className="admin-brand">
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
