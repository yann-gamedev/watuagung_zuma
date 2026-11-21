"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isDemo } from "@/services/pelayanan";
import { adminHref, isAbsoluteHref } from "@/lib/urls";
import { ApprovalError, approvalService } from "@/services/approval";

const REQUIRED = ["user", "email", "expires", "signature"] as const;

// Panel bisa di subdomain (NEXT_PUBLIC_ADMIN_URL); lintas origin memakai <a> biasa di tab yang sama.
const settingsHref = adminHref("/admin/notifikasi/");

/**
 * Konfirmasi email notifikasi akun (tautan bertanda tangan 24 jam dari E3). Tidak perlu login.
 * Verifikasi baru terjadi setelah tombol ditekan, bukan saat halaman dibuka (pemindai tautan email).
 */
export function VerifyNotificationEmail() {
  const [query, setQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const read = useRef(false);
  useEffect(() => { if (done) heading.current?.focus(); }, [done]);
  useEffect(() => {
    // Sekali saja: efek bisa berjalan dua kali (StrictMode), sementara query sudah dihapus dari address bar.
    if (read.current) return;
    read.current = true;
    const raw = window.location.search;
    const params = new URLSearchParams(raw);
    const valid = REQUIRED.every((key) => params.getAll(key).length === 1 && !!params.get(key));
    window.history.replaceState(null, "", window.location.pathname);
    queueMicrotask(() => setQuery(valid ? raw : ""));
  }, []);

  async function verify() {
    if (!query || busy || done) return;
    setBusy(true);
    setError("");
    try {
      await approvalService.verifyEmail(query);
      setDone(true);
    } catch (failure) {
      setError(failure instanceof ApprovalError && failure.status === 403
        ? "Tautan tidak valid atau sudah lebih dari 24 jam. Kirim ulang tautan dari panel (menu Akun → Notifikasi email)."
        : failure instanceof Error ? failure.message : "Email belum dapat dikonfirmasi. Coba lagi.");
    } finally { setBusy(false); }
  }

  return (
    <div className="center-card" aria-busy={busy}>
      {isDemo ? <p>Mode simulasi. Panel petugas dan email notifikasi tidak aktif pada demo.</p> : done ? (
        <div role="status"><h2 ref={heading} tabIndex={-1}>Email terkonfirmasi</h2><p>Notifikasi akun akan dikirim ke alamat ini. Bila Anda Kepala Desa, pastikan PIN persetujuan sudah diatur di panel.</p></div>
      ) : <>
        <p>Tekan tombol di bawah untuk mengonfirmasi bahwa alamat email ini milik Anda.</p>
        {query === null ? <p role="status">Memeriksa tautan…</p> : !query
          ? <p role="alert" className="error-box">Tautan tidak lengkap. Gunakan tombol Konfirmasi email dari email terbaru.</p>
          : <button className="btn my-5 mr-3" type="button" disabled={busy} onClick={() => void verify()}>{busy ? "Memproses…" : "Konfirmasi email"}</button>}
        {error && <p className="error-box" role="alert">{error}</p>}
      </>}
      {isAbsoluteHref(settingsHref)
        ? <a href={settingsHref} className="btn btn-secondary mt-5">Buka pengaturan notifikasi</a>
        : <Link href={settingsHref} className="btn btn-secondary mt-5">Buka pengaturan notifikasi</Link>}
    </div>
  );
}
