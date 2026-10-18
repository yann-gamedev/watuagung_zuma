"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, LogOut, Menu } from "lucide-react";
import { apiBase } from "@/services/pelayanan";
import { AdminSidebar, adminPageTitle } from "@/components/admin-sidebar";
import { normalizePath } from "@/components/site-header";
import { AdminLoginForm } from "./login-form";
import { useAdminSession } from "./session";

const roleLabels = { staff: "Petugas", village_head: "Kepala Desa", admin: "Admin" } as const;
const MOBILE_QUERY = "(max-width: 900px)";

function focusables(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
}

/** Layar tengah tanpa sidebar: demo, pemeriksaan sesi, dan login. */
function CenterScreen({ children }: { children: React.ReactNode }) {
  return <main id="main" className="admin-center">{children}</main>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const session = useAdminSession();

  if (!apiBase) {
    return (
      <CenterScreen>
        <div className="center-card"><h1>Panel petugas tidak aktif pada demo</h1><p className="mt-3">Prototipe ini berjalan tanpa server dan database. Login, pengelolaan pengajuan, dan penerbitan surat belum tersedia.</p><Link id="admin-demo-services" href="/pelayanan/" className="btn mt-5">Coba simulasi pelayanan</Link></div>
      </CenterScreen>
    );
  }
  if (session.status === "checking") {
    return <CenterScreen><div className="center-card" role="status"><h1>Memeriksa sesi...</h1><p className="mt-3">Mohon tunggu sebentar.</p></div></CenterScreen>;
  }
  if (session.status === "unreachable") {
    return (
      <CenterScreen>
        <div className="center-card" role="alert">
          <h1>Server belum dapat dihubungi</h1>
          <p className="mt-3">{session.notice || "Periksa koneksi lalu coba lagi."}</p>
          <div className="admin-actions mt-5">
            <button type="button" className="btn" onClick={session.retry}>Coba lagi</button>
            <button type="button" className="btn btn-secondary" onClick={() => void session.logout()}>Masuk dengan akun lain</button>
          </div>
        </div>
      </CenterScreen>
    );
  }
  if (session.status === "signed-out" || !session.user) return <CenterScreen><AdminLoginForm /></CenterScreen>;
  return <AdminFrame>{children}</AdminFrame>;
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAdminSession();
  const path = normalizePath(usePathname());
  const [open, setOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(path);
  const [leaving, setLeaving] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Tutup panel saat berpindah halaman.
  if (prevPath !== path) {
    setPrevPath(path);
    setOpen(false);
  }

  const closeMenu = useCallback(() => {
    setOpen(false);
    // Tombol Menu berada di area yang inert selama panel terbuka; lepaskan dulu.
    if (mainRef.current) mainRef.current.inert = false;
    toggleRef.current?.focus();
  }, []);

  // Panel geser (≤ 900px): kunci scroll, konten di belakang inert,
  // fokus masuk panel, Tab terjebak di panel, Esc menutup.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const background = mainRef.current;
    if (background) background.inert = true;
    focusables(sidebarRef.current)[0]?.focus();
    const media = window.matchMedia(MOBILE_QUERY);
    const onMedia = () => { if (!media.matches) setOpen(false); };
    media.addEventListener("change", onMedia);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMenu(); return; }
      if (event.key !== "Tab") return;
      const items = focusables(sidebarRef.current);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !sidebarRef.current?.contains(active);
      if (event.shiftKey && (active === first || outside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (active === last || outside)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onMedia);
      if (background) background.inert = false;
      html.style.overflow = prevOverflow;
    };
  }, [open, closeMenu]);

  async function signOut() {
    setLeaving(true);
    await logout();
  }

  return (
    <div className="admin-layout" data-menu-open={open}>
      <AdminSidebar ref={sidebarRef} open={open} onClose={closeMenu} />
      {open && <div className="admin-backdrop" aria-hidden="true" onClick={closeMenu} />}
      <div ref={mainRef} className="admin-body">
        <header className="admin-topbar">
          <button
            ref={toggleRef}
            type="button"
            className="admin-menu-btn"
            aria-expanded={open}
            aria-controls="admin-sidebar"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} aria-hidden="true" /> Menu
          </button>
          <h1>{adminPageTitle(path)}</h1>
          <div className="admin-topbar-user">
            <p><strong>{user?.name}</strong><span>{user ? roleLabels[user.role] : ""}</span></p>
            <div className="admin-actions">
              <Link href="/" className="btn btn-secondary">Lihat website <ArrowUpRight size={22} aria-hidden="true" /></Link>
              <button id="staff-logout" type="button" className="btn btn-secondary" disabled={leaving} onClick={() => void signOut()}>
                <LogOut size={22} aria-hidden="true" /> Keluar
              </button>
            </div>
          </div>
        </header>
        <main id="main" className="admin-main">{children}</main>
      </div>
    </div>
  );
}
