"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, LoaderCircle, CircleAlert } from "lucide-react";
import { FormField } from "@/components/form-field";
import { services } from "@/lib/data";
import { submissionSchema, type SubmissionValues } from "@/lib/validation";
import { agamaOptions, dusunOptions, kewarganegaraanOptions, pendidikanOptions, statusPerkawinanOptions, attachmentKinds, attachmentKindLabels, type AttachmentKind, type SubmissionAttachments } from "@/types/pelayanan";
import { pelayananService, isDemo, SubmissionValidationError } from "@/services/pelayanan";
import { DocumentUpload } from "./document-upload";
import { maskApplicantEmail } from "@/lib/applicant-email";
import { HubungiPetugas } from "@/components/hubungi-petugas";

const labels: Partial<Record<keyof SubmissionValues, string>> = {
  nama: "Nama lengkap", nik: "NIK", no_kk: "Nomor KK", tempat_lahir: "Tempat lahir", tanggal_lahir: "Tanggal lahir",
  email: "Email", email_consent: "Persetujuan email", jenis_kelamin: "Jenis kelamin", telepon: "Nomor telepon", dusun: "Dusun", agama: "Agama", kewarganegaraan: "Kewarganegaraan",
  status_perkawinan: "Status perkawinan", pendidikan: "Pendidikan", pekerjaan: "Pekerjaan", alamat: "Alamat lengkap", rt: "RT", rw: "RW",
  keperluan: "Keperluan surat", barang_hilang: "Barang atau dokumen yang hilang", acara: "Acara", tempat_acara: "Tempat acara",
  tanggal_mulai: "Tanggal mulai", tanggal_selesai: "Tanggal selesai", jenis_hiburan: "Jenis hiburan", isi_keterangan: "Isi keterangan",
};
const sensitiveHint = "Dicetak di surat sesuai format desa. Disimpan terenkripsi.";
const jobs = ["Pelajar/Mahasiswa", "Karyawan Swasta", "Petani/Pekebun", "Wiraswasta", "Mengurus Rumah Tangga", "Belum/Tidak Bekerja"];

const noSubscribe = () => () => {};

