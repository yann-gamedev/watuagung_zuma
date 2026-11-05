"use client";

import { useState } from "react";
import { pages } from "@/lib/data";
import { uploadStructureImage } from "@/services/site";
import type { SiteStructure } from "@/types/site";
import { AdminUnauthorizedError, AdminValidationError } from "./api";
import { Field, Rows, SiteForm, fieldId, useSiteErrors } from "./site-form";
import { useAdminSession } from "./session";
import styles from "./news.module.css";

const page = pages["struktur-pemerintahan"];
const initial: SiteStructure = { blocks: page.blocks, source: page.source! };
const labels = { chartImagePath: "Gambar bagan", chartAlt: "Deskripsi gambar", blocks: "Nama dan jabatan", title: "Judul", text: "Teks", source: "Sumber" };

function Chart({ value, setValue, url, setUrl, setUploading }: {
  value: SiteStructure; setValue: (value: SiteStructure) => void;
  url: string | null; setUrl: (url: string | null) => void; setUploading: (busy: boolean) => void;
}) {
  const { request } = useAdminSession();
  const errors = useSiteErrors();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const id = fieldId("chartImagePath");
  const fileError = error || errors.chartImagePath?.join(" ");
  async function upload(file: File) {
    setBusy(true); setUploading(true); setError("");
    try {
      const result = await uploadStructureImage(request, file);
      setUrl(result.url);
      setValue({ ...value, chartImagePath: result.path });
    } catch (cause) {
      if (cause instanceof AdminUnauthorizedError) return;
      setError(cause instanceof AdminValidationError ? Object.values(cause.fields).flat().join(" ") : cause instanceof Error ? cause.message : "Gagal mengunggah gambar.");
    } finally { setBusy(false); setUploading(false); }
  }
  return <fieldset className={styles.fields}><legend>Bagan pemerintahan</legend>
    <div className={styles.field}>
      <label htmlFor={id}>Unggah atau ganti gambar bagan</label>
      <p id={`${id}-hint`}>Opsional. JPG, PNG, atau WebP, maksimal 5 MB; ukuran 600 × 400 sampai 6000 × 6000 piksel. Lebar hasil maksimal 2400 piksel. Gambar lama dihapus setelah Simpan.</p>
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-invalid={fileError ? true : undefined}
        aria-describedby={[`${id}-hint`, fileError && `${id}-error`].filter(Boolean).join(" ")}
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
      {fileError && <p id={`${id}-error`} className="field-error" role="alert">{fileError}</p>}
      {busy && <p role="status">Mengunggah gambar…</p>}
    </div>
    {value.chartImagePath && <>
      {url && <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- gambar unggahan API, static export */}
        <img src={url} alt={value.chartAlt || "Pratinjau bagan yang belum diberi deskripsi"} style={{ maxWidth: "100%", height: "auto" }} />
      </div>}
      <button type="button" className="btn btn-secondary" onClick={() => { const next = { ...value }; delete next.chartImagePath; delete next.chartAlt; setValue(next); setUrl(null); setError(""); }}>Hapus gambar</button>
    </>}
    <Field path="chartAlt" label="Deskripsi gambar untuk pembaca layar" value={value.chartAlt ?? ""} max={300} optional={!value.chartImagePath}
      hint="Wajib bila memakai gambar. Nama dan jabatan lengkap tetap ditulis pada blok teks di bawah."
      onChange={(chartAlt) => setValue({ ...value, chartAlt })} />
  </fieldset>;
}

export function StructureEditor() {
  const [url, setUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  return <SiteForm section="structure" name="struktur pemerintahan" publicHref="/struktur-pemerintahan/" initial={initial} labels={labels}
    pending={uploading} onEnvelope={(envelope) => setUrl(envelope.imageUrl ?? null)}>
    {(value, setValue) => <>
      <Chart value={value} setValue={setValue} url={url} setUrl={setUrl} setUploading={setUploading} />
      <Rows path="blocks" title="Nama dan jabatan" items={value.blocks} min={1} max={20} empty={{ title: "", text: "" }} onChange={(blocks) => setValue({ ...value, blocks })}>{(block, i, update) => <>
        <Field path={`blocks.${i}.title`} label="Judul kelompok atau jabatan" value={block.title} max={160} onChange={(title) => update({ ...block, title })} />
        <Field path={`blocks.${i}.text`} label="Nama dan jabatan" value={block.text} max={10000} multiline onChange={(text) => update({ ...block, text })} />
      </>}</Rows>
      <Field path="source" label="Sumber" value={value.source} max={1000} onChange={(source) => setValue({ ...value, source })} />
    </>}
  </SiteForm>;
}
