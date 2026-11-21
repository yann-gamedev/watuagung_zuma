"use client";

import { useEffect, useRef, useState } from "react";
import { pages } from "@/lib/data";
import { uploadInstitutionLogo, type TextSiteKey } from "@/services/site";
import type { SiteSectionImageResponse } from "@/types/site";
import { AdminUnauthorizedError, AdminValidationError } from "./api";
import { useAdminSession } from "./session";
import type { SiteProfile, SiteProfileDetails } from "@/types/site";
import { Field, Rows, SiteForm } from "./site-form";
import styles from "./news.module.css";

const labels = {
  intro: "Ringkasan", blocks: "Blok teks", title: "Judul", text: "Teks", profileDetails: "", themes: "Tema", stats: "Angka utama",
  value: "Nilai", label: "Label", detail: "Rincian", location: "Lokasi", boundaries: "Batas", place: "Tempat",
  institutions: "Lembaga desa", name: "Nama lembaga", description: "Keterangan", source: "Sumber",
};

function defaults(section: TextSiteKey): SiteProfile {
  const page = pages[section === "profile" ? "profil" : "sejarah"];
  return { intro: page.intro, blocks: page.blocks, ...(section === "profile" ? { profileDetails: page.profileDetails } : {}) };
}
// Impor R3 lama belum punya details; mulai editor dari cadangan yang sama dengan publik.
const withDetails = (data: SiteProfile) => ({ ...data, profileDetails: data.profileDetails ?? pages.profil.profileDetails });

function InstitutionLogo({ path, url, onUploaded, onRemove, setPending }: {
  path: string; url?: string; onUploaded: (result: SiteSectionImageResponse) => void; onRemove: () => void; setPending: (pending: boolean) => void;
}) {
  const { request } = useAdminSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);
  const id = path.replaceAll(".", "-");
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  function clearLocalPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setLocalPreview(null);
  }

  async function upload(file: File) {
    clearLocalPreview();
    const preview = URL.createObjectURL(file);
    previewRef.current = preview;
    setLocalPreview(preview);
    setBusy(true); setPending(true); setError("");
    try { onUploaded(await uploadInstitutionLogo(request, file)); }
    catch (cause) {
      clearLocalPreview();
      if (cause instanceof AdminUnauthorizedError) return;
      setError(cause instanceof AdminValidationError ? Object.values(cause.fields).flat().join(" ") : cause instanceof Error ? cause.message : "Gagal mengunggah logo.");
    } finally { setBusy(false); setPending(false); }
  }
  return <div className={styles.field}>
    <label htmlFor={id}>Logo lembaga (opsional)</label>
    <p id={`${id}-hint`}>PNG, JPG, atau WebP, maksimal 2 MB. Logo tanpa unggahan memakai ikon bawaan.</p>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} aria-invalid={error ? true : undefined}
      onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    {busy && <p role="status">Mengunggah logo…</p>}
    {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    {(localPreview || url) && <div className={styles.actions}>
      {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau gambar unggahan API */}
      <img src={localPreview ?? url} alt="Pratinjau logo lembaga" width={72} height={72} style={{ width: 72, height: 72, objectFit: "contain" }} />
      <button type="button" className="btn btn-secondary" onClick={() => { clearLocalPreview(); onRemove(); }}>Hapus logo</button>
    </div>}
  </div>;
}

