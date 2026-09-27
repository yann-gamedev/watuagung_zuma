"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Search, LoaderCircle } from "lucide-react";
import { pelayananService, isDemo } from "@/services/pelayanan";
import type { Receipt } from "@/types/pelayanan";
import { StatusBadge } from "@/components/site";
const steps = [
  ["SUBMITTED", "Pengajuan diterima", "Data permohonan berhasil diterima."],
  [
    "VERIFIED",
    "Verifikasi perangkat desa",
    "Petugas memeriksa kelengkapan data.",
  ],
  ["PROCESSING", "Pembuatan surat", "Surat sedang disiapkan."],
  ["WAITING_APPROVAL", "Persetujuan", "Menunggu persetujuan pejabat desa."],
  ["APPROVED", "Selesai", "Permohonan telah disetujui."],
] as const;
export function StatusChecker() {
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") || "");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<(Receipt & { catatan?: string | null }) | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function lookup(value: string) {
    setError("");
    setResult(null);
    if (!/^REQ-\d{4}-[A-Z0-9]{6,36}$/.test(value)) {
      setError("Gunakan nomor pengajuan yang valid, misalnya REQ-2026-000001.");
      return;
    }
    if (!isDemo && !secret.trim()) {
      setError("Masukkan kode akses pengajuan.");
      return;
    }
    setBusy(true);
    try {
      setResult(await pelayananService.getStatus(value, secret.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status.");
    } finally {
      setBusy(false);
    }
  }
  const current = result ? steps.findIndex((s) => s[0] === result.status) : -1;
  const exception =
    result && ["REJECTED", "NEED_REVISION"].includes(result.status);
  return (
    <div className="center-card">
      <h2 className="text-2xl">Lacak permohonan Anda</h2>
      <p className="mt-3 mb-5 text-sm">
        {isDemo ? "Masukkan nomor yang diterima setelah mengirim formulir." : "Masukkan nomor pengajuan dan kode akses rahasia yang diberikan setelah pengiriman."}
      </p>
      <label htmlFor="request-id" className="text-sm font-semibold">
        Nomor pengajuan
      </label>
      <form
        className="lookup-form"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(id.trim().toUpperCase());
        }}
      >
        <input
          id="request-id"
          className="search-input"
          value={id}
          onChange={(e) => setId(e.target.value.toUpperCase())}
          placeholder="REQ-2026-000001"
          required
          aria-describedby={error ? "lookup-error" : undefined}
        />
        {!isDemo && <div><label htmlFor="lookup-secret" className="text-sm font-semibold">Kode akses pengajuan</label><input id="lookup-secret" className="search-input" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} required /></div>}
        <button id="lookup-submit" className="btn" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Search size={18} />
          )}{" "}
          {busy ? "Mencari…" : "Cek Status"}
        </button>
      </form>
      {isDemo && (
        <div className="notice mt-5">
          Simulasi: coba REQ-2026-000001 (diproses), 000002 (perbaikan), 000003
          (selesai), atau 000004 (ditolak). Nomor dari formulir hanya tersimpan
          di browser ini.
        </div>
      )}
      {error && (
        <div id="lookup-error" className="error-box" role="alert">
          {error}
        </div>
      )}
      {busy && (
        <div
          className="skeleton"
          role="status"
          aria-label="Memuat status permohonan"
        />
      )}
      {result && (
        <div aria-live="polite" className="mt-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <strong className="break-all">{result.request_id}</strong>
            <StatusBadge status={result.status} />
          </div>
          {exception ? (
            <div className="error-box">
              <strong>
                {result.status === "REJECTED"
                  ? "Permohonan ditolak"
                  : "Permohonan memerlukan perbaikan"}
              </strong>
              <p className="mt-2">
                {result.catatan ||
                  "Hubungi petugas desa untuk informasi selanjutnya."}
              </p>
              <Link href="/kontak" className="text-link mt-3">
                Informasi kontak desa
              </Link>
            </div>
          ) : (
            <ol className="timeline">
              {steps.map(([code, title, description], index) => (
                <li
                  className={`${index <= current ? "complete" : ""} ${index === current ? "current" : ""}`}
                  key={code}
                  aria-current={index === current ? "step" : undefined}
                >
                  <span className="timeline-dot">
                    {index <= current ? <Check size={17} /> : index + 1}
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>
                      {description}
                      {index > current ? " · Belum dimulai" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {result.status === "APPROVED" && (
            <p className="notice mt-4">
              Permohonan disetujui. Surat atau PDF belum tersedia; hubungi petugas desa untuk informasi selanjutnya.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
