import { z } from "zod";
const text = z
  .string()
  .trim()
  .min(2, "Isi minimal 2 karakter.")
  .max(200, "Maksimal 200 karakter.");
export const submissionSchema = z
  .object({
    jenis_surat: z.enum(["SKU", "DOMISILI", "SKTM", "KTP_KK"]),
    nama: text,
    nik: z.string().regex(/^\d{16}$/, "NIK harus terdiri dari 16 angka."),
    no_kk: z
      .string()
      .regex(/^\d{16}$/, "Nomor KK harus terdiri dari 16 angka."),
    tempat_lahir: text,
    tanggal_lahir: z
      .string()
      .min(1, "Pilih tanggal lahir.")
      .refine(
        (v) =>
          /^\d{4}-\d{2}-\d{2}$/.test(v) &&
          !isNaN(Date.parse(v)) &&
          new Date(v).toISOString().slice(0, 10) === v &&
          v <= new Date().toISOString().slice(0, 10) &&
          v >= "1900-01-01",
        "Tanggal lahir tidak valid.",
      ),
    jenis_kelamin: z.enum(["Laki-laki", "Perempuan"], {
      errorMap: () => ({ message: "Pilih jenis kelamin." }),
    }),
    alamat: text,
    rt: z.string().regex(/^\d{1,3}$/, "Isi 1–3 angka."),
    rw: z.string().regex(/^\d{1,3}$/, "Isi 1–3 angka."),
    telepon: z
      .string()
      .regex(/^(?:\+62|0)[0-9]{8,13}$/, "Gunakan nomor telepon yang valid."),
    nama_usaha: z.string().trim().max(200).optional(),
    jenis_usaha: z.string().trim().max(200).optional(),
    alamat_usaha: z.string().trim().max(200).optional(),
    keperluan: text,
  })
  .superRefine((v, c) => {
    if (v.jenis_surat === "SKU")
      for (const k of ["nama_usaha", "jenis_usaha", "alamat_usaha"] as const)
        if (!v[k] || v[k]!.length < 2)
          c.addIssue({
            code: "custom",
            path: [k],
            message: "Lengkapi informasi usaha ini.",
          });
  });
export type SubmissionValues = z.infer<typeof submissionSchema>;
