"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, LoaderCircle, CircleAlert } from "lucide-react";
import { FormField } from "@/components/form-field";
import { services } from "@/lib/data";
import { submissionSchema, type SubmissionValues } from "@/lib/validation";
import { agamaOptions, dusunOptions, kewarganegaraanOptions, pendidikanOptions, statusPerkawinanOptions } from "@/types/pelayanan";
import { pelayananService, isDemo } from "@/services/pelayanan";

const labels: Partial<Record<keyof SubmissionValues, string>> = {
  nama: "Nama lengkap", nik: "NIK", no_kk: "Nomor KK", tempat_lahir: "Tempat lahir", tanggal_lahir: "Tanggal lahir",
  jenis_kelamin: "Jenis kelamin", telepon: "Nomor telepon", dusun: "Dusun", agama: "Agama", kewarganegaraan: "Kewarganegaraan",
  status_perkawinan: "Status perkawinan", pendidikan: "Pendidikan", pekerjaan: "Pekerjaan", alamat: "Alamat lengkap", rt: "RT", rw: "RW",
  keperluan: "Keperluan surat", barang_hilang: "Barang atau dokumen yang hilang", acara: "Acara", tempat_acara: "Tempat acara",
  tanggal_mulai: "Tanggal mulai", tanggal_selesai: "Tanggal selesai", jenis_hiburan: "Jenis hiburan", isi_keterangan: "Isi keterangan",
};
const sensitiveHint = "Dicetak di surat sesuai format desa. Disimpan terenkripsi.";
const jobs = ["Pelajar/Mahasiswa", "Karyawan Swasta", "Petani/Pekebun", "Wiraswasta", "Mengurus Rumah Tangga", "Belum/Tidak Bekerja"];

