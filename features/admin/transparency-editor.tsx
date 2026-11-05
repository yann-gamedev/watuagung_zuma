"use client";

import { useState } from "react";
import { pages } from "@/lib/data";
import { budgetTotals, formatRupiah, SPENDING_FIELDS } from "@/lib/transparency";
import { uploadTransparencyDocument } from "@/services/site";
import type { SiteBudget, SiteBudgetLine, SiteTransparency } from "@/types/site";
import { AdminUnauthorizedError, AdminValidationError } from "./api";
import { Field, Rows, SiteForm, fieldId, useSiteErrors } from "./site-form";
import { useAdminSession } from "./session";
import styles from "./news.module.css";

const labels = {
  intro: "Ringkasan", programs: "Blok program", title: "Judul", text: "Teks", budgets: "APBDes", year: "Tahun", status: "Status",
  revenue: "Pendapatan", spending: "Belanja", financing: "Pembiayaan", label: "Uraian", amount: "Jumlah", source: "Sumber", documentPath: "Dokumen PDF",
};
const STATUSES = ["Rancangan", "Ditetapkan", "Perubahan"] as const;
const initial: SiteTransparency = { intro: pages.transparansi.intro, programs: pages.transparansi.blocks, budgets: [] };
// NaN = kotak kosong; skema menolaknya sebelum dikirim.
const emptyLine: SiteBudgetLine = { label: "", amount: Number.NaN };
const known = (lines: SiteBudgetLine[] = []) => lines.map((line) => ({ ...line, amount: Number.isFinite(line.amount) ? line.amount : 0 }));

function Amount({ path, label, value, onChange }: { path: string; label: string; value: number; onChange: (value: number) => void }) {
  return <Field path={path} label={label} max={12} type="number" inputMode="numeric" value={Number.isFinite(value) ? String(value) : ""}
    hint={Number.isInteger(value) ? formatRupiah(value) : "Rupiah bulat, tanpa titik atau desimal."}
    onChange={(text) => onChange(text === "" ? Number.NaN : Number(text))} />;
}

function Total({ label, amount }: { label: string; amount: number }) {
  return <p><strong>{label}: {formatRupiah(amount)}</strong></p>;
}