export function ApplicationForm({ code }: { code: SubmissionValues["jenis_surat"] }) {
  const router = useRouter();
  // false di HTML statis/server, true setelah hidrasi. Sebelum itu tombol dikunci: form ber-method post akan
  // terkirim secara bawaan browser dan memuat ulang halaman tanpa pesan (pengajuan tidak terkirim, kode akses tidak tampil).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [error, setError] = useState("");
  const [acceptedId, setAcceptedId] = useState("");
  const [review, setReview] = useState<SubmissionValues | null>(null);
  const [step, setStep] = useState<"data" | "documents" | "review">("data");
  const [files, setFiles] = useState<Partial<SubmissionAttachments>>({});
  const [documentErrors, setDocumentErrors] = useState<Partial<Record<AttachmentKind, string>>>({});
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const stepHeading = useRef<HTMLDivElement>(null);
  const errorSummary = useRef<HTMLDivElement>(null);
  const { register, handleSubmit, setFocus, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { jenis_surat: code, kewarganegaraan: "WNI", email: "", email_consent: false },
    mode: "onBlur",
  });
  useEffect(() => { stepHeading.current?.querySelector<HTMLElement>("h2")?.focus(); }, [step]);
  useEffect(() => { if (error) errorSummary.current?.focus(); }, [error]);
  function changeDocument(kind: AttachmentKind, file?: File) {
    setFiles((previous) => ({ ...previous, [kind]: file }));
    setDocumentErrors((previous) => ({ ...previous, [kind]: "" }));
    setError("");
  }
  const field = (name: keyof SubmissionValues, label: string, type = "text", wide = false) => (
    <FormField key={name} name={name} label={label} type={type} wide={wide} register={register} errors={errors} />
  );
  const select = (name: keyof SubmissionValues, options: readonly string[], hint?: string) => (
    <FormField name={name} label={labels[name]!} options={options} hint={hint} register={register} errors={errors} />
  );
  async function submit(values: SubmissionValues) {
    if (acceptedId || processing) return;
    setError("");
    setReview(values);
    if (step === "data") { setStep("documents"); return; }
    const missing = attachmentKinds.filter((kind) => !files[kind]);
    if (missing.length || attachmentKinds.some((kind) => documentErrors[kind])) {
      setDocumentErrors((previous) => ({ ...previous, ...Object.fromEntries(missing.map((kind) => [kind, `${attachmentKindLabels[kind]} wajib dilampirkan.`])) }));
      setStep("documents");
      setError("Periksa dokumen yang ditandai. Lengkapi atau pilih ulang sebelum melanjutkan.");
      return;
    }
    if (step === "documents") { setStep("review"); return; }
    setProgress(null);
    try {
      const result = await pelayananService.submit(values, files as SubmissionAttachments, setProgress);
      setFiles({});
      setAcceptedId(result.request_id);
      // Email utuh tidak disimpan di browser/URL; hanya versi tersamar pada bukti tab ini.
      try {
        if (!isDemo && values.email) sessionStorage.setItem(`watuagung-receipt-email-${result.request_id}`, maskApplicantEmail(values.email));
        sessionStorage.setItem(`watuagung-receipt-type-${result.request_id}`, result.jenis_surat || code);
      } catch { /* Jenis tetap tersedia melalui cek status. */ }
      if (result.lookup_secret) {
        try {
          sessionStorage.setItem(`watuagung-receipt-${result.request_id}`, result.lookup_secret);
        } catch {
          setError(`Pengajuan ${result.request_id} sudah diterima. Penyimpanan tab tidak tersedia. Simpan kode akses rahasia ini sebelum meninggalkan halaman: ${result.lookup_secret}`);
          return;
        }
      }
      router.push("/pelayanan/sukses/?id=" + encodeURIComponent(result.request_id));
    } catch (e) {
      if (e instanceof SubmissionValidationError) {
        const attachments: Partial<Record<AttachmentKind, string>> = {};
        let hasFieldError = false;
        for (const [name, messages] of Object.entries(e.errors)) {
          const kind = attachmentKinds.find((kind) => name === `lampiran.${kind}`);
          if (kind) attachments[kind] = messages.join(" ");
          else if (name in labels) {
            setFieldError(name as keyof SubmissionValues, { type: "server", message: messages.join(" ") });
            hasFieldError = true;
          }
        }
        setDocumentErrors(attachments);
        setStep(hasFieldError ? "data" : "documents");
      }
      setError(e instanceof Error ? e.message : "Pengajuan gagal. Silakan coba lagi.");
    }
  }
  const item = services.find((service) => service.code === code);
  return (
    <div className="form-layout application-form">
      <div>
        <div className="notice">{isDemo
          ? "Mode simulasi. Gunakan data fiktif. Data identitas tidak disimpan atau dikirim ke pemerintah desa. Email pemberitahuan tidak dikirim."
          : "Periksa data sebelum mengirim. Permohonan akan diteruskan ke layanan administrasi desa."}</div>
        <form className="form-card" method="post" onSubmit={handleSubmit(submit, (invalid) => {
          setStep("data");
          const first = Object.keys(invalid)[0] as keyof SubmissionValues | undefined;
          if (first) setTimeout(() => setFocus(first), 0);
        })} noValidate aria-busy={isSubmitting || processing}>
          <p className="form-help mb-4" aria-live="polite">{step === "data" ? "Langkah 1 dari 3: Isi formulir" : step === "documents" ? "Langkah 2 dari 3: Unggah dokumen" : "Langkah 3 dari 3: Periksa ringkasan"}</p>
          {error && <div ref={errorSummary} className="error-box mb-4" role="alert" tabIndex={-1}>
            <CircleAlert size={22} aria-hidden="true" /><div><p>{error}</p>
              {step === "documents" && attachmentKinds.filter((kind) => documentErrors[kind]).map((kind) => <p key={kind}><a className="underline" href={`#attachment-${kind}`}>{attachmentKindLabels[kind]}: {documentErrors[kind]}</a></p>)}
            </div>
          </div>}
          <div ref={step === "data" ? stepHeading : undefined} hidden={step !== "data"}>
            <h2 tabIndex={-1}>Formulir permohonan</h2>
            <p className="mt-2 form-help">Semua kolom bertanda * wajib diisi. Setelah lengkap, periksa ringkasan sebelum kirim.</p>
            <fieldset disabled={isSubmitting}>
              <legend>Data diri</legend>
              <div className="fields">
                <FormField name="nik" label="NIK" wide register={register} errors={errors} hint="Masukkan 16 digit NIK." />
                {field("nama", "Nama lengkap", "text", true)}
                {field("no_kk", "Nomor KK")}
                {field("tempat_lahir", "Tempat lahir")}
                {field("tanggal_lahir", "Tanggal lahir", "date")}
                {select("jenis_kelamin", ["Laki-laki", "Perempuan"])}
              </div>
            </fieldset>
            <fieldset disabled={isSubmitting}>
              <legend>Kontak</legend>
              <div className="fields">
                {field("telepon", "Nomor telepon", "tel")}
                <FormField name="email" label="Email (opsional)" type="email" required={false} register={register} errors={errors} hint="Kami kirim kabar setiap status surat berubah. Isi email yang aktif." />
                <div className="wide">
                  <label className="flex min-h-12 items-center gap-3" htmlFor="email_consent">
                    <input id="email_consent" type="checkbox" className="size-6 shrink-0 accent-[var(--leaf)]" {...register("email_consent")} aria-invalid={!!errors.email_consent} aria-describedby={errors.email_consent ? "email_consent-error" : undefined} />
                    Saya bersedia menerima email pemberitahuan
                  </label>
                  {errors.email_consent && <p id="email_consent-error" className="field-error" role="alert">{errors.email_consent.message}</p>}
                </div>
              </div>
            </fieldset>
            <fieldset disabled={isSubmitting}>
              <legend>Data diri tambahan</legend>
              <div className="fields">
                {select("dusun", dusunOptions)}
                {select("kewarganegaraan", kewarganegaraanOptions)}
                {select("agama", agamaOptions, sensitiveHint)}
                {select("status_perkawinan", statusPerkawinanOptions, sensitiveHint)}
                {select("pendidikan", pendidikanOptions)}
                <FormField name="pekerjaan" label="Pekerjaan" register={register} errors={errors} suggestions={jobs} hint="Pilih saran atau tulis pekerjaan Anda, maksimal 60 karakter." />
              </div>
            </fieldset>
            <fieldset disabled={isSubmitting}>
              <legend>Alamat</legend>
              <div className="fields">
                {field("alamat", "Alamat lengkap", "textarea", true)}
                {field("rt", "RT")}
                {field("rw", "RW")}
              </div>
            </fieldset>
            <fieldset disabled={isSubmitting}>
              <legend>Keperluan</legend>
              <div className="fields">
                {code === "KEHILANGAN" && <FormField name="barang_hilang" label="Barang atau dokumen yang hilang" type="textarea" wide placeholder="Contoh: KTP" register={register} errors={errors} />}
                {code === "UMUM" && <FormField name="isi_keterangan" label="Isi keterangan" type="textarea" wide placeholder="Contoh: Bekerja di Surabaya" hint="Petugas dapat menyesuaikan kalimat sebelum surat dibuat." register={register} errors={errors} />}
                <FormField name="keperluan" label={code === "UMUM" ? "Tujuan penggunaan surat" : "Keperluan surat"} type="textarea" wide
                  placeholder={item ? `Contoh: ${item.example}` : undefined}
                  hint={["DOMISILI", "BELUM_MENIKAH"].includes(code) ? "Untuk catatan petugas, tidak dicetak di surat." : undefined} register={register} errors={errors} />
              </div>
            </fieldset>
          </div>
          <div ref={step === "documents" ? stepHeading : undefined} hidden={step !== "documents"}>
            <DocumentUpload files={files} errors={documentErrors} busy={processing || isSubmitting} onBusy={setProcessing} onChange={changeDocument} onError={(kind, message) => setDocumentErrors((previous) => ({ ...previous, [kind]: message }))} />
          </div>
          {step === "review" && review && <div ref={stepHeading}><section aria-labelledby="review-heading">
            <h2 id="review-heading" tabIndex={-1}>Periksa ringkasan pengajuan</h2>
            <p className="form-help">Pastikan semua isian benar sebelum mengirim.</p>
            <dl className="application-summary">
              <div><dt>Jenis surat</dt><dd>{item?.title}</dd></div>
              {Object.entries(labels).map(([name, label]) => {
                const value = review[name as keyof SubmissionValues];
                return value ? <div key={name}><dt>{label}</dt><dd>{typeof value === "boolean" ? "Ya" : value}</dd></div> : null;
              })}
            </dl>
            <h3>Dokumen terlampir</h3>
            <ul className="my-4 list-disc pl-6">{attachmentKinds.map((kind) => <li key={kind}>{attachmentKindLabels[kind]} — {files[kind]?.type === "application/pdf" ? "Scan PDF terpilih" : "Scan JPG terpilih"}</li>)}</ul>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-secondary" type="button" disabled={isSubmitting || !!acceptedId} onClick={() => { setStep("data"); setError(""); }}>Ubah isian</button>
              <button className="btn btn-secondary" type="button" disabled={isSubmitting || !!acceptedId} onClick={() => { setStep("documents"); setError(""); }}>Ubah dokumen</button>
            </div>
          </section></div>}
          <div className="form-footer">
            {step === "documents" && <button className="btn btn-secondary" type="button" disabled={processing || isSubmitting} onClick={() => { setStep("data"); setError(""); }}>Kembali ke formulir</button>}
            {step === "review" && <>
              <p>Pastikan data yang Anda isikan sudah benar. Simpan nomor permohonan setelah pengajuan berhasil.</p>
              <p>Dengan mengirim, Anda menyetujui pengolahan data sesuai{" "}<Link className="inline-flex min-h-12 items-center underline!" href="/kebijakan-privasi/">Kebijakan Privasi</Link>.</p>
            </>}
            {acceptedId && <Link className="btn btn-secondary" href={`/pelayanan/status/?id=${encodeURIComponent(acceptedId)}`}>Cek Status Surat</Link>}
            {isSubmitting && step === "review" && <div role="status" className="form-help">
              <p>{isDemo ? "Simulasi unggah" : "Mengunggah dokumen"}{progress === null ? "…" : progress < 100 ? `: ${progress}%` : ": 100%. Menunggu konfirmasi penerimaan…"}</p>
              <progress className="w-full" aria-label={isDemo ? "Progres simulasi unggah" : "Progres unggah dokumen"} max={100} value={progress ?? undefined} />
              <p>Jangan tutup halaman sampai nomor pengajuan diterima.</p>
            </div>}
            <button className="btn application-submit" type="submit" disabled={!hydrated || isSubmitting || processing || !!acceptedId}>
              {isSubmitting || !hydrated ? <LoaderCircle className="spin" size={22} aria-hidden="true" /> : <Send size={22} aria-hidden="true" />}{" "}
              {!hydrated ? "Memuat formulir…" : isSubmitting ? "Mengirim…" : step === "data" ? "Lanjut: Unggah dokumen" : step === "documents" ? "Periksa ringkasan" : isDemo ? "Kirim simulasi" : "Kirim permohonan"}
            </button>
          </div>
        </form>
        {error && <HubungiPetugas requestId={acceptedId || undefined} />}
      </div>
      <aside className="form-aside">
        <h3>Alur pengajuan</h3>
        <ol><li>Lengkapi formulir, unggah Scan KTP, Scan Kartu Keluarga, dan Scan Surat Pengantar RT/RW, lalu periksa ringkasan.</li><li>Simpan nomor pengajuan dan kode akses rahasia.</li><li>Pantau proses verifikasi petugas dan persetujuan Kepala Desa.</li><li>Unduh surat melalui Cek Status Surat.</li></ol>
        <p>Setelah Kepala Desa menyetujui, surat ber-QR langsung bisa diunduh dan dicetak sendiri. Surat berlaku 7 hari sejak dirilis.</p>
      </aside>
    </div>
  );
}