export function SiteEditor({ section }: { section: TextSiteKey }) {
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  return <SiteForm section={section} name={section === "profile" ? "profil" : "sejarah"} publicHref={section === "profile" ? "/profil/" : "/sejarah/"}
    initial={defaults(section)} prepare={section === "profile" ? withDetails : undefined} labels={labels} pending={uploading}
    onEnvelope={(envelope) => setLogoUrls(envelope.institutionImageUrls ?? {})}>
    {(value: SiteProfile, setValue) => {
      const details = value.profileDetails;
      const updateDetails = (next: Partial<SiteProfileDetails>) => setValue({ ...value, profileDetails: { ...details!, ...next } });
      const d = "profileDetails";
      return <>
        <Field path="intro" label="Ringkasan" value={value.intro} max={2000} onChange={(intro) => setValue({ ...value, intro })} />
        {details && <>
          <fieldset className={styles.fields} id={`site-${d}-themes`}><legend>Tema</legend><div className={styles.actions}>
            {details.themes.map((theme, i) => <div className={styles.actions} key={i}><Field path={`${d}.themes.${i}`} label={`Tema ${i + 1}`} value={theme} max={160} onChange={(text) => updateDetails({ themes: details.themes.map((old, j) => i === j ? text : old) })} /><button type="button" className="btn btn-secondary" aria-label={`Hapus tema ${i + 1}`} onClick={() => updateDetails({ themes: details.themes.filter((_, j) => i !== j) })}>Hapus</button></div>)}
          </div><button type="button" className="btn btn-secondary" disabled={details.themes.length >= 6} onClick={() => updateDetails({ themes: [...details.themes, ""] })}>Tambah tema</button></fieldset>
          <Rows path={`${d}.stats`} title="Angka utama" items={details.stats} max={6} empty={{ value: "", label: "" }} onChange={(stats) => updateDetails({ stats })}>{(stat, i, update) => <>
            <Field path={`${d}.stats.${i}.value`} label="Nilai" value={stat.value} max={160} onChange={(value) => update({ ...stat, value })} />
            <Field path={`${d}.stats.${i}.label`} label="Label" value={stat.label} max={160} onChange={(label) => update({ ...stat, label })} />
            <Field path={`${d}.stats.${i}.detail`} label="Rincian (opsional)" optional value={stat.detail ?? ""} max={1000} onChange={(detail) => { const next = { ...stat }; if (detail) next.detail = detail; else delete next.detail; update(next); }} />
          </>}</Rows>
          <fieldset className={styles.fields}><legend>Lokasi dan batas wilayah</legend>
            <Field path={`${d}.location`} label="Lokasi" value={details.location} max={1000} onChange={(location) => updateDetails({ location })} />
            {details.boundaries.map((boundary, i) => <Field key={boundary.direction} path={`${d}.boundaries.${i}.place`} label={boundary.direction} value={boundary.place} max={1000} onChange={(place) => updateDetails({ boundaries: details.boundaries.map((old, j) => i === j ? { ...old, place } : old) })} />)}
          </fieldset>
          <Rows path={`${d}.institutions`} title="Lembaga desa" items={details.institutions} max={20} empty={{ name: "", description: "" }} onChange={(institutions) => updateDetails({ institutions })}>{(institution, i, update) => <>
            <Field path={`${d}.institutions.${i}.name`} label="Nama lembaga" value={institution.name} max={160} onChange={(name) => update({ ...institution, name })} />
            <Field path={`${d}.institutions.${i}.description`} label="Keterangan" value={institution.description} max={2000} onChange={(description) => update({ ...institution, description })} />
            <InstitutionLogo path={`${d}.institutions.${i}.logoPath`} url={institution.logoPath ? logoUrls[institution.logoPath] : undefined} setPending={setUploading}
              onUploaded={(result) => { setLogoUrls((current) => ({ ...current, [result.path]: result.url })); update({ ...institution, logoPath: result.path }); }}
              onRemove={() => { const next = { ...institution }; delete next.logoPath; update(next); }} />
          </>}</Rows>
        </>}
        <Rows path="blocks" title="Blok teks" items={value.blocks} min={1} max={20} empty={{ title: "", text: "" }} onChange={(blocks) => setValue({ ...value, blocks })}>{(block, i, update) => <>
          <Field path={`blocks.${i}.title`} label="Judul" value={block.title} max={160} onChange={(title) => update({ ...block, title })} />
          <Field path={`blocks.${i}.text`} label="Teks" value={block.text} max={10000} multiline onChange={(text) => update({ ...block, text })} />
        </>}</Rows>
        {details && <Field path={`${d}.source`} label="Sumber" value={details.source} max={1000} onChange={(source) => updateDetails({ source })} />}
      </>;
    }}
  </SiteForm>;
}
