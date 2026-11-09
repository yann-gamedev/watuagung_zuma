"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { businessCategoryLabels, businessHref } from "@/services/businesses";
import { businessCategories, businessHamlets, type BusinessStatus } from "@/types/business";
import { can, useAdminSession } from "./session";
import { AdminUnauthorizedError, AdminValidationError } from "./api";
import { businessInputSchema, parseBusiness, type BusinessForm } from "./business-data";
import { NewsStatus } from "./news-list";
import styles from "./news.module.css";
import { useUnsavedChanges } from "./use-unsaved-changes";

type Detail = ReturnType<typeof parseBusiness>;
const empty: BusinessForm = { name: "", category: "makanan_minuman", hamlet: "", description: "", owner_name: "", whatsapp: "", consent_public_contact: false, status: "draft" };
function fields(item: Detail): BusinessForm {
  return {
    name: item.name, category: item.category, hamlet: item.hamlet ?? "", description: item.description,
    owner_name: item.owner_name ?? "", whatsapp: item.whatsapp ?? "", consent_public_contact: item.consent_public_contact, status: item.status,
  };
}
const message = (cause: unknown, fallback: string) => cause instanceof AdminValidationError
  ? Object.values(cause.fields).flat().join(" ") || cause.message : cause instanceof Error ? cause.message : fallback;

