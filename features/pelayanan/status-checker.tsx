"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Search, LoaderCircle, CircleAlert, CircleX } from "lucide-react";
import { pelayananService, isDemo } from "@/services/pelayanan";
import type { StatusReceipt } from "@/types/pelayanan";
import { letterSteps, requiresNeighborhoodApproval } from "@/lib/letter-workflow";
import { StatusBadge, statusDescriptions } from "@/components/site";
export function StatusChecker() {
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") || "");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<StatusReceipt | null>(null);
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
  const steps = result?.jenis_surat ? letterSteps(result.jenis_surat) : [];
  const current = result ? steps.findIndex((s) => s[0] === result.status) : -1;
  const exception =
    result && ["REJECTED", "NEED_REVISION"].includes(result.status);
  return (
    <div className="center-card status-card">
      <h2>Masukkan bukti pengajuan</h2>
      <p className="lookup-intro" id="lookup-help">
        {isDemo ? "Masukkan nomor yang diterima setelah mengirim formulir." : "Masukkan nomor pengajuan dan kode akses rahasia yang diberikan setelah pengiriman."}
      </p>
      <form
        className="lookup-form"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(id.trim().toUpperCase());
        }}
      >
        <div className="lookup-field">
          <label htmlFor="request-id">Nomor pengajuan</label>
          <input
            id="request-id"
            className="search-input"
            value={id}
            onChange={(e) => setId(e.target.value.toUpperCase())}
            placeholder="REQ-2026-000001"
            required
            aria-describedby={error ? "lookup-help lookup-error" : "lookup-help"}
          />
        </div>
        {!isDemo && (
          <div className="lookup-field">
            <label htmlFor="lookup-secret">Kode akses pengajuan</label>
            <input id="lookup-secret" className="search-input" type="password" autoComplete="off" placeholder="WAD-1234-5678" value={secret} onChange={(e) => setSecret(e.target.value)} required aria-describedby={error ? "lookup-help lookup-error" : "lookup-help"} />
          </div>
        )}
        <button id="lookup-submit" type="submit" className="btn" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={22} aria-hidden="true" />
          ) : (
            <Search size={22} aria-hidden="true" />
          )}{" "}
          {busy ? "Mencari…" : "Cek Status Surat"}
        </button>
      </form>
      {!isDemo && <p className="lookup-intro">Lupa kode akses? Datang ke Ketua RT/RW atau kantor desa dengan membawa KTP/KK untuk dibuatkan kode baru.</p>}
      {isDemo && (
        <div className="notice mt-5">
          <strong>Mode simulasi — bukan layanan resmi.</strong>
          <p>Status tidak berubah otomatis. Nomor dari formulir hanya tersimpan di browser ini.</p>
          <details className="lookup-examples">
            <summary>Lihat nomor contoh untuk mencoba status</summary>
            <ul>
              <li>REQ-2026-000001 — Diproses</li>
              <li>REQ-2026-000002 — Perlu perbaikan</li>
              <li>REQ-2026-000003 — Disetujui</li>
              <li>REQ-2026-000004 — Ditolak</li>
              <li>REQ-2026-000005 — Siap diambil</li>
              <li>REQ-2026-000006 — Selesai</li>
              <li>REQ-2026-000007 — Disetujui RT (contoh SKTM)</li>
              <li>REQ-2026-000008 — Disetujui RW (contoh SKTM)</li>
            </ul>
          </details>
        </div>
      )}
      {error && (
        <div id="lookup-error" className="error-box" role="alert">
          <CircleAlert size={24} aria-hidden="true" />
          <span>{error}</span>
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
        <section aria-live="polite" className="lookup-result" aria-labelledby="lookup-result-heading">
          <h2 id="lookup-result-heading">Status pengajuan Anda</h2>
          <div className="lookup-result-header">
            <strong className="receipt-value">{result.request_id}</strong>
            <StatusBadge status={result.status} jenisSurat={result.jenis_surat} />
          </div>
          {exception ? (
            <div className={"status-exception status-" + result.status}>
              <div className="status-exception-heading">
                {result.status === "REJECTED" ? <CircleX size={24} aria-hidden="true" /> : <CircleAlert size={24} aria-hidden="true" />}
                <h3>{result.status === "REJECTED" ? "Pengajuan ditolak" : "Pengajuan perlu diperbaiki"}</h3>
              </div>
              <p>{result.status === "SUBMITTED" && requiresNeighborhoodApproval(result.jenis_surat) ? "Permohonan menunggu verifikasi Ketua RT, lalu Ketua RW, sebelum masuk kantor desa." : statusDescriptions[result.status]}</p>
              <h3>Catatan petugas</h3>
              <p className="officer-note">{result.catatan || "Catatan belum tersedia. Hubungi kantor desa untuk penjelasan."}</p>
              <Link href="/kontak" className="text-link">Lihat Kontak Kantor</Link>
            </div>
          ) : (
            <>
              <div className="status-next-step">
                <h3>Langkah berikutnya</h3>
                <p>{result.status === "SUBMITTED" && requiresNeighborhoodApproval(result.jenis_surat) ? "Permohonan menunggu verifikasi Ketua RT, lalu Ketua RW, sebelum masuk kantor desa." : statusDescriptions[result.status]}</p>
                {(result.status === "APPROVED" || result.status === "READY_FOR_PICKUP") && <Link href="/kontak" className="text-link">Lihat Kontak Kantor</Link>}
              </div>
              {!result.jenis_surat && <p>Jenis surat tidak tersimpan pada bukti simulasi lama ini; linimasa tidak tersedia.</p>}
              <ol className="timeline" aria-label="Tahap pengajuan sesuai jenis surat">
                {steps.map(([code, label, description], index) => (
                  <li
                    className={`${index <= current ? "complete" : ""} ${index === current ? "current" : ""}`}
                    key={code}
                    aria-current={index === current ? "step" : undefined}
                  >
                    <span className="timeline-dot" aria-hidden="true">
                      {index <= current ? <Check size={22} /> : index + 1}
                    </span>
                    <div>
                      <strong>{label}</strong>
                      <span className="timeline-state">{index === current ? "Tahap saat ini" : index < current ? "Sudah dilalui" : "Belum dimulai"}</span>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}
    </div>
  );
}
