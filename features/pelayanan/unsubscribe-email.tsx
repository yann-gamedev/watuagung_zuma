"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isDemo, pelayananService } from "@/services/pelayanan";

export function UnsubscribeEmail() {
  const [query, setQuery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const successHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (success) successHeading.current?.focus(); }, [success]);
  useEffect(() => {
    const rawQuery = window.location.search;
    const params = new URLSearchParams(rawQuery);
    const valid = params.getAll("id").length === 1 && params.getAll("signature").length === 1 && !!params.get("id") && !!params.get("signature");
    queueMicrotask(() => setQuery(valid ? rawQuery : ""));
  }, []);
  async function unsubscribe() {
    if (!query || busy || success) return;
    setBusy(true);
    setError("");
    try {
      await pelayananService.unsubscribeEmail(query);
      setSuccess(true);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Belum berhasil berhenti menerima email. Coba lagi nanti.");
    } finally { setBusy(false); }
  }
  return (
    <div className="center-card" aria-busy={busy}>
      {isDemo ? <p>Mode simulasi. Email pemberitahuan tidak dikirim. Tidak ada langganan email yang diubah.</p> : success ? <div role="status"><h2 ref={successHeading} tabIndex={-1}>Email pemberitahuan dihentikan</h2><p>Anda tidak lagi menerima email untuk permohonan ini. Permohonan tetap diproses. Pantau melalui Cek Status Surat.</p></div> : <>
        <p>Permohonan tetap diproses meskipun Anda berhenti menerima email. Anda tetap bisa mengecek status dengan nomor pengajuan dan kode akses.</p>
        {query === null ? <p role="status">Memeriksa tautan…</p> : !query ? <p role="alert" className="error-box">Tautan tidak lengkap. Gunakan tautan berhenti menerima email dari email pemberitahuan.</p> : <button className="btn my-5 mr-3" type="button" disabled={busy} onClick={() => void unsubscribe()}>{busy ? "Memproses…" : "Berhenti menerima email"}</button>}
        {error && <p className="error-box" role="alert">{error}</p>}
      </>}
      <Link href="/pelayanan/status/" className="btn btn-secondary mt-5">Cek Status Surat</Link>
    </div>
  );
}
