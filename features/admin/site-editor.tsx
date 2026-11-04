"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { pages } from "@/lib/data";
import { parseSiteSection, siteSchemas, type TextSiteKey } from "@/services/site";
import type { SiteProfile, SiteProfileDetails } from "@/types/site";
import { AdminSiteNotFoundError, AdminUnauthorizedError } from "./api";
import { useAdminSession } from "./session";
import { useUnsavedChanges } from "./use-unsaved-changes";
import styles from "./news.module.css";

function defaults(section: TextSiteKey): SiteProfile {
  const page = pages[section === "profile" ? "profil" : "sejarah"];
  return { intro: page.intro, blocks: page.blocks, ...(section === "profile" ? { profileDetails: page.profileDetails } : {}) };
}

function Field({ id, label, value, max, multiline = false, optional = false, onChange }: {
  id: string; label: string; value: string; max: number; multiline?: boolean; optional?: boolean; onChange: (value: string) => void;
}) {
  const props = { id, value, maxLength: max, required: !optional, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <div className={styles.field}><label htmlFor={id}>{label}</label>{multiline ? <textarea {...props} rows={5} /> : <input {...props} />}</div>;
}

function Rows<T>({ title, items, max, min = 0, empty, onChange, children }: {
  title: string; items: T[]; max: number; min?: number; empty: T; onChange: (items: T[]) => void;
  children: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  function move(index: number, step: number) {
    const next = [...items];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  }
  return <fieldset className={styles.fields}><legend>{title}</legend>
    <p>Maksimal {max} baris.</p>
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

export function SiteEditor({ section }: { section: TextSiteKey }) {
  const { request, user } = useAdminSession();
  const allowed = !!user && ["admin", "staff"].includes(user.role);
  const [value, setValue] = useState<SiteProfile>(() => defaults(section));
  const [saved, setSaved] = useState<SiteProfile>(() => defaults(section));
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const message = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);
  useUnsavedChanges(dirty || busy);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    void request<unknown>(`/staff/site/${section}`).then((response) => parseSiteSection(section, response)).then((data) => {
      if (cancelled) return;
      // Impor R3 lama belum punya details; mulai editor dari cadangan yang sama dengan publik.
      const next = section === "profile" ? { ...data, profileDetails: (data as SiteProfile).profileDetails ?? pages.profil.profileDetails } : data;
      setValue(next); setSaved(next);
    }).catch((cause: unknown) => {
      if (cancelled || cause instanceof AdminUnauthorizedError) return;
      if (cause instanceof AdminSiteNotFoundError) {
        const next = defaults(section); setValue(next); setSaved(next);
        setNotice("Bagian belum diisi. Nilai awal ditampilkan; tekan Simpan untuk menerbitkan.");
      } else { setLoadFailed(true); setError(cause instanceof Error ? cause.message : "Gagal memuat bagian situs."); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [allowed, request, section, attempt]);
  useEffect(() => { if (error || notice) message.current?.focus(); }, [error, notice]);

  async function save() {
    if (inFlight.current) return;
    const parsed = siteSchemas[section].safeParse(value);
    if (!parsed.success) { setNotice(""); setError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" ")); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const next = parseSiteSection(section, await request<unknown>(`/staff/site/${section}`, { method: "PUT", body: JSON.stringify({ data: parsed.data }) }));
      setValue(next); setSaved(next); setNotice("Perubahan berhasil disimpan. Muat ulang halaman publik untuk melihatnya.");
    } catch (cause) {
      if (!(cause instanceof AdminUnauthorizedError)) setError(cause instanceof Error ? cause.message : "Gagal menyimpan bagian situs.");
    } finally { inFlight.current = false; setBusy(false); }
  }
  if (!allowed) return <p className="error-box" role="alert">Halaman ini tidak tersedia untuk peran Anda.</p>;
  if (loading) return <p role="status">Memuat bagian situs…</p>;
  if (loadFailed) return <div><p className="error-box" role="alert">{error}</p><button className="btn" onClick={() => { setLoading(true); setError(""); setLoadFailed(false); setAttempt((n) => n + 1); }}>Coba lagi</button></div>;
  const details = value.profileDetails;
  function updateDetails(next: Partial<SiteProfileDetails>) { setValue({ ...value, profileDetails: { ...details!, ...next } }); }
  return <div className={styles.editor}>
    <a className="btn btn-secondary" href={section === "profile" ? "/profil/" : "/sejarah/"} target="_blank" rel="noopener noreferrer">Lihat halaman publik<span className="sr-only"> (dibuka di tab baru)</span></a>
    <p>Konten langsung tampil di website setelah disimpan. Jangan masukkan identitas warga atau dokumen pribadi.</p>
    <div ref={message} tabIndex={-1}>{error && <p className="error-box" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}</div>
    {dirty && <p role="status">Perubahan belum disimpan</p>}
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset className={styles.fields} disabled={busy}><legend className="sr-only">Isi {section === "profile" ? "profil" : "sejarah"}</legend>
        <Field id="site-intro" label="Ringkasan" value={value.intro} max={2000} onChange={(intro) => setValue({ ...value, intro })} />
        {details && <>
          <fieldset className={styles.fields}><legend>Tema</legend><div className={styles.actions}>
            {details.themes.map((theme, i) => <div className={styles.actions} key={i}><Field id={`theme-${i}`} label={`Tema ${i + 1}`} value={theme} max={160} onChange={(text) => updateDetails({ themes: details.themes.map((old, j) => i === j ? text : old) })} /><button type="button" className="btn btn-secondary" aria-label={`Hapus tema ${i + 1}`} onClick={() => updateDetails({ themes: details.themes.filter((_, j) => i !== j) })}>Hapus</button></div>)}
          </div><button type="button" className="btn btn-secondary" disabled={details.themes.length >= 6} onClick={() => updateDetails({ themes: [...details.themes, ""] })}>Tambah tema</button></fieldset>
          <Rows title="Angka utama" items={details.stats} max={6} empty={{ value: "", label: "" }} onChange={(stats) => updateDetails({ stats })}>{(stat, i, update) => <>
            <Field id={`stat-value-${i}`} label="Nilai" value={stat.value} max={160} onChange={(value) => update({ ...stat, value })} />
            <Field id={`stat-label-${i}`} label="Label" value={stat.label} max={160} onChange={(label) => update({ ...stat, label })} />
            <Field id={`stat-detail-${i}`} label="Rincian (opsional)" optional value={stat.detail ?? ""} max={1000} onChange={(detail) => { const next = { ...stat }; if (detail) next.detail = detail; else delete next.detail; update(next); }} />
          </>}</Rows>
          <fieldset className={styles.fields}><legend>Lokasi dan batas wilayah</legend>
            <Field id="site-location" label="Lokasi" value={details.location} max={1000} onChange={(location) => updateDetails({ location })} />
            {details.boundaries.map((boundary, i) => <Field key={boundary.direction} id={`boundary-${i}`} label={boundary.direction} value={boundary.place} max={1000} onChange={(place) => updateDetails({ boundaries: details.boundaries.map((old, j) => i === j ? { ...old, place } : old) })} />)}
          </fieldset>
          <Rows title="Lembaga desa" items={details.institutions} max={20} empty={{ name: "", description: "" }} onChange={(institutions) => updateDetails({ institutions })}>{(institution, i, update) => <>
            <Field id={`institution-name-${i}`} label="Nama lembaga" value={institution.name} max={160} onChange={(name) => update({ ...institution, name })} />
            <Field id={`institution-description-${i}`} label="Keterangan" value={institution.description} max={2000} onChange={(description) => update({ ...institution, description })} />
          </>}</Rows>
        </>}
        <Rows title="Blok teks" items={value.blocks} min={1} max={20} empty={{ title: "", text: "" }} onChange={(blocks) => setValue({ ...value, blocks })}>{(block, i, update) => <>
          <Field id={`block-title-${i}`} label="Judul" value={block.title} max={160} onChange={(title) => update({ ...block, title })} />
          <Field id={`block-text-${i}`} label="Teks" value={block.text} max={10000} multiline onChange={(text) => update({ ...block, text })} />
        </>}</Rows>
        {details && <Field id="site-source" label="Sumber" value={details.source} max={1000} onChange={(source) => updateDetails({ source })} />}
        <button className="btn" type="submit">Simpan</button>
      </fieldset>
    </form>
    {busy && <p role="status">Menyimpan perubahan…</p>}
  </div>;
}
