"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { z } from "zod";
import { StatusBadge, statusLabels } from "@/components/site";
import { services } from "@/lib/data";
import { statuses, type StaffApplicationDetail, type StaffStatusResponse, type Status } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import { buildApplicationsHref, parseApplicationFilters, parseApplicationSection } from "./application-filters";
import styles from "./application-detail.module.css";

const actionLabels: Record<Status, string> = {
  SUBMITTED: "Terima", VERIFIED: "Verifikasi", PROCESSING: "Proses",
  WAITING_APPROVAL: "Ajukan ke Kepala Desa", APPROVED: "Setujui",
  READY_FOR_PICKUP: "Tandai siap diambil", COMPLETED: "Tandai sudah diambil",
  NEED_REVISION: "Minta perbaikan", REJECTED: "Tolak",
};
const detailSchema = z.object({
  request_id: z.string(), nama: z.string(), jenis_surat: z.enum(["SKU", "DOMISILI", "SKTM", "KTP_KK"]),
  status: z.enum(statuses), created_at: z.string(), updated_at: z.string(), allowed_transitions: z.array(z.enum(statuses)),
  nik: z.string(), no_kk: z.string(), tempat_lahir: z.string(), tanggal_lahir: z.string(),
  jenis_kelamin: z.string(), alamat: z.string(), rt: z.string(), rw: z.string(), telepon: z.string(),
  nama_usaha: z.string().nullable(), jenis_usaha: z.string().nullable(), alamat_usaha: z.string().nullable(),
  keperluan: z.string(), catatan: z.string().nullable(),
  history: z.array(z.object({ from_status: z.enum(statuses).nullable(), to_status: z.enum(statuses),
    note: z.string().nullable(), staff_name: z.string().nullable(), created_at: z.string() })),
});
function dateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}
function PrivateField({ label, value }: { label: string; value: string }) {
  const [visible, setVisible] = useState(false);
  return <div><dt>{label}</dt><dd className={styles.privateField}>
    <span>{visible ? value : `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`}</span>
    <button type="button" className="btn btn-secondary" aria-label={`${visible ? "Sembunyikan" : "Tampilkan"} ${label}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}{visible ? "Sembunyikan" : "Tampilkan"}
    </button>
  </dd></div>;
}

export function ApplicationDetail() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  // Key removes all private data, revealed fields and pending actions when ID changes.
  return <DetailContent key={id} id={id} />;
}
function DetailContent({ id }: { id: string }) {
  const params = useSearchParams();
  const { request } = useAdminSession();
  const [detail, setDetail] = useState<StaffApplicationDetail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Status | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  const changing = useRef(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const actionRef = useRef<HTMLButtonElement | null>(null);
  const validId = /^REQ-\d{4}-[A-Z0-9]+$/.test(id) && id.length <= 64;
  const source = parseApplicationSection(params.get("from"));
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

  async function change(status: Status) {
    if (changing.current || !detail?.allowed_transitions.includes(status)) return;
    changing.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await request<StaffStatusResponse>(`/staff/applications/${encodeURIComponent(id)}/status`, {
        method: "PATCH", body: JSON.stringify({ status, catatan: note.trim() || null }),
      });
      if (!mounted.current) return;
      setPending(null); setNote("");
      // Reload actual history and allowed actions; never invent a client-side event.
      setDetail(null); setLoading(true);
      const result = await readDetail();
      if (mounted.current) { setDetail(result); setNotice("Status permohonan berhasil diperbarui."); }
    } catch (e) {
      if (mounted.current && !(e instanceof AdminUnauthorizedError)) {
        setPending(null);
        setError(e instanceof Error ? e.message : "Gagal memperbarui status.");
        // A concurrent update may have changed the available actions.
        try { const result = await readDetail(); if (mounted.current) setDetail(result); }
        catch { if (mounted.current) setDetail(null); }
      }
    } finally {
      changing.current = false;
      if (mounted.current) { setBusy(false); setLoading(false); }
    }
  }
  function choose(status: Status, button: HTMLButtonElement) {
    setError(""); setNotice("");
    if (["REJECTED", "NEED_REVISION"].includes(status) && !note.trim()) {
      setError("Catatan wajib diisi untuk Tolak atau Minta perbaikan."); noteRef.current?.focus(); return;
    }
    actionRef.current = button;
    if (["REJECTED", "APPROVED", "COMPLETED"].includes(status)) setPending(status);
    else void change(status);
  }
  return <div className={styles.page}>
    <Link className="btn btn-secondary" href={backHref}><ArrowLeft size={22} aria-hidden="true" />Kembali ke daftar</Link>
    {!validId ? <p className="error-box" role="alert">Nomor permohonan tidak valid. Buka detail dari daftar permohonan.</p> : <>
      {error && <p className="error-box" role="alert">{error}</p>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {loading && <p role="status">Memuat detail permohonan...</p>}
      {!loading && !detail && <button className="btn" onClick={() => { setError(""); setLoading(true); setAttempt(attempt + 1); }}>Coba lagi</button>}
      {detail && <>
        <section className={styles.card} aria-label="Ringkasan permohonan">
          <h2 className={styles.number}>{detail.request_id}</h2>
          <p>{services.find((service) => service.code === detail.jenis_surat)?.title}</p>
          <div className={styles.summary}><StatusBadge status={detail.status} /><time dateTime={detail.created_at}>{dateTime(detail.created_at)}</time></div>
        </section>
        <div className={styles.columns}>
          <div className={styles.groups}>
            <section className={styles.card}><h2>Data diri</h2><dl className={styles.fields}>
              <div><dt>Nama pemohon</dt><dd>{detail.nama}</dd></div>
              <PrivateField label="NIK" value={detail.nik} /><PrivateField label="Nomor KK" value={detail.no_kk} />
              <div><dt>Tempat lahir</dt><dd>{detail.tempat_lahir}</dd></div>
              <div><dt>Tanggal lahir</dt><dd>{new Date(`${detail.tanggal_lahir}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "long" })}</dd></div>
              <div><dt>Jenis kelamin</dt><dd>{detail.jenis_kelamin}</dd></div>
              <div><dt>Telepon</dt><dd>{detail.telepon}</dd></div>
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
                <h3>{event.from_status ? `${statusLabels[event.from_status]} → ` : ""}{statusLabels[event.to_status]}</h3>
                <p>{event.staff_name ?? "Pengajuan warga / sistem"}</p>
                <time dateTime={event.created_at}>{dateTime(event.created_at)}</time>
                {event.note && <p className={styles.multiline}>{event.note}</p>}
              </li>)}</ol> : <p>Belum ada riwayat status.</p>}
            </section>
          </div>
          <section className={`${styles.card} ${styles.actions}`} aria-labelledby="action-title"><h2 id="action-title">Tindakan petugas</h2>
            {detail.allowed_transitions.length ? <>
              <label htmlFor="staff-note">Catatan status</label>
              <p id="note-help">Wajib untuk Tolak dan Minta perbaikan. Jangan tuliskan NIK, KK, telepon, atau alamat dalam catatan.</p>
              <textarea ref={noteRef} id="staff-note" className="search-input" aria-describedby="note-help" value={note} onChange={(event) => setNote(event.target.value)} disabled={busy} maxLength={1000} rows={5} />
              <div className={styles.buttons}>{detail.allowed_transitions.map((status) => <button type="button" id={`status-${status}`} className="btn btn-secondary" key={status} disabled={busy} onClick={(event) => choose(status, event.currentTarget)}>{actionLabels[status]}</button>)}</div>
            </> : <p>Tidak ada tindakan yang tersedia untuk peran Anda pada status ini.</p>}
            {busy && <p role="status">Menyimpan perubahan...</p>}
          </section>
        </div>
      </>}
    </>}
    <DialogPrimitive.Root open={pending !== null} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}>
      <DialogPrimitive.Portal><DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.dialog} onCloseAutoFocus={(event) => { event.preventDefault(); actionRef.current?.focus(); }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}>
          <DialogPrimitive.Title className={styles.dialogTitle}>Konfirmasi {pending ? actionLabels[pending].toLowerCase() : "tindakan"}</DialogPrimitive.Title>
          <DialogPrimitive.Description>Anda akan mengubah status permohonan {id}. Pastikan pemeriksaan sudah selesai sebelum melanjutkan.</DialogPrimitive.Description>
          <div className={styles.dialogButtons}><button type="button" className="btn btn-secondary" disabled={busy} autoFocus onClick={() => setPending(null)}>Batal</button>
            <button type="button" className="btn" disabled={busy || !pending} onClick={() => { if (pending) void change(pending); }}>{busy ? "Menyimpan..." : `Ya, ${pending ? actionLabels[pending].toLowerCase() : "lanjutkan"}`}</button></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </div>;
}
