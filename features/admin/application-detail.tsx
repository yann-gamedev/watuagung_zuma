"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { z } from "zod";
import { StatusBadge, statusLabels } from "@/components/site";
import { services } from "@/lib/data";
import { statuses, type StaffAccessCodeResponse, type StaffApplicationDetail, type StaffStatusResponse, type Status } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import { buildApplicationsHref, parseApplicationFilters, parseApplicationSection } from "./application-filters";
import styles from "./application-detail.module.css";
import neighborhoodStyles from "./neighborhood.module.css";

const actionLabels: Record<Status, string> = {
  SUBMITTED: "Terima", VERIFIED: "Verifikasi", PROCESSING: "Proses",
  RT_APPROVED: "Setujui sebagai Ketua RT", RW_APPROVED: "Setujui sebagai Ketua RW",
  WAITING_APPROVAL: "Ajukan ke Kepala Desa", APPROVED: "Setujui",
  READY_FOR_PICKUP: "Tandai siap diambil", COMPLETED: "Tandai sudah diambil",
  NEED_REVISION: "Minta perbaikan", REJECTED: "Tolak",
};
const detailSchema = z.object({
  request_id: z.string(), nama: z.string(), jenis_surat: z.enum(["SKU", "DOMISILI", "SKTM", "KTP_KK"]),
  status: z.enum(statuses), created_at: z.string(), updated_at: z.string(), allowed_transitions: z.array(z.enum(statuses)),
  nik: z.string(), no_kk: z.string(), tempat_lahir: z.string().optional(), tanggal_lahir: z.string().optional(),
  jenis_kelamin: z.string().optional(), alamat: z.string(), rt: z.string(), rw: z.string(), telepon: z.string().optional(),
  nama_usaha: z.string().nullable(), jenis_usaha: z.string().nullable(), alamat_usaha: z.string().nullable(),
  keperluan: z.string(), catatan: z.string().nullable(), can_reset_access_code: z.boolean(),
  history: z.array(z.object({ action: z.enum(["ACCESS_CODE_RESET"]).nullable(), from_status: z.enum(statuses).nullable(), to_status: z.enum(statuses),
    note: z.string().nullable(), staff_name: z.string().nullable(), created_at: z.string() })),
});
function lowerLabel(status: Status) {
  return actionLabels[status].replace(/^./, (letter) => letter.toLowerCase());
}
function dateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}

