"use client";

import { useEffect, useRef } from "react";
import { Camera, FolderOpen } from "lucide-react";
import { prepareAttachment } from "@/lib/attachments";
import { attachmentKinds, attachmentKindLabels, type AttachmentKind, type SubmissionAttachments } from "@/types/pelayanan";

function ImagePreview({ file, label }: { file: Blob; label: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Blob privat di browser, tidak memakai pengoptimal gambar server Next.js.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={`Pratinjau ${label}`} className="h-32 max-w-full object-contain" />;
}

export function DocumentUpload({ files, errors, busy, onBusy, onChange, onError, replacement = false }: {
  files: Partial<SubmissionAttachments>;
  errors: Partial<Record<AttachmentKind, string>>;
  busy: boolean;
  replacement?: boolean;
  onBusy: (busy: boolean) => void;
  onChange: (kind: AttachmentKind, file?: File) => void;
  onError: (kind: AttachmentKind, message: string) => void;
}) {
  async function choose(kind: AttachmentKind, file?: File) {
    if (!file) return;
    onBusy(true);
    onError(kind, "");
    try { onChange(kind, await prepareAttachment(file)); }
    catch (error) { onError(kind, error instanceof Error ? error.message : "Dokumen gagal diproses. Pilih kembali."); }
    finally { onBusy(false); }
  }
  return <section aria-labelledby="upload-heading">
    <h2 id="upload-heading" tabIndex={-1}>{replacement ? "Ganti dokumen" : "Unggah dokumen"}</h2>
    <p className="form-help mt-2" id="upload-help">{replacement ? "Pilih hanya dokumen yang perlu diganti. Dokumen lain tetap tersimpan." : "Ketiga dokumen wajib dilampirkan."} Foto seluruh kartu, tidak terpotong, tidak silau, tulisan terbaca.</p>
    <p className="form-help mt-2">Gambar diperkecil otomatis. PDF maksimal 5 MB per dokumen. Dokumen dikirim hanya setelah Anda menekan tombol kirim.</p>
    {attachmentKinds.map((kind) => <DocumentCard key={kind} kind={kind} required={!replacement} file={files[kind]} error={errors[kind]} disabled={busy} choose={choose} remove={() => onChange(kind)} />)}
    {busy && <p role="status" className="form-help">Memproses foto…</p>}
  </section>;
}

function DocumentCard({ kind, required, file, error, disabled, choose, remove }: {
  kind: AttachmentKind;
  required: boolean;
  file?: Blob;
  error?: string;
  disabled: boolean;
  choose: (kind: AttachmentKind, file?: File) => Promise<void>;
  remove: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const label = attachmentKindLabels[kind];
  const describedBy = `upload-help${error ? ` error-${kind}` : ""}`;
  return <fieldset className="border! border-(--line)! rounded-[14px] p-4!" disabled={disabled} aria-describedby={describedBy}>
    <legend>{label}{required ? " *" : " (bila perlu diganti)"}</legend>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={`Ambil foto ${label}`} onChange={(event) => { void choose(kind, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    <input ref={picker} type="file" accept="image/*,application/pdf" hidden aria-label={`Pilih file ${label}`} onChange={(event) => { void choose(kind, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
    {file && <div className="mb-4" role="status">
      {file.type === "application/pdf" ? <p>PDF terpilih</p> : <ImagePreview file={file} label={label} />}
      <p className="form-help">{file.type === "application/pdf" ? "PDF" : "Foto JPG"} · {(file.size / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} MB</p>
    </div>}
    <div className="flex flex-wrap gap-3">
      <button id={`attachment-${kind}`} type="button" className="btn btn-secondary" aria-describedby={describedBy} onClick={() => camera.current?.click()}><Camera size={22} aria-hidden="true" />Ambil foto<span className="sr-only"> {label}</span></button>
      <button type="button" className="btn btn-secondary" aria-describedby={describedBy} onClick={() => picker.current?.click()}><FolderOpen size={22} aria-hidden="true" />{file ? "Ganti" : "Pilih file"}<span className="sr-only"> {label}</span></button>
      {file && <button type="button" className="btn btn-secondary" onClick={remove}>Hapus<span className="sr-only"> {label}</span></button>}
    </div>
    {error && <p id={`error-${kind}`} className="field-error mt-3" role="alert">{error}</p>}
  </fieldset>;
}
