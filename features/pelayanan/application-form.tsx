"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, LoaderCircle, CircleAlert } from "lucide-react";
import { FormField } from "@/components/form-field";
import { submissionSchema, type SubmissionValues } from "@/lib/validation";
import { pelayananService, isDemo } from "@/services/pelayanan";
export function ApplicationForm({ code }: { code: SubmissionValues["jenis_surat"] }) {
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
    <div className="form-layout application-form">
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
          <p className="mt-2 form-help">Semua kolom bertanda * wajib diisi.</p>
          <fieldset disabled={isSubmitting}>
            <legend>Data diri</legend>
            <div className="fields">
              <FormField name="nik" label="NIK" wide register={register} errors={errors} hint="Masukkan 16 digit NIK." />
              {field("nama", "Nama lengkap", "text", true)}
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
          {code === "SKU" && (
            <fieldset disabled={isSubmitting}>
              <legend>Informasi usaha</legend>
              <div className="fields">
                {field("nama_usaha", "Nama usaha")}
                {field("jenis_usaha", "Jenis usaha")}
                {field("alamat_usaha", "Alamat usaha", "textarea", true)}
              </div>
            </fieldset>
          )}
          <fieldset disabled={isSubmitting}>
            <legend>Keperluan</legend>
            <div className="fields">
              {field("keperluan", "Keperluan surat", "textarea", true)}
            </div>
          </fieldset>
          {error && (
            <div className="error-box" role="alert">
              <CircleAlert size={22} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <div className="form-footer">
            <p>
              Pastikan data yang Anda isikan sudah benar. Simpan nomor
              permohonan setelah pengajuan berhasil.
            </p>
            <p>
              Dengan mengirim, Anda menyetujui pengolahan data sesuai{" "}
              <Link className="inline-flex min-h-12 items-center underline!" href="/kebijakan-privasi/">
                Kebijakan Privasi
              </Link>.
            </p>
            <button className="btn application-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="spin" size={22} aria-hidden="true" />
              ) : (
                <Send size={22} aria-hidden="true" />
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
          <li>Tunggu persetujuan Kepala Desa.</li>
        </ol>
        <p>
          Persyaratan dan estimasi proses pada prototipe merupakan contoh.
          Dokumen pendukung diverifikasi petugas pada tahap berikutnya.
        </p>
      </aside>
    </div>
  );
}