export function ApplicationForm({ code }: { code: SubmissionValues["jenis_surat"] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [acceptedId, setAcceptedId] = useState("");
  const [review, setReview] = useState<SubmissionValues | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const { register, handleSubmit, setFocus, formState: { errors, isSubmitting } } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { jenis_surat: code, kewarganegaraan: "WNI" },
    mode: "onBlur",
  });
  useEffect(() => { if (review) reviewHeading.current?.focus(); }, [review]);
  const field = (name: keyof SubmissionValues, label: string, type = "text", wide = false) => (
    <FormField key={name} name={name} label={label} type={type} wide={wide} register={register} errors={errors} />
  );
  const select = (name: keyof SubmissionValues, options: readonly string[], hint?: string) => (
    <FormField name={name} label={labels[name]!} options={options} hint={hint} register={register} errors={errors} />
  );
  async function submit(values: SubmissionValues) {
    if (acceptedId) return;
    setError("");
    if (!review) { setReview(values); return; }
    try {
      const result = await pelayananService.submit(values);
      setAcceptedId(result.request_id);
      // Nomor/jenis saja; identitas formulir tidak disimpan di browser.
      try {
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
      setError(e instanceof Error ? e.message : "Pengajuan gagal. Silakan coba lagi.");
    }
  }
  const item = services.find((service) => service.code === code);
  return (
    <div className="form-layout application-form">
      <div>
        <div className="notice">{isDemo
          ? "Mode simulasi. Gunakan data fiktif. Data identitas tidak disimpan atau dikirim ke pemerintah desa."
          : "Periksa data sebelum mengirim. Permohonan akan diteruskan ke layanan administrasi desa."}</div>
        <form className="form-card" method="post" onSubmit={handleSubmit(submit, (invalid) => {
          setReview(null);
          const first = Object.keys(invalid)[0] as keyof SubmissionValues | undefined;
          if (first) setTimeout(() => setFocus(first), 0);
        })} noValidate aria-busy={isSubmitting}>
          <div hidden={!!review}>
            <h2>Formulir permohonan</h2>
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
                {field("telepon", "Nomor telepon", "tel")}
              </div>
            </fieldset>
            <fieldset disabled={isSubmitting}>
              <legend>Data diri tambahan</legend>
              <div className="fields">
                {select("dusun", dusunOptions)}
                {select("kewarganegaraan", kewarganegaraanOptions)}
                {code !== "KERAMAIAN" && <>
                  {select("agama", agamaOptions, sensitiveHint)}
                  {select("status_perkawinan", statusPerkawinanOptions, sensitiveHint)}
                  {select("pendidikan", pendidikanOptions)}
                  <FormField name="pekerjaan" label="Pekerjaan" register={register} errors={errors} suggestions={jobs} hint="Pilih saran atau tulis pekerjaan Anda, maksimal 60 karakter." />
                </>}
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
              <legend>{code === "KERAMAIAN" ? "Rencana acara" : "Keperluan"}</legend>
              <div className="fields">
                {code === "KERAMAIAN" && <>
                  {field("acara", "Acara")}
                  {field("tempat_acara", "Tempat acara")}
                  {field("tanggal_mulai", "Tanggal mulai", "date")}
                  {field("tanggal_selesai", "Tanggal selesai", "date")}
                  <p className="form-help wide">Tanggal mulai paling awal hari ini. Izin keramaian paling lama 7 hari, termasuk tanggal mulai dan selesai.</p>
                  {field("jenis_hiburan", "Jenis hiburan", "text", true)}
                </>}
                {code === "KEHILANGAN" && <FormField name="barang_hilang" label="Barang atau dokumen yang hilang" type="textarea" wide placeholder="Contoh: KTP" register={register} errors={errors} />}
                {code === "UMUM" && <FormField name="isi_keterangan" label="Isi keterangan" type="textarea" wide placeholder="Contoh: Bekerja di Surabaya" hint="Petugas dapat menyesuaikan kalimat sebelum surat dibuat." register={register} errors={errors} />}
                <FormField name="keperluan" label={code === "UMUM" ? "Tujuan penggunaan surat" : code === "KERAMAIAN" ? "Maksud permohonan" : "Keperluan surat"} type="textarea" wide
                  placeholder={item ? `Contoh: ${item.example}` : undefined}
                  hint={["DOMISILI", "BELUM_MENIKAH"].includes(code) ? "Untuk catatan petugas, tidak dicetak di surat." : undefined} register={register} errors={errors} />
              </div>
            </fieldset>
          </div>
          {review && <section aria-labelledby="review-heading">
            <h2 id="review-heading" tabIndex={-1} ref={reviewHeading}>Periksa ringkasan pengajuan</h2>
            <p className="form-help">Pastikan semua isian benar sebelum mengirim.</p>
            <dl className="application-summary">
              <div><dt>Jenis surat</dt><dd>{item?.title}</dd></div>
              {Object.entries(labels).map(([name, label]) => {
                const value = review[name as keyof SubmissionValues];
                return value ? <div key={name}><dt>{label}</dt><dd>{value}</dd></div> : null;
              })}
            </dl>
            <button className="btn btn-secondary" type="button" disabled={isSubmitting || !!acceptedId} onClick={() => { setReview(null); setError(""); setTimeout(() => setFocus("nik"), 0); }}>Ubah isian</button>
          </section>}
          {error && <div className="error-box" role="alert"><CircleAlert size={22} aria-hidden="true" /><span>{error}</span></div>}
          <div className="form-footer">
            {review && <>
              <p>Pastikan data yang Anda isikan sudah benar. Simpan nomor permohonan setelah pengajuan berhasil.</p>
              <p>Dengan mengirim, Anda menyetujui pengolahan data sesuai{" "}<Link className="inline-flex min-h-12 items-center underline!" href="/kebijakan-privasi/">Kebijakan Privasi</Link>.</p>
            </>}
            {acceptedId && <Link className="btn btn-secondary" href={`/pelayanan/status/?id=${encodeURIComponent(acceptedId)}`}>Cek Status Surat</Link>}
            <button className="btn application-submit" type="submit" disabled={isSubmitting || !!acceptedId}>
              {isSubmitting ? <LoaderCircle className="spin" size={22} aria-hidden="true" /> : <Send size={22} aria-hidden="true" />}{" "}
              {isSubmitting ? "Mengirim…" : !review ? "Periksa ringkasan" : isDemo ? "Kirim simulasi" : "Kirim permohonan"}
            </button>
          </div>
        </form>
      </div>
      <aside className="form-aside">
        <h3>Alur pengajuan</h3>
        <ol><li>Lengkapi formulir dan periksa ringkasan.</li><li>Simpan nomor pengajuan.</li><li>Pantau proses verifikasi.</li><li>Tunggu persetujuan Kepala Desa.</li></ol>
        <p>Bawa KTP dan KK asli saat mengambil surat. Persyaratan sementara: menunggu konfirmasi desa.</p>
      </aside>
    </div>
  );
}
