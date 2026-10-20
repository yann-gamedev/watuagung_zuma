"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { ClipboardList, FileCheck2, LayoutDashboard, Users, X } from "lucide-react";
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
  { title: "Akun", href: "/admin/akun", Icon: Users },
] as const;

export function adminPageTitle(path: string) {
  if (normalizePath(path) === "/admin/permohonan/detail") return "Detail permohonan";
  return adminLinks.find((link) => link.href === normalizePath(path))?.title ?? "Panel Petugas";
}
function isActive(path: string, href: string) {
  return path === href || (href === "/admin/permohonan" && path.startsWith(`${href}/`));
}

type Props = { open: boolean; onClose: () => void };

export const AdminSidebar = forwardRef<HTMLElement, Props>(function AdminSidebar({ open, onClose }, ref) {
  const path = normalizePath(usePathname());
  const { user } = useAdminSession();
  const queue = user?.role === "rt_head" ? "/admin/antrean-rt" : user?.role === "rw_head" ? "/admin/antrean-rw" : null;
  const links = adminLinks.filter((link) => {
    if (queue) return link.href === "/admin" || link.href === queue;
    if (link.href === "/admin/antrean-rt" || link.href === "/admin/antrean-rw") return false;
    if (link.href === "/admin/akun") return user?.role === "admin";
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
