import { z } from "zod";
import { businessCategories, businessHamlets } from "@/types/business";

// Pola sama dengan news-data.ts; batas sama dengan BusinessController::rules().
const mediaUrl = z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)).nullable();
export const staffBusinessSchema = z.object({
  id: z.number().int().positive(), status: z.enum(["draft", "published"]), slug: z.string(), name: z.string(),
  category: z.enum(businessCategories), category_label: z.string(), hamlet: z.enum(businessHamlets).nullable(), photo_url: mediaUrl,
  published_at: z.string().datetime({ offset: true }).nullable(), consent_public_contact: z.boolean(), updated_at: z.string().datetime({ offset: true }),
});
export const staffBusinessDetailSchema = staffBusinessSchema.extend({
  description: z.string(), owner_name: z.string().nullable(), whatsapp: z.string().nullable(), created_at: z.string().datetime({ offset: true }),
});
export const staffBusinessesPageSchema = z.object({
  data: z.array(staffBusinessSchema), current_page: z.number().int().positive(), last_page: z.number().int().positive(), total: z.number().int().nonnegative(),
});
const noControls = (value: string) => !/\p{Cc}/u.test(value);
const optionalText = (max: number, label: string) => z.string().trim().max(max, `${label} maksimal ${max} karakter.`)
  .refine(noControls, `${label} tidak boleh berisi tab atau baris baru.`).transform((value) => value || null);
export const businessInputSchema = z.object({
  name: z.string().trim().min(1, "Nama usaha wajib diisi.").max(120, "Nama usaha maksimal 120 karakter.").refine(noControls, "Nama usaha tidak boleh berisi tab atau baris baru."),
  category: z.enum(businessCategories),
  hamlet: z.union([z.enum(businessHamlets), z.literal("")]).transform((value) => value || null),
  description: z.string().trim().min(1, "Deskripsi wajib diisi.").max(3000, "Deskripsi maksimal 3.000 karakter.")
    .refine((value) => !/(?![\n\r])\p{Cc}/u.test(value), "Deskripsi tidak boleh berisi tab."),
  owner_name: optionalText(120, "Nama pemilik"),
  whatsapp: z.string().trim().refine((value) => value === "" || /^62[0-9]{8,13}$/.test(value), "Nomor WhatsApp diawali 62 lalu 8–13 angka, tanpa +, spasi, atau tanda hubung. Contoh 6281234567890.")
    .transform((value) => value || null),
  consent_public_contact: z.boolean(),
  status: z.enum(["draft", "published"]),
});
/** Isian formulir: dusun/pemilik/nomor kosong = "". */
export type BusinessForm = z.input<typeof businessInputSchema>;
export function parseBusiness(value: unknown) {
  const parsed = staffBusinessDetailSchema.safeParse(value);
  if (!parsed.success) throw new Error("Format data UMKM tidak sesuai. Muat ulang atau hubungi pengelola.");
  return parsed.data;
}
