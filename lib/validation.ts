import { z } from "zod";
import { agamaOptions, dusunOptions, kewarganegaraanOptions, offeredServiceCodes, pendidikanOptions, statusPerkawinanOptions } from "@/types/pelayanan";

export function todayInJakarta(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function text(label: string, max = 200) {
  return z.string({ required_error: `${label} wajib diisi.`, invalid_type_error: `${label} harus berupa teks.` })
    .trim().superRefine((value, context) => {
      const length = [...value].length;
      const message = !value ? `${label} wajib diisi.` : length < 2 ? `${label} minimal 2 karakter.` : length > max ? `${label} maksimal ${max} karakter.` : null;
      if (message) context.addIssue({ code: "custom", message });
    });
}

function choice<const T extends readonly [string, ...string[]]>(options: T, label: string) {
  return z.enum(options, { errorMap: (_issue, context) => ({ message: context.data === undefined || context.data === "" ? `${label} wajib diisi.` : `${label} tidak valid. Pilih salah satu pilihan yang tersedia.` }) });
}

function digits(label: string, pattern: RegExp, message: string) {
  return z.string({ required_error: `${label} wajib diisi.`, invalid_type_error: `${label} harus berupa teks.` }).trim()
    .refine((value) => !!value, `${label} wajib diisi.`)
    .refine((value) => !value || pattern.test(value), message);
}

function dateField(label: string) {
  return z.string({ required_error: `${label} wajib diisi.`, invalid_type_error: `${label} harus berupa teks.` }).trim()
    .refine((value) => !!value, `${label} wajib diisi.`)
    .refine((value) => !value || validDate(value), `${label} harus berupa tanggal yang valid.`);
}

const specificLabels = {
  nama_usaha: "Nama usaha", jenis_usaha: "Jenis usaha", alamat_usaha: "Alamat usaha",
  barang_hilang: "Barang atau dokumen yang hilang", acara: "Acara", tempat_acara: "Tempat acara",
  tanggal_mulai: "Tanggal mulai", tanggal_selesai: "Tanggal selesai", jenis_hiburan: "Jenis hiburan", isi_keterangan: "Isi keterangan",
} as const;
const optionalText = (label: string) => z.string({ invalid_type_error: `${label} harus berupa teks.` }).trim().optional();

export const submissionSchema = z.object({
  jenis_surat: z.enum(offeredServiceCodes, { errorMap: (_issue, context) => ({ message: context.data === undefined || context.data === "" ? "Jenis surat wajib diisi." : "Jenis surat ini tidak dapat diajukan secara online." }) }),
  nama: text("Nama"),
  nik: digits("NIK", /^[0-9]{16}$/, "NIK harus 16 digit angka."),
  no_kk: digits("Nomor KK", /^[0-9]{16}$/, "Nomor KK harus 16 digit angka."),
  tempat_lahir: text("Tempat lahir"),
  tanggal_lahir: dateField("Tanggal lahir"),
  jenis_kelamin: choice(["Laki-laki", "Perempuan"], "Jenis kelamin"),
  dusun: choice(dusunOptions, "Dusun"),
  alamat: text("Alamat"),
  rt: digits("RT", /^[0-9]{1,3}$/, "RT berisi 1–3 digit angka."),
  rw: digits("RW", /^[0-9]{1,3}$/, "RW berisi 1–3 digit angka."),
  telepon: digits("Nomor telepon", /^(?:\+62|0)[0-9]{8,13}$/, "Nomor telepon diawali 0 atau +62, 9–14 digit."),
  // Bawaan WNI ditangani form/API; optional tetap tanpa preprocess agar tipe RHF sama.
  kewarganegaraan: choice(kewarganegaraanOptions, "Kewarganegaraan").optional(),
  agama: choice(agamaOptions, "Agama").optional(),
  status_perkawinan: choice(statusPerkawinanOptions, "Status perkawinan").optional(),
  pendidikan: choice(pendidikanOptions, "Pendidikan").optional(),
  pekerjaan: optionalText("Pekerjaan"),
  keperluan: text("Keperluan"),
  nama_usaha: optionalText(specificLabels.nama_usaha),
  jenis_usaha: optionalText(specificLabels.jenis_usaha),
  alamat_usaha: optionalText(specificLabels.alamat_usaha),
  barang_hilang: optionalText(specificLabels.barang_hilang),
  acara: optionalText(specificLabels.acara),
  tempat_acara: optionalText(specificLabels.tempat_acara),
  tanggal_mulai: optionalText(specificLabels.tanggal_mulai),
  tanggal_selesai: optionalText(specificLabels.tanggal_selesai),
  jenis_hiburan: optionalText(specificLabels.jenis_hiburan),
  isi_keterangan: optionalText(specificLabels.isi_keterangan),
}).superRefine((values, context) => {
  const issue = (field: keyof typeof values, message: string) => context.addIssue({ code: "custom", path: [field], message });
  const today = todayInJakarta();
  if (validDate(values.tanggal_lahir)) {
    if (values.tanggal_lahir < "1900-01-01") issue("tanggal_lahir", "Tanggal lahir paling awal 1 Januari 1900.");
    if (values.tanggal_lahir > today) issue("tanggal_lahir", "Tanggal lahir tidak boleh melewati hari ini.");
  }
  if (values.jenis_surat !== "KERAMAIAN") {
    for (const [field, label] of [["agama", "Agama"], ["status_perkawinan", "Status perkawinan"], ["pendidikan", "Pendidikan"]] as const) {
      if (!values[field]) issue(field, `${label} wajib diisi.`);
    }
  }
  if (values.pekerjaan || values.jenis_surat !== "KERAMAIAN") {
    const result = text("Pekerjaan", 60).safeParse(values.pekerjaan);
    if (!result.success) for (const error of result.error.issues) issue("pekerjaan", error.message);
  }
  const own = values.jenis_surat === "KERAMAIAN" ? ["acara", "tempat_acara", "tanggal_mulai", "tanggal_selesai", "jenis_hiburan"] :
    values.jenis_surat === "KEHILANGAN" ? ["barang_hilang"] : values.jenis_surat === "UMUM" ? ["isi_keterangan"] : [];
  for (const field of Object.keys(specificLabels) as (keyof typeof specificLabels)[]) {
    const label = specificLabels[field];
    if (!own.includes(field)) {
      if (values[field]) issue(field, `${label} tidak dipakai untuk jenis surat ini.`);
      continue;
    }
    const schema = field === "tanggal_mulai" || field === "tanggal_selesai" ? dateField(label) : text(label, field === "isi_keterangan" ? 500 : field === "barang_hilang" ? 200 : 120);
    const result = schema.safeParse(values[field]);
    if (!result.success) for (const error of result.error.issues) issue(field, error.message);
  }
  if (values.jenis_surat === "KERAMAIAN") {
    const start = values.tanggal_mulai;
    const end = values.tanggal_selesai;
    if (start && validDate(start) && start < today) issue("tanggal_mulai", "Tanggal mulai tidak boleh sebelum hari ini.");
    if (start && end && validDate(start) && validDate(end)) {
      if (end < start) issue("tanggal_selesai", "Tanggal selesai tidak boleh sebelum tanggal mulai.");
      if ((Date.parse(end) - Date.parse(start)) / 86400000 >= 7) issue("tanggal_selesai", "Izin keramaian paling lama 7 hari.");
    }
  }
});
export type SubmissionValues = z.infer<typeof submissionSchema>;