export function BusinessEditPage() {
  const id = useSearchParams().get("id");
  if (!id || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return <p className="error-box" role="alert">ID UMKM tidak valid. <Link href="/admin/umkm/">Kembali ke daftar UMKM</Link></p>;
  return <BusinessEditor key={id} id={Number(id)} />;
}

/** Pola sama dengan news-editor.tsx: teks disimpan dulu (foto perlu ID), lalu foto diunggah/dihapus. */
export function BusinessEditor({ id }: { id?: number }) {
  const { request, user } = useAdminSession();
  const allowed = can(user, "media:manage");
  const [item, setItem] = useState<Detail | null>(null);
  const [value, setValue] = useState<BusinessForm>(empty);
  const [saved, setSaved] = useState<BusinessForm>(empty);
  const [loading, setLoading] = useState(!!id);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const messageBox = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved) || !!file || removePhoto;
  useUnsavedChanges(dirty || busy);

  useEffect(() => {
    if (!id || !allowed) return;
    let cancelled = false;
    void request<unknown>(`/staff/businesses/${id}`).then(parseBusiness).then((result) => {
      if (!cancelled) { setItem(result); setValue(fields(result)); setSaved(fields(result)); }
    }).catch((cause: unknown) => {
      if (!cancelled && !(cause instanceof AdminUnauthorizedError)) setError(message(cause, "Gagal memuat UMKM."));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, request, attempt, allowed]);
  useEffect(() => () => { if (localPhoto) URL.revokeObjectURL(localPhoto); }, [localPhoto]);
  useEffect(() => { if (error || notice) messageBox.current?.focus(); }, [error, notice]);

  function adopt(result: Detail) { setItem(result); setValue(fields(result)); setSaved(fields(result)); }
  async function save(status: BusinessStatus) {
    if (inFlight.current) return;
    const parsed = businessInputSchema.safeParse({ ...value, status });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); setNotice(""); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    let textSaved = false;
    try {
      let result = parseBusiness(await request<unknown>(item ? `/staff/businesses/${item.id}` : "/staff/businesses", { method: item ? "PATCH" : "POST", body: JSON.stringify(parsed.data) }));
      adopt(result); textSaved = true;
      if (file) {
        const data = new FormData(); data.append("file", file);
        result = parseBusiness(await request<unknown>(`/staff/businesses/${result.id}/photo`, { method: "POST", body: data }));
        adopt(result); setFile(null); if (input.current) input.current.value = "";
      } else if (removePhoto) {
        result = parseBusiness(await request<unknown>(`/staff/businesses/${result.id}/photo`, { method: "DELETE" }));
        adopt(result);
      }
      setRemovePhoto(false);
      setNotice(result.status === "published" ? "UMKM terbit berhasil disimpan dan tampil di website." : "Draf UMKM berhasil disimpan. Draf tidak tampil di website.");
    } catch (cause) {
      if (!(cause instanceof AdminUnauthorizedError)) {
        setError(message(cause, "UMKM gagal disimpan."));
        if (textSaved) setNotice("Data usaha sudah tersimpan. Perubahan foto belum dikonfirmasi. Muat ulang untuk memeriksa foto di server, atau coba simpan lagi.");
      }
    } finally { inFlight.current = false; setBusy(false); }
  }
  async function remove() {
    if (!item || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await request(`/staff/businesses/${item.id}`, { method: "DELETE" });
      setValue(saved); setFile(null); setRemovePhoto(false); setItem(null);
      setNotice("UMKM dihapus.");
      dialog.current?.close();
    } catch (cause) {
      dialog.current?.close();
      if (!(cause instanceof AdminUnauthorizedError)) setError(message(cause, "UMKM gagal dihapus."));
    } finally { inFlight.current = false; setBusy(false); }
  }

  if (!allowed) return <div><p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p><Link className="btn btn-secondary" href="/admin/">Kembali ke panel Anda</Link></div>;
  if (loading) return <p role="status">Memuat UMKM…</p>;
  if (notice === "UMKM dihapus.") return <div><p role="status">{notice}</p><Link className="btn" href="/admin/umkm/">Kembali ke daftar UMKM</Link></div>;
  if (id && !item) return <div><p className="error-box" role="alert">{error}</p><button className="btn" onClick={() => { setLoading(true); setError(""); setAttempt((n) => n + 1); }}>Muat ulang</button><Link className="btn btn-secondary" href="/admin/umkm/">Kembali ke daftar UMKM</Link></div>;
  const photo = file ? localPhoto : removePhoto ? null : item?.photo_url;
  const set = <K extends keyof BusinessForm>(key: K) => (next: BusinessForm[K]) => setValue({ ...value, [key]: next });
  return <div className={styles.editor}>
    <Link className="btn btn-secondary" href="/admin/umkm/">Kembali ke daftar UMKM</Link>
    <div ref={messageBox} tabIndex={-1}>{error && <p className="error-box" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>
    <div className={styles.actions}><NewsStatus status={item?.status ?? "draft"} />{dirty && <span>Perubahan belum disimpan</span>}{item?.status === "published" && <a className="btn btn-secondary" href={businessHref(item.slug)} target="_blank" rel="noopener noreferrer">Lihat di website<span className="sr-only"> (dibuka di tab baru)</span></a>}</div>
    <p>Jangan masukkan NIK, nomor KK, atau alamat rumah pemilik.</p>
    <form onSubmit={(event) => { event.preventDefault(); void save(item?.status ?? "draft"); }}>
      <fieldset className={styles.fields} disabled={busy}>
        <legend className="sr-only">Data UMKM</legend>
        <div className={styles.field}><label htmlFor="umkm-name">Nama usaha</label><input id="umkm-name" required maxLength={120} value={value.name} onChange={(e) => set("name")(e.target.value)} /></div>
        <div className={styles.field}><label htmlFor="umkm-category">Kategori</label><select id="umkm-category" value={value.category} onChange={(e) => set("category")(e.target.value as BusinessForm["category"])}>{businessCategories.map((key) => <option key={key} value={key}>{businessCategoryLabels[key]}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="umkm-hamlet">Dusun</label><select id="umkm-hamlet" value={value.hamlet ?? ""} onChange={(e) => set("hamlet")(e.target.value as BusinessForm["hamlet"])}><option value="">Tidak dicantumkan</option>{businessHamlets.map((hamlet) => <option key={hamlet} value={hamlet}>{hamlet}</option>)}</select></div>
        <div className={styles.field}><label htmlFor="umkm-description">Deskripsi</label><span id="umkm-description-help">Produk atau jasa, jam buka, cara memesan. Pisahkan paragraf dengan baris kosong. {value.description.length}/3.000 karakter.</span><textarea id="umkm-description" required rows={8} maxLength={3000} aria-describedby="umkm-description-help" value={value.description} onChange={(e) => set("description")(e.target.value)} /></div>
        <div className={styles.field}><label htmlFor="umkm-photo">Foto usaha {item?.photo_url || file ? "(ganti foto)" : "(opsional)"}</label><input ref={input} id="umkm-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="umkm-photo-help" onChange={(e) => { const selected = e.target.files?.[0] ?? null; setFile(selected); setLocalPhoto(selected ? URL.createObjectURL(selected) : null); setRemovePhoto(false); }} />
          <p id="umkm-photo-help">Disarankan memakai foto dengan lebar minimal 600 piksel dan tinggi minimal 400 piksel agar tetap jelas. Foto lebih kecil tetap dapat diunggah. Format JPG, PNG, atau WebP; dimensi maksimal 6.000 × 6.000 piksel dan ukuran file maksimal 3 MB. Foto produk atau tempat usaha, bukan foto KTP/dokumen. Foto diunggah setelah data tersimpan dan dapat diakses publik.</p>
          {photo && <Image className={styles.cover} src={photo} alt="Pratinjau foto usaha" width={800} height={500} unoptimized />}
          {(photo || file) && <button type="button" className="btn btn-secondary" onClick={() => { setFile(null); setRemovePhoto(!!item?.photo_url); if (input.current) input.current.value = ""; }}>Hapus foto</button>}
          {removePhoto && <p>Foto akan dihapus saat UMKM disimpan.</p>}
        </div>
        <fieldset className={styles.fields}><legend>Kontak pemilik</legend>
          <p>Nama dan nomor selalu tersimpan untuk kantor desa, tetapi hanya tampil di website bila kotak izin dicentang.</p>
          <div className={styles.field}><label htmlFor="umkm-owner">Nama pemilik (opsional)</label><input id="umkm-owner" maxLength={120} value={value.owner_name ?? ""} onChange={(e) => set("owner_name")(e.target.value)} /></div>
          <div className={styles.field}><label htmlFor="umkm-whatsapp">Nomor WhatsApp (opsional)</label><span id="umkm-whatsapp-help">Format 62…, contoh 6281234567890. Hanya angka, tanpa +, spasi, atau tanda hubung.</span><input id="umkm-whatsapp" inputMode="numeric" maxLength={15} aria-describedby="umkm-whatsapp-help" value={value.whatsapp ?? ""} onChange={(e) => set("whatsapp")(e.target.value)} /></div>
          <label className={styles.check}><input type="checkbox" checked={value.consent_public_contact} onChange={(e) => set("consent_public_contact")(e.target.checked)} />Pemilik sudah mengizinkan nama dan nomornya ditampilkan di website</label>
        </fieldset>
        <div className={styles.actions}>
          {item?.status !== "published" && <button className="btn btn-secondary" type="submit">Simpan draf</button>}
          <button className="btn" type="button" onClick={() => void save("published")}>{item?.status === "published" ? "Simpan perubahan" : "Terbitkan"}</button>
          {item?.status === "published" && <button className="btn btn-secondary" type="button" onClick={() => void save("draft")}>Kembalikan ke draf</button>}
        </div>
      </fieldset>
    </form>
    {busy && <p role="status">Menyimpan perubahan…</p>}
    {item && <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => dialog.current?.showModal()}>Hapus UMKM</button>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="umkm-delete-title" onCancel={(event) => { if (busy) event.preventDefault(); }}><h2 id="umkm-delete-title">Hapus UMKM</h2><p>UMKM akan dihapus dari website dan daftar panel. Fotonya ikut dihapus dan tidak dapat dikembalikan. Lanjutkan?</p><div className={styles.actions}><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => dialog.current?.close()} autoFocus>Batal</button><button type="button" className="btn" disabled={busy} onClick={() => void remove()}>Ya, hapus UMKM</button></div></dialog>
  </div>;
}