function Budgets({ value, setValue, urls, setUrls, uploading, setUploading }: {
  value: SiteTransparency; setValue: (value: SiteTransparency) => void;
  urls: Record<string, string>; setUrls: (update: (old: Record<string, string>) => Record<string, string>) => void;
  uploading: boolean; setUploading: (busy: boolean) => void;
}) {
  const { request } = useAdminSession();
  const errors = useSiteErrors();
  const [selected, setSelected] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const index = Math.min(selected, value.budgets.length - 1);
  const budget = value.budgets[index];
  const p = `budgets.${index}`;

  // Galat pada tahun lain: buka tahun itu agar field yang ditandai terlihat (state disesuaikan saat render, tanpa effect).
  const [seenErrors, setSeenErrors] = useState(errors);
  if (seenErrors !== errors) {
    setSeenErrors(errors);
    const first = Object.keys(errors).map((path) => /^budgets\.(\d+)/.exec(path)?.[1]).find(Boolean);
    if (first !== undefined) setSelected(Number(first));
  }

  const setBudgets = (budgets: SiteBudget[]) => setValue({ ...value, budgets });
  const update = (next: Partial<SiteBudget>) => setBudgets(value.budgets.map((old, i) => i === index ? { ...old, ...next } : old));
  function add() {
    const year = Math.max(new Date().getFullYear(), ...value.budgets.map((item) => item.year + 1));
    setBudgets([...value.budgets, { year, status: "Rancangan", revenue: [structuredClone(emptyLine)], spending: SPENDING_FIELDS.map((label) => ({ label, amount: Number.NaN })), financing: [], source: "" }]);
    setSelected(value.budgets.length);
    setUploadError("");
  }
  async function upload(file: File) {
    setUploading(true); setUploadError("");
    try {
      const result = await uploadTransparencyDocument(request, file);
      setUrls((old) => ({ ...old, [result.path]: result.url }));
      update({ documentPath: result.path });
    } catch (cause) {
      if (cause instanceof AdminUnauthorizedError) return;
      setUploadError(cause instanceof AdminValidationError ? Object.values(cause.fields).flat().join(" ") : cause instanceof Error ? cause.message : "Gagal mengunggah dokumen.");
    } finally { setUploading(false); }
  }

  const totals = budget && budgetTotals({ revenue: known(budget.revenue), spending: known(budget.spending), financing: known(budget.financing) });
  const fileId = fieldId(`${p}.documentPath`);
  const fileError = uploadError || errors[`${p}.documentPath`]?.join(" ");
  return <fieldset className={styles.fields} id={fieldId("budgets")} disabled={uploading}><legend>APBDes per tahun</legend>
    <p>Maksimal 5 tahun. Total dihitung otomatis dari rincian; tidak perlu diketik.</p>
    {errors.budgets && <p className="field-error" role="alert">{errors.budgets.join(" ")}</p>}
    <div className={styles.actions}>
      {value.budgets.length > 0 && <div className={styles.field}>
        <label htmlFor="site-budget-select">Tahun yang disunting</label>
        <select id="site-budget-select" value={index} onChange={(event) => { setSelected(Number(event.target.value)); setUploadError(""); }}>
          {value.budgets.map((item, i) => <option key={i} value={i}>{Number.isFinite(item.year) ? item.year : "Tahun baru"} · {item.status}</option>)}
        </select>
      </div>}
      <button type="button" className="btn btn-secondary" disabled={value.budgets.length >= 5} onClick={add}>Tambah tahun</button>
    </div>
    {!budget ? <p>Belum ada APBDes. Halaman publik menampilkan &quot;APBDes resmi belum diunggah.&quot;</p> : <>
      <fieldset className={styles.fields}><legend>APBDes {Number.isFinite(budget.year) ? budget.year : ""}</legend>
        <Field path={`${p}.year`} label="Tahun" max={4} type="number" inputMode="numeric" value={Number.isFinite(budget.year) ? String(budget.year) : ""}
          onChange={(text) => update({ year: text === "" ? Number.NaN : Number(text) })} />
        <Field path={`${p}.status`} label="Status" max={20} options={STATUSES} value={budget.status} onChange={(status) => update({ status: status as SiteBudget["status"] })} />
      </fieldset>
      <Rows path={`${p}.revenue`} title="Pendapatan" items={budget.revenue} min={1} max={20} empty={emptyLine} onChange={(revenue) => update({ revenue })}>{(line, i, set) => <>
        <Field path={`${p}.revenue.${i}.label`} label="Uraian" value={line.label} max={160} hint="Contoh: Dana Desa, Alokasi Dana Desa, Pendapatan Asli Desa." onChange={(label) => set({ ...line, label })} />
        <Amount path={`${p}.revenue.${i}.amount`} label="Jumlah" value={line.amount} onChange={(amount) => set({ ...line, amount })} />
      </>}</Rows>
      <Total label="Total pendapatan" amount={totals!.revenue} />
      <fieldset className={styles.fields} id={fieldId(`${p}.spending`)}><legend>Belanja per bidang</legend>
        {budget.spending.map((line, i) => <Amount key={line.label} path={`${p}.spending.${i}.amount`} label={line.label} value={line.amount}
          onChange={(amount) => update({ spending: budget.spending.map((old, j) => i === j ? { ...old, amount } : old) })} />)}
        <Total label="Total belanja" amount={totals!.spending} />
      </fieldset>
      <Rows path={`${p}.financing`} title="Pembiayaan" items={budget.financing ?? []} max={10} empty={emptyLine} onChange={(financing) => update({ financing })}>{(line, i, set) => <>
        <Field path={`${p}.financing.${i}.label`} label="Uraian" value={line.label} max={160} hint="Opsional. Contoh: SiLPA tahun sebelumnya." onChange={(label) => set({ ...line, label })} />
        <Amount path={`${p}.financing.${i}.amount`} label="Jumlah" value={line.amount} onChange={(amount) => set({ ...line, amount })} />
      </>}</Rows>
      <Total label={totals!.surplus < 0 ? "Defisit (pendapatan − belanja)" : "Surplus (pendapatan − belanja)"} amount={Math.abs(totals!.surplus)} />
      <Field path={`${p}.source`} label="Sumber" value={budget.source} max={1000} hint="Contoh: Perdes Nomor … Tahun … tentang APBDes." onChange={(source) => update({ source })} />
      <div className={styles.field}>
        <label htmlFor={fileId}>Dokumen APBDes (PDF, maksimal 10 MB)</label>
        <p id={`${fileId}-hint`}>{budget.documentPath ? "Dokumen terpasang. Unggah lagi untuk mengganti; file lama dihapus setelah Simpan." : "Opsional. Dokumen tampil sebagai tombol unduh setelah Simpan."}</p>
        <input id={fileId} type="file" accept="application/pdf,.pdf" disabled={uploading} aria-invalid={fileError ? true : undefined}
          aria-describedby={[`${fileId}-hint`, fileError && `${fileId}-error`].filter(Boolean).join(" ")}
          onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
        {uploading && <p role="status">Mengunggah dokumen…</p>}
        {fileError && <p id={`${fileId}-error`} className="field-error" role="alert">{fileError}</p>}
        {budget.documentPath && <div className={styles.actions}>
          {urls[budget.documentPath] && <a className="btn btn-secondary" href={urls[budget.documentPath]} target="_blank" rel="noopener noreferrer">Lihat dokumen<span className="sr-only"> (dibuka di tab baru)</span></a>}
          <button type="button" className="btn btn-secondary" onClick={() => { const next = { ...budget }; delete next.documentPath; setBudgets(value.budgets.map((old, i) => i === index ? next : old)); }}>Lepas dokumen</button>
        </div>}
      </div>
      <button type="button" className="btn btn-secondary" onClick={() => { setBudgets(value.budgets.filter((_, i) => i !== index)); setSelected(0); setUploadError(""); }}>
        Hapus APBDes {Number.isFinite(budget.year) ? budget.year : "ini"}
      </button>
    </>}
  </fieldset>;
}

export function TransparencyEditor() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  return <SiteForm section="transparency" name="transparansi" publicHref="/transparansi/" initial={initial} labels={labels} pending={uploading}
    onEnvelope={(envelope) => setUrls((old) => ({ ...old, ...envelope.documentUrls }))}
    intro={<p>Isi angka sesuai dokumen APBDes resmi yang sudah ditetapkan. Jangan mengisi angka perkiraan.</p>}>
    {(value: SiteTransparency, setValue) => <>
      <Field path="intro" label="Ringkasan" value={value.intro} max={2000} onChange={(intro) => setValue({ ...value, intro })} />
      <Rows path="programs" title="Blok program" items={value.programs} min={1} max={20} empty={{ title: "", text: "" }} onChange={(programs) => setValue({ ...value, programs })}>{(block, i, update) => <>
        <Field path={`programs.${i}.title`} label="Judul" value={block.title} max={160} onChange={(title) => update({ ...block, title })} />
        <Field path={`programs.${i}.text`} label="Teks" value={block.text} max={10000} multiline onChange={(text) => update({ ...block, text })} />
      </>}</Rows>
      <Budgets value={value} setValue={setValue} urls={urls} setUrls={setUrls} uploading={uploading} setUploading={setUploading} />
    </>}
  </SiteForm>;
}
