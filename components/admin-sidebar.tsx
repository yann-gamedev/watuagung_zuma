"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef } from "react";
import { ClipboardList, FileCheck2, LayoutDashboard, X } from "lucide-react";
import { normalizePath } from "@/components/site-header";

/** Hanya menu yang sudah berfungsi. Modul lain ditambahkan saat dikerjakan. */
export const adminLinks = [
  { title: "Dashboard", href: "/admin", Icon: LayoutDashboard },
  { title: "Permohonan", href: "/admin/permohonan", Icon: ClipboardList },
  { title: "Surat disetujui", href: "/admin/surat", Icon: FileCheck2 },
] as const;

export function adminPageTitle(path: string) {
  return adminLinks.find((link) => link.href === normalizePath(path))?.title ?? "Panel Petugas";
}

type Props = { open: boolean; onClose: () => void };

export const AdminSidebar = forwardRef<HTMLElement, Props>(function AdminSidebar({ open, onClose }, ref) {
  const path = normalizePath(usePathname());
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
        {adminLinks.map(({ title, href, Icon }) => (
          <Link key={href} href={href} className={path === href ? "active" : ""} aria-current={path === href ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            {title}
          </Link>
        ))}
      </nav>
    </aside>
  );
});
