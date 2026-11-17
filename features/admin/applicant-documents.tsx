"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { attachmentKinds, attachmentKindLabels, type StaffAttachment } from "@/types/pelayanan";
import { AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import styles from "./application-detail.module.css";

export function ApplicantDocuments({ id, attachments = [] }: { id: string; attachments?: StaffAttachment[] }) {
  const { request } = useAdminSession();
  const [viewer, setViewer] = useState<{ url: string; label: string; pdf: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const active = useRef<{ url?: string; tab?: Window; timer?: ReturnType<typeof setInterval> }>({});
  const attempt = useRef(0);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const release = useCallback(() => {
    attempt.current++;
    if (active.current.timer) clearInterval(active.current.timer);
    active.current.tab?.close();
    if (active.current.url) URL.revokeObjectURL(active.current.url);
    active.current = {};
  }, []);
  const close = useCallback(() => {
    release(); setViewer(null); setBusy(false);
  }, [release]);
  useEffect(() => {
    window.addEventListener("pagehide", close);
    return () => { window.removeEventListener("pagehide", close); release(); };
  }, [close, release]);

  async function open(attachment: StaffAttachment, button: HTMLButtonElement) {
    release(); setViewer(null); setError(""); setBusy(true); setZoom(100); setRotation(0);
    trigger.current = button;
    const ticket = attempt.current;
    const pdf = attachment.stored_mime === "application/pdf";
    try {
      // Buka tab sebelum await; tanpa opener agar tab dokumen tidak dapat mengendalikan panel.
      if (pdf) {
        const tab = window.open("", "_blank");
        if (!tab) throw new Error("Tab baru diblokir. Izinkan pop-up untuk membuka PDF, lalu coba lagi.");
        active.current.tab = tab;
        // about:blank menyalin sessionStorage pembuka; tab dokumen tidak boleh membawa token petugas.
        tab.sessionStorage.clear();
        tab.opener = null;
      }
      const blob = await request<Blob>(`/staff/applications/${encodeURIComponent(id)}/attachments/${attachment.id}`);
      // Respons setelah tutup/pindah halaman tidak boleh membuat object URL baru.
      if (ticket !== attempt.current) return;
      if (!(blob instanceof Blob) || blob.type !== attachment.stored_mime) throw new Error("Format dokumen tidak sesuai. Muat ulang detail dan coba lagi.");
      if (pdf && active.current.tab?.closed) throw new Error("Tab PDF sudah ditutup. Buka dokumen kembali jika diperlukan.");
      const url = URL.createObjectURL(blob);
      active.current.url = url;
      if (pdf && active.current.tab) {
        active.current.tab.location.href = url;
        // ponytail: tab PDF tidak memberi event tutup; polling 500 ms, ganti bila browser menyediakan event.
        active.current.timer = setInterval(() => { if (active.current.tab?.closed) close(); }, 500);
      }
      setViewer({ url, label: attachmentKindLabels[attachment.kind], pdf });
    } catch (e) {
      if (ticket !== attempt.current) return;
      release(); setBusy(false);
      if (!(e instanceof AdminUnauthorizedError)) setError(e instanceof Error ? e.message : "Gagal membuka dokumen. Coba lagi.");
    } finally { if (ticket === attempt.current) setBusy(false); }
  }

  return <section className={styles.card} aria-labelledby="applicant-documents-title">
    <h2 id="applicant-documents-title">Dokumen warga</h2>
    <p>Setiap pembukaan dokumen dicatat.</p>
    <dl className={styles.fields}>{attachmentKinds.map((kind) => {
      const attachment = attachments.find((item) => item.kind === kind);
      return <div key={kind}><dt>{attachmentKindLabels[kind]}</dt><dd className={styles.sensitive}>
        <span>{!attachment ? "Belum" : attachment.purged ? "Dihapus sesuai masa simpan" : "Ada"}</span>
        {attachment && !attachment.purged && <button type="button" className="btn btn-secondary" disabled={busy}
          onClick={(event) => void open(attachment, event.currentTarget)}>Buka {attachmentKindLabels[kind]}</button>}
      </dd></div>;
    })}</dl>
    {error && <p className="error-box" role="alert">{error}</p>}
    {busy && <p role="status">Memuat dokumen dan mencatat akses...</p>}
    {(busy || viewer?.pdf) && <div className={styles.buttons}>
      {viewer?.pdf && <p role="status">{viewer.label} dibuka di tab PDF baru.</p>}
      <button type="button" className="btn btn-secondary" onClick={close}>{busy ? "Batalkan pembukaan" : "Tutup dokumen"}</button>
    </div>}
    <DialogPrimitive.Root open={!!viewer && !viewer.pdf} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogPrimitive.Portal><DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.dialog} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
          <DialogPrimitive.Title className={styles.dialogTitle}>{viewer?.label}</DialogPrimitive.Title>
          <DialogPrimitive.Description>Dokumen warga. Perbesar untuk membaca, putar bila foto miring.</DialogPrimitive.Description>
          <div className={styles.documentControls}>
            <button type="button" className="btn btn-secondary" disabled={zoom === 100} onClick={() => setZoom(zoom - 50)}>Perkecil</button>
            <button type="button" className="btn btn-secondary" disabled={zoom === 300} onClick={() => setZoom(zoom + 50)}>Perbesar</button>
            <button type="button" className="btn btn-secondary" onClick={() => setRotation((rotation + 90) % 360)}>Putar 90°</button>
          </div>
          <p role="status">Ukuran {zoom}%, putaran {rotation}°.</p>
          <div className={styles.documentViewport} tabIndex={0} role="region" aria-label="Gambar dokumen, gulir untuk melihat bagian lain">
            <div className={styles.documentCanvas} style={{ width: `${zoom}%` }}>
              {/* Blob privat hanya ada selama penampil terbuka; bukan URL gambar publik Next.js. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {viewer && <img src={viewer.url} alt={`Dokumen ${viewer.label}`} style={{ transform: `rotate(${rotation}deg)` }} onError={() => { close(); setError("Gambar gagal ditampilkan. Coba buka kembali."); }} />}
            </div>
          </div>
          <div className={styles.dialogButtons}><button type="button" className="btn btn-secondary" onClick={close}>Tutup dokumen</button></div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </section>;
}
