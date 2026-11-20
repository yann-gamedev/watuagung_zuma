"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { isDemo } from "@/services/pelayanan";
import { ApprovalError, approvalService } from "@/services/approval";
import type { ApprovalDecisionResponse, ApprovalPreview } from "@/types/pelayanan";
import styles from "./approval.module.css";

type Decision = "approve" | "reject";
type Phase = "reading" | "missing" | "loading" | "ready" | "gone" | "error" | "done";

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
const dateOnly = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

/**
 * Halaman konfirmasi persetujuan Kepala Desa dari tautan email (E4). Membuka halaman ini tidak pernah mengubah
 * status (pemindai tautan email ikut membuka); keputusan hanya setelah PIN dan dialog konfirmasi.
 * Token dibaca sekali dari `?t=`, lalu dihapus dari address bar dan hanya disimpan di memori.
 */
export function ApprovalPage() {
  const id = useId();
  const token = useRef("");
  const dialog = useRef<HTMLDialogElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const [phase, setPhase] = useState<Phase>("reading");
  const [preview, setPreview] = useState<ApprovalPreview | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [goneMessage, setGoneMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [result, setResult] = useState<ApprovalDecisionResponse | null>(null);

  const read = useRef(false);
  useEffect(() => {
    // Sekali saja: efek bisa berjalan dua kali (StrictMode), sementara token sudah dihapus dari address bar.
    if (read.current) return;
    read.current = true;
    const params = new URLSearchParams(window.location.search);
    const value = params.get("t") ?? "";
    const choice = params.get("pilih");
    // Token tidak boleh tertinggal di riwayat browser atau ikut tersalin bersama alamat halaman.
    window.history.replaceState(null, "", window.location.pathname);
    token.current = value;
    queueMicrotask(() => {
      setDecision(choice === "setuju" ? "approve" : choice === "tolak" ? "reject" : null);
      if (isDemo) return setPhase("ready");
      if (!value || value.length > 100) return setPhase("missing");
      setPhase("loading");
      approvalService.preview(value).then((data) => { setPreview(data); setPhase("ready"); }).catch(fail);
    });
  }, []);

  useEffect(() => { if (phase === "done") resultHeading.current?.focus(); }, [phase]);

  function fail(failure: unknown) {
    if (failure instanceof ApprovalError && (failure.status === 410 || failure.status === 423)) {
      setGoneMessage(failure.status === 423 ? failure.message : "");
      setPhase("gone");
      return;
    }
    setError(failure instanceof Error ? failure.message : "Halaman belum dapat dimuat. Coba lagi.");
    setPhase((current) => (current === "loading" ? "error" : current));
  }

  async function openDraft() {
    if (draftBusy) return;
    setDraftBusy(true);
    setError("");
    // Tab dibuka saat klik agar tidak diblokir; isinya diganti blob setelah draf diterima.
    const tab = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(await approvalService.draft(token.current));
      if (tab) tab.location.href = url; else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (failure) {
      tab?.close();
      fail(failure);
    } finally { setDraftBusy(false); }
  }

  function review(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!decision) return setError("Pilih Setuju atau Tolak.");
    if (decision === "reject" && !note.trim()) return setError("Alasan penolakan wajib diisi.");
    if (!/^[0-9]{6}$/.test(pin)) return setError("PIN harus 6 digit angka.");
    dialog.current?.showModal();
  }

  async function confirm() {
    if (!decision || busy) return;
    setBusy(true);
    try {
      const response = await approvalService.decide({ token: token.current, pin, decision, ...(decision === "reject" ? { note: note.trim() } : {}) });
      dialog.current?.close();
      token.current = "";
      setPin("");
      setResult(response);
      setPhase("done");
    } catch (failure) {
      dialog.current?.close();
      setPin("");
      if (failure instanceof ApprovalError && failure.attemptsLeft !== undefined && preview) setPreview({ ...preview, pin_attempts_left: failure.attemptsLeft });
      fail(failure);
    } finally { setBusy(false); }
  }

  if (isDemo) {
    return <div className="center-card"><p>Mode simulasi. Persetujuan lewat email tidak tersedia pada demo; tidak ada permohonan yang diubah.</p></div>;
  }
  if (phase === "reading" || phase === "loading") return <div className="center-card" aria-busy="true"><p role="status">Memeriksa tautan…</p></div>;
  if (phase === "missing") {
    return <div className="center-card"><p className="error-box" role="alert">Tautan tidak lengkap. Buka tombol <strong>Tinjau dan putuskan</strong> dari email permintaan persetujuan.</p><PanelLink /></div>;
  }
  if (phase === "gone") {
    return (
      <div className="center-card" role="alert">
        <h2>Tautan sudah tidak berlaku</h2>
        {goneMessage && <p>{goneMessage}</p>}
        <p>Tautan sudah dipakai, kedaluwarsa, dikunci, atau status permohonan sudah berubah. Buka panel admin untuk melihat dan memutuskan permohonan.</p>
        <PanelLink />
      </div>
    );
  }
  if (phase === "error") return <div className="center-card"><p className="error-box" role="alert">{error}</p><PanelLink /></div>;
  if (phase === "done" && result) {
    const approved = result.status === "APPROVED";
    return (
      <div className={`center-card ${styles.result}`} role="status">
        <h2 ref={resultHeading} tabIndex={-1}>{approved ? "Permohonan disetujui" : "Permohonan ditolak"}</h2>
        <p>Nomor pengajuan {result.request_id}.{approved && result.letter_number ? <> Nomor surat: <strong>{result.letter_number}</strong>.</> : ""}</p>
        <p>{approved ? "Kantor desa akan mencetak surat untuk ditandatangani. Pemohon menerima kabar status otomatis." : "Pemohon menerima kabar penolakan beserta alasan Anda."} Tautan ini tidak dapat dipakai lagi.</p>
        <PanelLink />
      </div>
    );
  }
  if (!preview) return null;

  return (
    <div className="center-card" aria-busy={busy}>
      <p>Untuk {preview.head_name}. Periksa ringkasan dan draf surat sebelum memutuskan.</p>
      <dl className={styles.summary}>
        <div><dt>Nomor pengajuan</dt><dd>{preview.request_id}</dd></div>
        <div><dt>Jenis surat</dt><dd>{preview.jenis_surat_label}</dd></div>
        <div><dt>Nama pemohon</dt><dd>{preview.nama}</dd></div>
        <div><dt>Tanggal pengajuan</dt><dd>{dateOnly.format(new Date(preview.submitted_at))}</dd></div>
        <div><dt>Diverifikasi oleh</dt><dd>{preview.verified_by ?? "-"}</dd></div>
        {preview.letter_number && <div><dt>Nomor surat</dt><dd>{preview.letter_number}</dd></div>}
        <div><dt>Tautan berlaku sampai</dt><dd>{dateFormat.format(new Date(preview.expires_at))} WIB</dd></div>
      </dl>
      <div className={styles.actions}>
        <button type="button" className="btn btn-secondary" disabled={draftBusy} onClick={() => void openDraft()}>
          <FileText size={22} aria-hidden="true" /> {draftBusy ? "Membuka draf…" : "Lihat draf surat"}
        </button>
      </div>
      <p className={styles.help}>Dokumen KTP/KK pemohon hanya dapat dilihat di panel admin.</p>

      <form className={styles.form} onSubmit={review} noValidate>
        <fieldset>
          <legend>Keputusan</legend>
          <div className={styles.choices}>
            <label className={styles.choice}><input type="radio" name={`${id}-decision`} value="approve" checked={decision === "approve"} onChange={() => setDecision("approve")} /> Setuju</label>
            <label className={`${styles.choice} ${styles.choiceReject}`}><input type="radio" name={`${id}-decision`} value="reject" checked={decision === "reject"} onChange={() => setDecision("reject")} /> Tolak</label>
          </div>
        </fieldset>
        {decision === "reject" && (
          <div>
            <label htmlFor={`${id}-note`}>Alasan penolakan (wajib)</label>
            <textarea id={`${id}-note`} value={note} maxLength={1000} required onChange={(event) => setNote(event.target.value)} aria-describedby={`${id}-note-help`} />
            <p id={`${id}-note-help`} className={styles.help}>Alasan dikirim ke pemohon bersama kabar penolakan.</p>
          </div>
        )}
        <div>
          <label htmlFor={`${id}-pin`}>PIN persetujuan</label>
          <input
            id={`${id}-pin`}
            className={styles.pin}
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-describedby={`${id}-pin-help`}
            required
          />
          <p id={`${id}-pin-help`} className={styles.help}>6 digit, diatur di panel (menu Akun → Notifikasi email). Sisa percobaan: {preview.pin_attempts_left}. Setelah 5 kali salah, tautan dikunci.</p>
        </div>
        {error && <p className="error-box" role="alert">{error}</p>}
        <div className={styles.actions}>
          <button className="btn" type="submit" disabled={busy}>Lanjutkan</button>
        </div>
      </form>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-confirm`} onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <h2 id={`${id}-confirm`}>{decision === "reject" ? "Yakin menolak?" : "Yakin menyetujui?"}</h2>
        <p>{decision === "reject"
          ? `Permohonan ${preview.request_id} atas nama ${preview.nama} akan ditolak dan nomor suratnya dibatalkan.`
          : `Permohonan ${preview.request_id} atas nama ${preview.nama} akan disetujui. Keputusan tidak dapat dibatalkan dari halaman ini.`}</p>
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dialog.current?.close()} autoFocus>Batal</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void confirm()}>{busy ? "Menyimpan…" : decision === "reject" ? "Ya, tolak" : "Ya, setujui"}</button>
        </div>
      </dialog>
    </div>
  );
}

function PanelLink() {
  return <Link href="/admin/" className="btn btn-secondary mt-5">Masuk ke panel admin</Link>;
}
