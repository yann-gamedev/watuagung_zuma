"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Search, LoaderCircle, CircleAlert, CircleX, Download } from "lucide-react";
import { HubungiPetugas } from "@/components/hubungi-petugas";
import { pelayananService, isDemo, SubmissionValidationError } from "@/services/pelayanan";
import { services } from "@/lib/data";
import { attachmentKinds, attachmentKindLabels, type AttachmentKind, type SubmissionAttachments, type StatusReceipt } from "@/types/pelayanan";
import { DocumentUpload } from "./document-upload";
import { letterSteps, timelineStatus } from "@/lib/letter-workflow";
import { StatusBadge, statusDescriptions } from "@/components/site";
export function StatusChecker() {
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") || "");
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<StatusReceipt | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [downloadNotice, setDownloadNotice] = useState("");
  const downloadingRef = useRef(false);
  const [replacement, setReplacement] = useState(false);
  const [files, setFiles] = useState<Partial<SubmissionAttachments>>({});
  const [documentErrors, setDocumentErrors] = useState<Partial<Record<AttachmentKind, string>>>({});
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [replacementError, setReplacementError] = useState("");
  const [replacementSuccess, setReplacementSuccess] = useState("");
  const verifiedSecret = useRef("");
  const replacementPanel = useRef<HTMLDivElement>(null);
  const replaceButton = useRef<HTMLButtonElement>(null);
  const replaceAlert = useRef<HTMLDivElement>(null);
  useEffect(() => { if (replacement) replacementPanel.current?.querySelector<HTMLElement>("h2")?.focus(); }, [replacement]);
  useEffect(() => { if (replacementError) replaceAlert.current?.focus(); }, [replacementError]);
  async function replaceDocuments() {
    if (!result || uploading || processing) return;
    setReplacementError("");
    if (!attachmentKinds.some((kind) => files[kind]) || attachmentKinds.some((kind) => documentErrors[kind])) {
      setReplacementError("Pilih minimal satu dokumen yang akan diganti dan periksa dokumen yang ditandai.");
      return;
    }
    setUploading(true);
    setProgress(null);
    try {
      const updated = await pelayananService.replaceAttachments(result.request_id, verifiedSecret.current, files, setProgress);
      setResult((previous) => previous ? { ...previous, ...updated } : updated);
      setFiles({});
      setReplacement(false);
      setReplacementSuccess("Dokumen pengganti sudah diterima. Status tetap Perlu perbaikan sampai petugas memeriksa kembali.");
      setTimeout(() => replaceButton.current?.focus(), 0);
    } catch (error) {
      if (error instanceof SubmissionValidationError) setDocumentErrors(Object.fromEntries(attachmentKinds.map((kind) => [kind, error.errors[`lampiran.${kind}`]?.join(" ") || ""])));
      setReplacementError(error instanceof Error ? error.message : "Gagal mengganti dokumen. Coba lagi.");
    } finally { setUploading(false); }
  }
  async function downloadLetter() {
    if (!result?.letter_available || downloadingRef.current) return;
    downloadingRef.current = true;
    setDownloading(true); setDownloadError(""); setDownloadNotice("");
    let downloaded = false;
    try {
      const blob = await pelayananService.downloadLetter(result.request_id, verifiedSecret.current);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `Surat-${result.request_id}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      downloaded = true;
      setDownloadNotice("Unduhan dimulai. Surat tetap bisa diunduh ulang selama masa berlaku.");
      setResult(await pelayananService.getStatus(result.request_id, verifiedSecret.current));
    } catch (error) {
      setDownloadError(downloaded ? "Unduhan dimulai, tetapi status gagal dimuat ulang. Cek status kembali." : error instanceof Error ? error.message : "Gagal mengunduh surat. Coba lagi atau hubungi petugas.");
      if (!downloaded) {
        setCheckedAt(Date.now());
        try { setResult(await pelayananService.getStatus(result.request_id, verifiedSecret.current)); } catch { /* Keep verified receipt and retry available. */ }
      }
    } finally { downloadingRef.current = false; setDownloading(false); }
  }
  async function lookup(value: string) {
    if (busy || uploading || processing || downloadingRef.current) return;
    setError(""); setDownloadError(""); setDownloadNotice("");
    setReplacement(false);
    setFiles({});
    setDocumentErrors({});
    setReplacementError("");
    setReplacementSuccess("");
    verifiedSecret.current = "";
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
      setCheckedAt(Date.now());
      const lookupSecret = secret.trim();
      setResult(await pelayananService.getStatus(value, lookupSecret));
      verifiedSecret.current = lookupSecret;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status.");
    } finally {
      setBusy(false);
    }
  }
  // Batas berlaku (V2) sama dengan batas unduh; demo hanya punya batas unduh.
  const validUntil = result?.valid_until || result?.letter_available_until || "";
  const deadline = validUntil ? new Date(validUntil).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }) + " WIB" : "";
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const expired = !!result && !result.letter_available && [result.valid_until, result.letter_available_until].some((value) => !!value && Date.parse(value) < checkedAt);
  const expiredText = "Masa berlaku surat sudah habis. Ajukan ulang bila masih diperlukan.";
  const describe = (text: string) => text.replace("{tanggal}", deadline || "tanggal yang tertera pada surat");
  const steps = result?.jenis_surat ? letterSteps(result.requires_neighborhood_approval) : [];
  const current = result ? steps.findIndex((s) => s[0] === timelineStatus(result.status)) : -1;
  // Tahap terakhir tercapai = alur selesai; semua tahap ditandai sudah dilalui.
  const finished = current >= 0 && current === steps.length - 1;
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
        <button id="lookup-submit" type="submit" className="btn" disabled={busy || processing || uploading || downloading}>
          {busy ? (
            <LoaderCircle className="spin" size={22} aria-hidden="true" />
          ) : (
            <Search size={22} aria-hidden="true" />
          )}{" "}
          {busy ? "Mencari…" : "Cek Status Surat"}
        </button>
      </form>
      {!isDemo && <p className="lookup-intro">Lupa kode akses? Minta kode baru ke kantor desa dengan membawa KTP/KK.</p>}
      {isDemo && (
        <div className="notice mt-5">
          <strong>Mode simulasi — bukan layanan resmi.</strong>
          <p>Status tidak berubah otomatis. Nomor dari formulir hanya tersimpan di browser ini.</p>
          <details className="lookup-examples">
            <summary>Lihat nomor contoh untuk mencoba status</summary>
            <ul>
              <li>REQ-2026-000001 — Diproses</li>
              <li>REQ-2026-000002 — Perlu perbaikan</li>
              <li>REQ-2026-000003 — Selesai (contoh data lama berstatus Disetujui)</li>
              <li>REQ-2026-000004 — Ditolak</li>
              <li>REQ-2026-000005 — Selesai, siap diunduh (PDF simulasi)</li>
              <li>REQ-2026-000006 — Selesai, sudah diunduh</li>
              <li>REQ-2026-000007 — Diterima (contoh SKTM)</li>
              <li>REQ-2026-000008 — Diverifikasi (contoh domisili)</li>
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
          {result.jenis_surat && <p>Jenis surat: <strong>{services.find((service) => service.code === result.jenis_surat)?.title || result.jenis_surat}</strong></p>}
          <div className="lookup-result-header">
            <strong className="receipt-value">{result.request_id}</strong>
            <StatusBadge citizen status={result.status} neighborhoodApproval={result.requires_neighborhood_approval} />
          </div>
          {result.letter_number && ["APPROVED", "READY_FOR_PICKUP", "COMPLETED"].includes(result.status) && <div className="status-next-step">
            <h3>Nomor surat</h3><p className="receipt-value">{result.letter_number}</p>
            {result.letter_number.includes("[PLACEHOLDER]") && <p>Format nomor masih sementara, menunggu ketentuan resmi desa.</p>}
          </div>}
          {result.letter_available && <div className="status-next-step">
            <h3>Unduh surat Anda</h3>
            {isDemo && <p>PDF simulasi, bukan surat resmi; tanpa QR verifikasi resmi.</p>}
            <button type="button" className="btn mt-4" disabled={downloading} onClick={() => void downloadLetter()}><Download size={24} aria-hidden="true" />{downloading ? "Mengunduh…" : "Unduh surat (PDF)"}</button>
            {deadline && <p>Berlaku sampai <strong>{deadline}</strong>. Unduh dan cetak sebelum tanggal ini.</p>}
            <p>Cetak di kertas A4. Penerima surat dapat memindai QR di surat untuk memeriksa keasliannya.</p>
          </div>}
          {expired && <p className="notice mt-4" role="status">{expiredText}</p>}
          {downloadError && <p className="error-box" role="alert">{downloadError}</p>}
          {downloadNotice && <p className="notice mt-4" role="status">{downloadNotice}</p>}
          {exception ? (
            <div className={"status-exception status-" + result.status}>
              <div className="status-exception-heading">
                {result.status === "REJECTED" ? <CircleX size={24} aria-hidden="true" /> : <CircleAlert size={24} aria-hidden="true" />}
                <h3>{result.status === "REJECTED" ? "Pengajuan ditolak" : "Pengajuan perlu diperbaiki"}</h3>
              </div>
              <p>{result.status === "SUBMITTED" && result.requires_neighborhood_approval ? "Permohonan menunggu verifikasi Ketua RT, lalu Ketua RW, sebelum masuk kantor desa." : expired ? expiredText : result.status === "READY_FOR_PICKUP" && !result.letter_available ? "Berkas surat belum tersedia untuk diunduh. Hubungi Petugas untuk bantuan." : describe(statusDescriptions[result.status])}</p>
              <h3>Catatan petugas</h3>
              <p className="officer-note">{result.catatan || "Catatan belum tersedia. Hubungi kantor desa untuk penjelasan."}</p>
              <Link href="/kontak" className="text-link">Lihat Kontak Kantor</Link>
              {result.status === "NEED_REVISION" && !isDemo && <button ref={replaceButton} type="button" className="btn btn-secondary mt-4" disabled={replacement || uploading} onClick={() => { setReplacement(true); setReplacementSuccess(""); }}>Ganti dokumen</button>}
            </div>
          ) : (
            <>
              <div className="status-next-step">
                <h3>{finished ? "Keterangan" : "Langkah berikutnya"}</h3>
                <p>{result.status === "SUBMITTED" && result.requires_neighborhood_approval ? "Permohonan menunggu verifikasi Ketua RT, lalu Ketua RW, sebelum masuk kantor desa." : expired ? expiredText : result.status === "READY_FOR_PICKUP" && !result.letter_available ? "Berkas surat belum tersedia untuk diunduh. Hubungi Petugas untuk bantuan." : describe(statusDescriptions[result.status])}</p>
                {(result.status === "APPROVED" || result.status === "READY_FOR_PICKUP") && <Link href="/kontak" className="text-link">Lihat Kontak Kantor</Link>}
              </div>
              {!result.jenis_surat && <p>Jenis surat tidak tersimpan pada bukti simulasi lama ini; linimasa tidak tersedia.</p>}
              <ol className="timeline" aria-label="Tahap pengajuan sesuai jenis surat">
                {steps.map(([code, label, description], index) => (
                  <li
                    className={`${index <= current ? "complete" : ""} ${index === current && !finished ? "current" : ""}`}
                    key={code}
                    aria-current={index === current && !finished ? "step" : undefined}
                  >
                    <span className="timeline-dot" aria-hidden="true">
                      {index <= current ? <Check size={22} /> : index + 1}
                    </span>
                    <div>
                      <strong>{label}</strong>
                      <span className="timeline-state">{index === current ? (finished ? "Selesai" : "Tahap saat ini") : index < current ? "Sudah dilalui" : "Belum dimulai"}</span>
                      <p>{code === "READY_FOR_PICKUP" && index > current ? "Setelah Kepala Desa menyetujui, surat langsung bisa diunduh dan dicetak sendiri. Berlaku 7 hari." : code === "READY_FOR_PICKUP" && expired ? "Masa berlaku surat sudah habis." : code === "READY_FOR_PICKUP" && result.status === "APPROVED" ? statusDescriptions.APPROVED : describe(description)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
          {replacementSuccess && <p className="notice mt-4" role="status">{replacementSuccess}</p>}
          {replacement && result.status === "NEED_REVISION" && <div ref={replacementPanel} className="application-form mt-6">
            <form className="form-card" aria-busy={uploading || processing} onSubmit={(event) => { event.preventDefault(); void replaceDocuments(); }}>
              <DocumentUpload replacement files={files} errors={documentErrors} busy={processing || uploading} onBusy={setProcessing} onChange={(kind, file) => { setFiles((previous) => ({ ...previous, [kind]: file })); setDocumentErrors((previous) => ({ ...previous, [kind]: "" })); setReplacementError(""); }} onError={(kind, message) => setDocumentErrors((previous) => ({ ...previous, [kind]: message }))} />
              {attachmentKinds.some((kind) => files[kind]) && <p className="form-help">Dokumen pengganti: {attachmentKinds.filter((kind) => files[kind]).map((kind) => attachmentKindLabels[kind]).join(", ")}.</p>}
              {replacementError && <div ref={replaceAlert} className="error-box my-4" role="alert" tabIndex={-1}>{replacementError}</div>}
              {uploading && <div role="status"><p>{progress === null ? "Mengunggah…" : `Mengunggah: ${progress}%${progress === 100 ? ". Menunggu konfirmasi penerimaan…" : ""}`}</p><progress aria-label="Progres unggah dokumen pengganti" max={100} value={progress ?? undefined} /></div>}
              <div className="flex flex-wrap gap-3 mt-4">
                <button className="btn" type="submit" disabled={processing || uploading}>{uploading ? "Mengirim…" : "Kirim dokumen pengganti"}</button>
                <button className="btn btn-secondary" type="button" disabled={processing || uploading} onClick={() => { setReplacement(false); setFiles({}); setDocumentErrors({}); setReplacementError(""); setTimeout(() => replaceButton.current?.focus(), 0); }}>Batal</button>
              </div>
            </form>
          </div>}
        </section>
      )}
      <HubungiPetugas requestId={result?.request_id} />
    </div>
  );
}
