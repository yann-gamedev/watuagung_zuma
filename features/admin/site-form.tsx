"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getStaffSiteSection, putStaffSiteSection, siteSchemas } from "@/services/site";
import type { EditableSiteSectionKey, SiteSectionData } from "@/types/site";
import { AdminSiteNotFoundError, AdminUnauthorizedError, AdminValidationError } from "./api";
import { useAdminSession } from "./session";
import { useUnsavedChanges } from "./use-unsaved-changes";
import styles from "./news.module.css";

/** Kerangka bersama R4–R8: muat, Simpan (PUT seluruh objek), galat per field, peringatan keluar. */
type Errors = Record<string, string[]>;
const ErrorsContext = createContext<Errors>({});
export const SAVED_MESSAGE = "Perubahan tersimpan dan langsung tampil di website.";
export const fieldId = (path: string) => `site-${path.replaceAll(".", "-")}`;
// Server men-trim semua teks; trim di sini agar spasi tepi tidak memicu galat format di klien.
const trimDeep = (value: unknown): unknown => typeof value === "string" ? value.trim()
  : Array.isArray(value) ? value.map(trimDeep)
  : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, trimDeep(item)])) : value;
export const formatUpdatedAt = (value: string) =>
  new Date(value).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });

export function Field({ path, label, value, max, hint, multiline = false, optional = false, inputMode, onChange }: {
  path: string; label: string; value: string; max: number; hint?: ReactNode; multiline?: boolean; optional?: boolean;
  inputMode?: "numeric" | "url"; onChange: (value: string) => void;
}) {
  const id = fieldId(path);
  const error = useContext(ErrorsContext)[path]?.join(" ");
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const props = {
    id, value, maxLength: max, required: !optional, inputMode, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    {hint && <p id={`${id}-hint`}>{hint}</p>}
    {multiline ? <textarea {...props} rows={5} /> : <input {...props} />}
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
  </div>;
}

export function Rows<T>({ path, title, items, max, min = 0, empty, onChange, children }: {
  path: string; title: string; items: T[]; max: number; min?: number; empty: T; onChange: (items: T[]) => void;
  children: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  const error = useContext(ErrorsContext)[path]?.join(" ");
  function move(index: number, step: number) {
    const next = [...items];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  }
  return <fieldset className={styles.fields} id={fieldId(path)}><legend>{title}</legend>
    <p>Maksimal {max} baris.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    {items.map((item, index) => <fieldset className={styles.fields} key={index}><legend>{title} {index + 1}</legend>
      {children(item, index, (value) => onChange(items.map((old, i) => i === index ? value : old)))}
      <div className={styles.actions}>
        <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Naik ${title} ${index + 1}`}>Naik</button>
        <button type="button" className="btn btn-secondary" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Turun ${title} ${index + 1}`}>Turun</button>
        <button type="button" className="btn btn-secondary" disabled={items.length <= min} onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label={`Hapus ${title} ${index + 1}`}>Hapus</button>
      </div>
    </fieldset>)}
    <button type="button" className="btn btn-secondary" disabled={items.length >= max} onClick={() => onChange([...items, structuredClone(empty)])}>Tambah {title.toLowerCase()}</button>
  </fieldset>;
}

export function SiteForm<K extends EditableSiteSectionKey>({ section, name, publicHref, initial, prepare = (data) => data, labels, intro, children }: {
  section: K;
  /** Nama bagian untuk teks, mis. "kontak kantor". */
  name: string;
  publicHref: string;
  /** Nilai lib/data.ts yang dipakai website saat bagian belum pernah disimpan. */
  initial: SiteSectionData[K];
  prepare?: (data: SiteSectionData[K]) => SiteSectionData[K];
  /** Nama tiap segmen path untuk ringkasan galat, mis. { blocks: "Blok teks", title: "Judul" }. */
  labels: Record<string, string>;
  intro?: ReactNode;
  children: (value: SiteSectionData[K], setValue: (value: SiteSectionData[K]) => void) => ReactNode;
}) {
  const { request, user } = useAdminSession();
  const allowed = !!user && ["admin", "staff"].includes(user.role);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState("");
  const message = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  useUnsavedChanges(dirty || busy);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void getStaffSiteSection(request, section).then((result) => {
      if (cancelled) return;
      const next = prepare(result.data);
      setValue(next); setSaved(next); setUpdatedAt(result.updated_at);
    }).catch((cause: unknown) => {
      if (cancelled || cause instanceof AdminUnauthorizedError) return;
      if (cause instanceof AdminSiteNotFoundError) {
        setValue(initial); setSaved(initial);
        setNotice("Isi di bawah adalah isi bawaan yang sedang tampil. Tekan Simpan untuk menerbitkan perubahan.");
      } else { setLoadFailed(true); setError(cause instanceof Error ? cause.message : "Gagal memuat bagian situs."); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // prepare/initial berasal dari modul statis; muat ulang hanya saat key/percobaan berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, request, section, attempt]);
  useEffect(() => { if (error || notice) message.current?.focus(); }, [error, notice, errors]);

  async function save() {
    if (inFlight.current) return;
    setNotice("");
    const parsed = siteSchemas[section].safeParse(trimDeep(value));
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) (next[issue.path.join(".") || "data"] ??= []).push(issue.message);
      setErrors(next); setError("Periksa kembali isian yang ditandai.");
      return;
    }
    inFlight.current = true; setBusy(true); setError(""); setErrors({});
    try {
      const result = await putStaffSiteSection(request, section, parsed.data as SiteSectionData[K]);
      const next = prepare(result.data);
      setValue(next); setSaved(next); setUpdatedAt(result.updated_at); setNotice(SAVED_MESSAGE);
    } catch (cause) {
      if (cause instanceof AdminUnauthorizedError) return;
      if (cause instanceof AdminValidationError) setErrors(cause.fields);
      setError(cause instanceof Error ? cause.message : "Gagal menyimpan bagian situs.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  const label = (path: string) => path === "data" ? "Isian" : path.split(".").map((part) => /^\d+$/.test(part) ? String(Number(part) + 1) : labels[part] ?? part).filter(Boolean).join(" ");
  if (!allowed) return <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>;
  if (loading) return <p role="status">Memuat isi {name}…</p>;
  if (loadFailed) return <div><p className="error-box" role="alert">{error}</p><button className="btn" onClick={() => { setLoading(true); setError(""); setLoadFailed(false); setAttempt((n) => n + 1); }}>Coba lagi</button></div>;
  return <div className={styles.editor}>
    <a className="btn btn-secondary" href={publicHref} target="_blank" rel="noopener noreferrer">Lihat halaman publik<span className="sr-only"> (dibuka di tab baru)</span></a>
    <p>{updatedAt ? `Terakhir diubah ${formatUpdatedAt(updatedAt)}.` : "Belum pernah diubah — website memakai isi bawaan."}</p>
    {intro}
    <p>Isi langsung tampil di website setelah disimpan. Jangan masukkan identitas warga atau dokumen pribadi.</p>
    <div ref={message} tabIndex={-1}>
      {error && <div className="error-box" role="alert"><p>{error}</p>
        {Object.keys(errors).length > 0 && <ul>{Object.entries(errors).map(([path, messages]) => <li key={path}><a href={`#${fieldId(path)}`}>{label(path)}: {messages.join(" ")}</a></li>)}</ul>}
      </div>}
      {notice && <p role="status">{notice}</p>}
    </div>
    {dirty && <p role="status">Perubahan belum disimpan</p>}
    <ErrorsContext.Provider value={errors}>
      <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
        <fieldset className={styles.fields} disabled={busy}><legend className="sr-only">Isi {name}</legend>
          {children(value, setValue)}
          <button className="btn" type="submit">Simpan</button>
        </fieldset>
      </form>
    </ErrorsContext.Provider>
    {busy && <p role="status">Menyimpan perubahan…</p>}
  </div>;
}
