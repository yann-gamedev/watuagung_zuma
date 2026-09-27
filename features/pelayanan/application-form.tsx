"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Send, LoaderCircle } from "lucide-react";
import { FormField } from "@/components/form-field";
import { submissionSchema, type SubmissionValues } from "@/lib/validation";
import { pelayananService, isDemo } from "@/services/pelayanan";
import type { ServiceCode } from "@/types/pelayanan";
export function ApplicationForm({ code }: { code: ServiceCode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { jenis_surat: code },
  });
  const field = (
    name: keyof SubmissionValues,
    label: string,
    type = "text",
    wide = false,
  ) => (
    <FormField
      key={name}
      name={name}
      label={label}
      type={type}
      wide={wide}
      register={register}
      errors={errors}
    />
  );
  async function submit(values: SubmissionValues) {
    setError("");
    try {
      const result = await pelayananService.submit(values);
      if (result.lookup_secret) {
        sessionStorage.setItem(`watuagung-receipt-${result.request_id}`, result.lookup_secret);
      }
      router.push(
        "/pelayanan/sukses/?id=" + encodeURIComponent(result.request_id),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Pengajuan gagal. Silakan coba lagi.",
      );
    }
  }
  return (
    <div className="form-layout">
      <div>
        <div className="notice">
          {isDemo
            ? "Mode simulasi. Gunakan data fiktif. Data identitas tidak disimpan atau dikirim ke pemerintah desa."
            : "Periksa data sebelum mengirim. Permohonan akan diteruskan ke layanan administrasi desa."}
        </div>
        <form
          className="form-card"
          onSubmit={handleSubmit(submit)}
          noValidate
          aria-busy={isSubmitting}
        >
          <h2>Formulir permohonan</h2>
          <p className="mt-2 text-sm">Semua kolom bertanda * wajib diisi.</p>
          <fieldset disabled={isSubmitting}>
            <legend>01 · Identitas pemohon</legend>
            <div className="fields">
              {field("nama", "Nama lengkap", "text", true)}
              {field("nik", "NIK")}
              {field("no_kk", "Nomor KK")}
              {field("tempat_lahir", "Tempat lahir")}
              {field("tanggal_lahir", "Tanggal lahir", "date")}
              <FormField
                name="jenis_kelamin"
                label="Jenis kelamin"
                register={register}
                errors={errors}
                options={["Laki-laki", "Perempuan"]}
              />
              {field("telepon", "Nomor telepon", "tel")}
              {field("alamat", "Alamat lengkap", "textarea", true)}
              {field("rt", "RT")}
              {field("rw", "RW")}
            </div>
          </fieldset>
          {code === "SKU" && (
            <fieldset disabled={isSubmitting}>
              <legend>02 · Informasi usaha</legend>
              <div className="fields">
                {field("nama_usaha", "Nama usaha")}
                {field("jenis_usaha", "Jenis usaha")}
                {field("alamat_usaha", "Alamat usaha", "textarea", true)}
              </div>
            </fieldset>
          )}
          <fieldset disabled={isSubmitting}>
            <legend>{code === "SKU" ? "03" : "02"} · Keperluan surat</legend>
            <div className="fields">
              {field("keperluan", "Keperluan surat", "textarea", true)}
            </div>
          </fieldset>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="form-footer">
            <p>
              Pastikan data yang Anda isikan sudah benar. Simpan nomor
              permohonan setelah pengajuan berhasil.
            </p>
            <button className="btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Send size={17} />
              )}{" "}
              {isSubmitting
                ? "Mengirim…"
                : isDemo
                  ? "Kirim simulasi"
                  : "Kirim permohonan"}
            </button>
          </div>
        </form>
      </div>
      <aside className="form-aside">
        <h3>Alur pengajuan</h3>
        <ol>
          <li>Lengkapi formulir.</li>
          <li>Simpan nomor pengajuan.</li>
          <li>Pantau proses verifikasi.</li>
          <li>Tunggu persetujuan perangkat desa.</li>
        </ol>
        <p>
          Persyaratan dan estimasi proses pada prototipe merupakan contoh.
          Dokumen pendukung diverifikasi petugas pada tahap berikutnya.
        </p>
      </aside>
    </div>
  );
}
