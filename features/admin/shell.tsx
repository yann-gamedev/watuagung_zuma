"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, KeyRound, LogOut, Menu } from "lucide-react";
import { apiBase } from "@/services/pelayanan";
import { AdminSidebar, adminPageTitle } from "@/components/admin-sidebar";
import { normalizePath } from "@/components/site-header";
import { AdminLoginForm } from "./login-form";
import { ChangePasswordForm } from "./change-password";
import { useAdminSession } from "./session";
import styles from "./neighborhood.module.css";

const roleLabels = { staff: "Petugas", village_head: "Kepala Desa", admin: "Admin", rt_head: "Ketua RT", rw_head: "Ketua RW" } as const;
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
  if (session.user.must_change_password) return <ForcedPasswordChange />;
  return <AdminFrame>{children}</AdminFrame>;
}

/** Akun dengan kata sandi sementara tidak boleh memakai panel sebelum menggantinya. */
function ForcedPasswordChange() {
  const { logout } = useAdminSession();
  return (
    <CenterScreen>
      <div className="center-card admin-login">
        <h1>Buat kata sandi baru</h1>
        <p>Kata sandi sementara hanya berlaku untuk masuk pertama. Buat kata sandi sendiri minimal 10 karakter sebelum memakai panel.</p>
        <ChangePasswordForm />
        <button type="button" className="btn btn-secondary mt-4" onClick={() => void logout()}>Keluar</button>
      </div>
    </CenterScreen>
  );
}

function AdminFrame({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAdminSession();
  const path = normalizePath(usePathname());
  const [open, setOpen] = useState(false);
  const [prevPath, setPrevPath] = useState(path);
  const [leaving, setLeaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const passwordDialogRef = useRef<HTMLDialogElement>(null);

  // <dialog> native: fokus masuk, Esc menutup, dan fokus kembali otomatis.
  useEffect(() => {
    const dialog = passwordDialogRef.current;
    if (!dialog) return;
    if (passwordOpen && !dialog.open) dialog.showModal();
    if (!passwordOpen && dialog.open) dialog.close();
  }, [passwordOpen]);

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
    <div className={`admin-layout ${user?.role === "rt_head" || user?.role === "rw_head" ? styles.neighborhood : ""}`} data-menu-open={open}>
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
            <p><strong>{user?.name}</strong><span>{user?.role === "rt_head" ? `Ketua RT ${user.rt ?? "—"} / RW ${user.rw ?? "—"}` : user?.role === "rw_head" ? `Ketua RW ${user.rw ?? "—"}` : user ? roleLabels[user.role] : ""}</span></p>
            <div className="admin-actions">
              <Link href="/" className="btn btn-secondary">Lihat website <ArrowUpRight size={22} aria-hidden="true" /></Link>
              <details className="admin-account-menu">
                <summary className="btn btn-secondary"><KeyRound size={22} aria-hidden="true" /> Akun</summary>
                <div className="admin-account-panel">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={(event) => {
                      setPasswordOpen(true);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                  >Ganti kata sandi</button>
                </div>
              </details>
              <button id="staff-logout" type="button" className="btn btn-secondary" disabled={leaving} onClick={() => void signOut()}>
                <LogOut size={22} aria-hidden="true" /> Keluar
              </button>
            </div>
          </div>
        </header>
        <main id="main" className="admin-main">{children}</main>
      </div>
      <dialog ref={passwordDialogRef} className="admin-dialog" aria-labelledby="admin-password-title" onClose={() => setPasswordOpen(false)}>
        <h2 id="admin-password-title">Ganti kata sandi</h2>
        <p>Setelah kata sandi diganti, sesi lain milik akun ini akan keluar.</p>
        <ChangePasswordForm onDone={() => setPasswordOpen(false)} />
        <button type="button" className="btn btn-secondary mt-4" onClick={() => setPasswordOpen(false)}>Tutup</button>
      </dialog>
    </div>
  );
}