export function ApplicationDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  // Key removes all private data, revealed fields and pending actions when ID changes.
  return <DetailContent key={id} id={id} />;
}
function DetailContent({ id }: { id: string }) {
  const params = useSearchParams();
  const { request, user } = useAdminSession();
  const neighborhood = user?.role === "rt_head" || user?.role === "rw_head";
  const [detail, setDetail] = useState<StaffApplicationDetail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Status | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [identityChecked, setIdentityChecked] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);
  const changing = useRef(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const actionHeadingRef = useRef<HTMLHeadingElement>(null);
  const validId = /^REQ-\d{4}-[A-Z0-9]+$/.test(id) && id.length <= 64;
  const source = user?.role === "rt_head" ? "antrean-rt" : user?.role === "rw_head" ? "antrean-rw" : parseApplicationSection(params.get("from"));
  const backHref = buildApplicationsHref(source, parseApplicationFilters(params, source));
  const readDetail = useCallback(async () => {
    const response = await request<unknown>(`/staff/applications/${encodeURIComponent(id)}`);
    const parsed = detailSchema.safeParse(response);
    // Do not surface Zod issues: they can contain private response values.
    if (!parsed.success) throw new Error("Format detail tidak sesuai. Silakan muat ulang atau hubungi pengelola.");
    return parsed.data;
  }, [id, request]);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (validId) void readDetail().then((result) => {
      if (!cancelled) { setDetail(result); setLoading(false); }
    }).catch((e: unknown) => {
      if (!cancelled && !(e instanceof AdminUnauthorizedError)) {
        setError(e instanceof Error ? e.message : "Gagal memuat detail."); setLoading(false);
      }
    });
    return () => { cancelled = true; mounted.current = false; };
  }, [readDetail, validId, attempt]);

  // After a status change the action buttons may disappear; move focus to a stable heading.
  const focusActions = () => requestAnimationFrame(() => actionHeadingRef.current?.focus());
  async function change(status: Status) {
    if (changing.current || !detail?.allowed_transitions.includes(status)) return;
    changing.current = true; setBusy(true); setActionError(""); setNotice("");
    let updated = false;
    try {
      await request<StaffStatusResponse>(`/staff/applications/${encodeURIComponent(id)}/status`, {
        method: "PATCH", body: JSON.stringify({ status, catatan: note.trim() || null }),
      });
      updated = true;
      if (!mounted.current) return;
      setNote("");
      // Keep the old detail visible (actions disabled) and reload real history from the server.
      const result = await readDetail();
      if (mounted.current) { setDetail(result); setNotice("Status permohonan berhasil diperbarui."); }
    } catch (e) {
      if (!mounted.current || e instanceof AdminUnauthorizedError) return;
      if (updated) {
        setNotice("Status sudah diperbarui, tetapi detail gagal dimuat ulang. Muat ulang halaman untuk melihat data terbaru.");
      } else {
        setActionError(e instanceof Error ? e.message : "Gagal memperbarui status.");
        // A concurrent update may have changed the available actions.
        try { const result = await readDetail(); if (mounted.current) setDetail(result); } catch { /* keep current detail */ }
      }
    } finally {
      changing.current = false;
      if (mounted.current) { setPending(null); setBusy(false); focusActions(); }
    }
  }
  async function resetCode() {
    if (resetBusy || !identityChecked) return;
    setResetBusy(true); setResetError("");
    try {
      const result = await request<StaffAccessCodeResponse>(`/staff/applications/${encodeURIComponent(id)}/lookup-secret`, { method: "POST" });
      if (!mounted.current) return;
      setNewCode(result.lookup_secret);
      // Riwayat dimuat ulang agar entri "Kode akses dibuat ulang" langsung terlihat.
      try { const fresh = await readDetail(); if (mounted.current) setDetail(fresh); } catch { /* kode tetap ditampilkan */ }
    } catch (e) {
      if (mounted.current && !(e instanceof AdminUnauthorizedError)) setResetError(e instanceof Error ? e.message : "Gagal membuat ulang kode akses.");
    } finally {
      if (mounted.current) setResetBusy(false);
    }
  }
  function closeReset() {
    // Kode hanya disimpan di state dialog dan dibuang saat ditutup.
    setResetOpen(false); setNewCode(null); setCopied(false); setIdentityChecked(false);
  }
  function choose(status: Status, button: HTMLButtonElement) {
    setActionError(""); setNotice("");
    if (["REJECTED", "NEED_REVISION"].includes(status) && !note.trim()) {
      setActionError("Catatan wajib diisi untuk Tolak atau Minta perbaikan."); noteRef.current?.focus(); return;
    }
    actionRef.current = button;
    if (["REJECTED", "RT_APPROVED", "RW_APPROVED", "APPROVED", "COMPLETED"].includes(status)) setPending(status);
    else void change(status);
  }
  return <div className={styles.page}>
    <Link className="btn btn-secondary" href={backHref}><ArrowLeft size={22} aria-hidden="true" />Kembali ke daftar</Link>
    {!validId ? <p className="error-box" role="alert">Nomor permohonan tidak valid. Buka detail dari daftar permohonan.</p> : <>
      {error && <p className="error-box" role="alert">{error}</p>}
      {loading && <p role="status">Memuat detail permohonan...</p>}
      {!loading && !detail && <button className="btn" onClick={() => { setError(""); setLoading(true); setAttempt(attempt + 1); }}>Coba lagi</button>}
      {detail && <>
        <section className={styles.card} aria-label="Ringkasan permohonan">
          <h2 className={styles.number}>{detail.request_id}</h2>
          <p>{services.find((service) => service.code === detail.jenis_surat)?.title}</p>
          <div className={styles.summary}><StatusBadge status={detail.status} jenisSurat={detail.jenis_surat} /><time dateTime={detail.created_at}>{dateTime(detail.created_at)}</time></div>
        </section>
        <div className={styles.columns}>
          <div className={styles.groups}>
            <section className={styles.card}><h2>Data diri</h2><dl className={styles.fields}>
              <div><dt>Nama pemohon</dt><dd>{detail.nama}</dd></div>
              <div><dt>NIK</dt><dd className={styles.identity}>{detail.nik}</dd></div>
              <div><dt>Nomor KK</dt><dd className={styles.identity}>{detail.no_kk}</dd></div>
              {!neighborhood && <>
                <div><dt>Tempat lahir</dt><dd>{detail.tempat_lahir ?? "—"}</dd></div>
                <div><dt>Tanggal lahir</dt><dd>{detail.tanggal_lahir ? new Date(`${detail.tanggal_lahir}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "long" }) : "—"}</dd></div>
                <div><dt>Jenis kelamin</dt><dd>{detail.jenis_kelamin ?? "—"}</dd></div>
                <div><dt>Telepon</dt><dd>{detail.telepon ?? "—"}</dd></div>
              </>}
            </dl></section>
            <section className={styles.card}><h2>Alamat</h2><dl className={styles.fields}>
              <div><dt>Alamat tempat tinggal</dt><dd>{detail.alamat}</dd></div>
              <div><dt>RT / RW</dt><dd>{detail.rt} / {detail.rw}</dd></div>
            </dl></section>
            {detail.jenis_surat === "SKU" && <section className={styles.card}><h2>Usaha</h2><dl className={styles.fields}>
              <div><dt>Nama usaha</dt><dd>{detail.nama_usaha || "—"}</dd></div>
              <div><dt>Jenis usaha</dt><dd>{detail.jenis_usaha || "—"}</dd></div>
              <div><dt>Alamat usaha</dt><dd>{detail.alamat_usaha || "—"}</dd></div>
            </dl></section>}
            <section className={styles.card}><h2>Keperluan</h2><p className={styles.multiline}>{detail.keperluan}</p>
              <h3>Catatan terakhir</h3><p className={styles.multiline}>{detail.catatan || "Belum ada catatan."}</p></section>
            <section className={styles.card}><h2>Riwayat status</h2>
              {detail.history.length ? <ol className={styles.timeline}>{detail.history.map((event, index) => <li key={`${event.created_at}-${index}`}>
                <h3>{event.action === "ACCESS_CODE_RESET" ? "Kode akses dibuat ulang" : <>{event.from_status ? `${statusLabels[event.from_status]} → ` : ""}{statusLabels[event.to_status]}</>}</h3>
                <p>{event.staff_name ?? "Pengajuan warga / sistem"}</p>
                <time dateTime={event.created_at}>{dateTime(event.created_at)}</time>
                {event.note && <p className={styles.multiline}>{event.note}</p>}
              </li>)}</ol> : <p>Belum ada riwayat status.</p>}
            </section>
          </div>
          <section className={`${styles.card} ${styles.actions}`} aria-labelledby="action-title"><h2 id="action-title" ref={actionHeadingRef} tabIndex={-1}>Tindakan petugas</h2>
            {notice && <p className={styles.notice} role="status">{notice}</p>}
            {actionError && <p id="action-error" className="error-box" role="alert">{actionError}</p>}
            {detail.allowed_transitions.length ? <>
              <label htmlFor="staff-note">Catatan status</label>
              <p id="note-help">{neighborhood ? "Wajib untuk Tolak." : "Wajib untuk Tolak dan Minta perbaikan."} Jangan tuliskan NIK, KK, telepon, atau alamat dalam catatan.</p>
              <textarea ref={noteRef} id="staff-note" className="search-input" aria-describedby={actionError ? "note-help action-error" : "note-help"} aria-invalid={actionError.startsWith("Catatan wajib") || undefined} value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} maxLength={1000} rows={5} />
              <div className={styles.buttons}>{detail.allowed_transitions.map((status) => <button type="button" id={`status-${status}`} className="btn btn-secondary" key={status} disabled={busy} onClick={(event) => choose(status, event.currentTarget)}>{actionLabels[status]}</button>)}</div>
            </> : <p>Tidak ada tindakan yang tersedia untuk peran Anda pada status ini.</p>}
            {busy && <p role="status">Menyimpan perubahan...</p>}
            {detail.can_reset_access_code && <>
              <h3>Kode akses warga</h3>
              <p>Untuk warga yang kehilangan kode akses. Periksa KTP/KK asli lebih dulu; kode lama langsung tidak berlaku.</p>
              <button ref={resetButtonRef} type="button" className="btn btn-secondary" disabled={busy} onClick={() => { setResetError(""); setIdentityChecked(false); setNewCode(null); setResetOpen(true); }}>Buat ulang kode akses</button>
            </>}
          </section>
        </div>
      </>}
    </>}
    <DialogPrimitive.Root open={pending !== null} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}>
      <DialogPrimitive.Portal><DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={`${styles.dialog} ${neighborhood ? neighborhoodStyles.neighborhood : ""}`} onCloseAutoFocus={(event) => { event.preventDefault(); actionRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
          <DialogPrimitive.Title className={styles.dialogTitle}>Konfirmasi {pending ? lowerLabel(pending) : "tindakan"}</DialogPrimitive.Title>
          <DialogPrimitive.Description>Anda akan mengubah status permohonan {id}. Pastikan pemeriksaan sudah selesai sebelum melanjutkan.</DialogPrimitive.Description>
          <div className={styles.dialogButtons}><button type="button" className="btn btn-secondary" disabled={busy} autoFocus onClick={() => setPending(null)}>Batal</button>
            <button type="button" className="btn" disabled={busy || !pending} onClick={() => { if (pending) void change(pending); }}>{busy ? "Menyimpan..." : `Ya, ${pending ? lowerLabel(pending) : "lanjutkan"}`}</button></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
    <DialogPrimitive.Root open={resetOpen} onOpenChange={(open) => { if (!open && !resetBusy) closeReset(); }}>
      <DialogPrimitive.Portal><DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={`${styles.dialog} ${neighborhood ? neighborhoodStyles.neighborhood : ""}`} onCloseAutoFocus={(event) => { event.preventDefault(); resetButtonRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (resetBusy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (resetBusy || newCode) event.preventDefault(); }}>
          {newCode ? <>
            <DialogPrimitive.Title className={styles.dialogTitle}>Kode akses baru</DialogPrimitive.Title>
            <DialogPrimitive.Description>Berikan kode ini kepada pemohon sekarang. Kode hanya tampil sekali dan tidak bisa dilihat lagi.</DialogPrimitive.Description>
            <p className={styles.accessCode} aria-label={`Kode akses ${newCode.split("").join(" ")}`}>{newCode}</p>
            {copied && <p role="status">Kode tersalin.</p>}
            <div className={styles.dialogButtons}>
              <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard?.writeText(newCode).then(() => setCopied(true), () => setCopied(false))}>Salin kode</button>
              <button type="button" className="btn" autoFocus onClick={closeReset}>Selesai, kode sudah diberikan</button>
            </div>
          </> : <>
            <DialogPrimitive.Title className={styles.dialogTitle}>Buat ulang kode akses</DialogPrimitive.Title>
            <DialogPrimitive.Description>Kode akses lama untuk {id} akan langsung tidak berlaku. Tindakan ini tercatat di riwayat permohonan.</DialogPrimitive.Description>
            <label className={styles.check}><input type="checkbox" checked={identityChecked} onChange={(event) => setIdentityChecked(event.target.checked)} disabled={resetBusy} />Identitas pemohon sudah saya cocokkan dengan KTP/KK asli.</label>
            {resetError && <p className="error-box" role="alert">{resetError}</p>}
            <div className={styles.dialogButtons}><button type="button" className="btn btn-secondary" disabled={resetBusy} autoFocus onClick={closeReset}>Batal</button>
              <button type="button" className="btn" disabled={resetBusy || !identityChecked} onClick={() => void resetCode()}>{resetBusy ? "Membuat kode..." : "Buat kode baru"}</button></div>
          </>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </div>;
}
