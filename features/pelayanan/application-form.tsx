"use client";
import { useRef, useState } from "react";
import { dummyResidents, findDummyResident } from "@/lib/dummy-residents";
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
  const [autofillMessage, setAutofillMessage] = useState("");
  const [dummyPreview, setDummyPreview] = useState(isDemo);
  const filledNik = useRef("");
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubmissionValues>({
    resolver: zodResolver(submissionSchema),
    defaultValues: { jenis_surat: code },
  });
  function autofill(nik: string) {
    if (!dummyPreview) return;
    const identityFields = ["nama", "tempat_lahir", "tanggal_lahir"] as const;
    if (filledNik.current && filledNik.current !== nik) {
      for (const name of identityFields) setValue(name, "", { shouldDirty: true });
      filledNik.current = "";
    }
    if (!/^\d{16}$/.test(nik)) {
      setAutofillMessage("Lengkapi 16 digit NIK dummy untuk mengisi identitas otomatis.");
      return;
    }
    const resident = findDummyResident(nik);
    if (!resident) {
      setAutofillMessage("NIK tidak ditemukan dalam data dummy. Isi identitas secara manual atau gunakan contoh di bawah.");
      return;
    }
    if (filledNik.current !== nik) {
      for (const name of identityFields) setValue(name, resident[name], { shouldDirty: true, shouldValidate: true });
      filledNik.current = nik;
    }
    setAutofillMessage("Data dummy terisi: nama, tempat lahir, dan tanggal lahir. Periksa kembali; semua kolom tetap dapat diedit.");
  }
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
    if (dummyPreview && !isDemo) {
      setError("Mode coba dummy aktif. Pengiriman ke server dinonaktifkan. Matikan mode coba untuk mengisi pengajuan baru.");
      return;
    }
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
          {!isDemo && <div className="notice mt-4">
            <label htmlFor="dummy-preview" className="flex items-center gap-3" style={{ minHeight: 44 }}>
              <input id="dummy-preview" type="checkbox" checked={dummyPreview} disabled={isSubmitting}
                onChange={(event) => {
                  setDummyPreview(event.target.checked);
                  for (const name of ["nik", "nama", "tempat_lahir", "tanggal_lahir"] as const) setValue(name, "", { shouldDirty: true });
                  filledNik.current = "";
                  setAutofillMessage("");
                  setError("");
                }} />
              Coba autofill dummy (tanpa mengirim ke server)
            </label>
            <p className="text-sm mt-2">Mengubah pilihan ini mengosongkan NIK, nama, tempat lahir, dan tanggal lahir. Saat aktif, pengiriman permohonan dinonaktifkan.</p>
          </div>}
          <fieldset disabled={isSubmitting}>
            <legend>01 · Identitas pemohon</legend>
            <div className="fields">
              <FormField name="nik" label="NIK" wide register={register} errors={errors}
                onValueChange={dummyPreview ? autofill : undefined}
                hint={dummyPreview ? "Gunakan NIK dummy di bawah. Mengganti NIK akan menghapus identitas hasil autofill sebelumnya, termasuk perubahan Anda pada ketiga kolom tersebut." : "Masukkan 16 digit NIK. Untuk mencoba pengisian otomatis, aktifkan pilihan Coba autofill dummy di atas."} />
              {dummyPreview && <div className="field wide">
                <details>
                  <summary className="text-link" style={{ minHeight: 44, cursor: "pointer" }}>Lihat 3 contoh NIK dummy</summary>
                  <ul className="mt-2 space-y-2">
                    {dummyResidents.map((resident) => <li key={resident.nik}>
                      <code>{resident.nik}</code> — {resident.nama}, {resident.tempat_lahir}, {resident.tanggal_lahir}
                    </li>)}
                  </ul>
                  <p className="text-sm mt-2">Seluruh identitas ini fiktif, bukan data Dukcapil. Kolom lainnya tetap diisi manual.</p>
                </details>
                <p id="nik-autofill-status" role="status" aria-live="polite" className="text-sm mt-2">{autofillMessage}</p>
              </div>}
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
            <button className="btn" type="submit" disabled={isSubmitting || (dummyPreview && !isDemo)}>
              {isSubmitting ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Send size={17} />
              )}{" "}
              {isSubmitting
                ? "Mengirim…"
                : isDemo
                  ? "Kirim simulasi"
                  : dummyPreview
                    ? "Pengiriman nonaktif (coba dummy)"
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
