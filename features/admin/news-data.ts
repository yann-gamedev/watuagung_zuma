import { z } from "zod";
import { postCategories } from "@/types/posts";

export const categoryLabels = {
  kegiatan_desa: "Kegiatan desa", pemerintahan: "Pemerintahan", pembangunan: "Pembangunan",
  pemberdayaan: "Pemberdayaan", layanan_publik: "Layanan publik", ekonomi_lokal: "Ekonomi lokal", pengumuman: "Pengumuman",
} as const;
const mediaUrl = z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)).nullable();
export const postSchema = z.object({
  id: z.number().int().positive(), slug: z.string(), title: z.string(), category: z.enum(postCategories),
  category_label: z.string(), summary: z.string(), status: z.enum(["draft", "published"]),
  published_at: z.string().datetime({ offset: true }).nullable(), updated_at: z.string().datetime({ offset: true }), cover_url: mediaUrl,
});
export const postDetailSchema = postSchema.extend({ body: z.string(), created_at: z.string().datetime({ offset: true }) });
export const postsPageSchema = z.object({
  data: z.array(postSchema), current_page: z.number().int().positive(), last_page: z.number().int().positive(), total: z.number().int().nonnegative(),
});
export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(160, "Judul maksimal 160 karakter."),
  category: z.enum(postCategories),
  summary: z.string().trim().min(1, "Ringkasan wajib diisi.").max(300, "Ringkasan maksimal 300 karakter."),
  body: z.string().trim().min(1, "Isi wajib diisi.").max(20000, "Isi maksimal 20.000 karakter."),
  status: z.enum(["draft", "published"]),
});
export function postDate(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "Belum terbit";
}
export function parsePost(value: unknown) {
  const parsed = postDetailSchema.safeParse(value);
  if (!parsed.success) throw new Error("Format berita tidak sesuai. Muat ulang atau hubungi pengelola.");
  return parsed.data;
}
