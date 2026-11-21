import { z } from "zod";
import { postCategories, socialPlatforms, type SocialLinkColumn, type SocialPlatform, type StaffPostInput } from "@/types/posts";
import { isSocialLink, socialPlatformInfo } from "@/lib/social-links";

export const categoryLabels = {
  kegiatan_desa: "Kegiatan desa", pemerintahan: "Pemerintahan", pembangunan: "Pembangunan",
  pemberdayaan: "Pemberdayaan", layanan_publik: "Layanan publik", ekonomi_lokal: "Ekonomi lokal", pengumuman: "Pengumuman",
} as const;
const mediaUrl = z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)).nullable();
const postImageSchema = z.object({
  id: z.number().int().positive(),
  url: z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)),
  caption: z.string().nullable(),
});
export const postSchema = z.object({
  id: z.number().int().positive(), slug: z.string(), title: z.string(), category: z.enum(postCategories),
  category_label: z.string(), summary: z.string(), status: z.enum(["draft", "published"]),
  published_at: z.string().datetime({ offset: true }).nullable(), updated_at: z.string().datetime({ offset: true }), cover_url: mediaUrl,
});
const socialColumns = Object.fromEntries(socialPlatforms.map((platform) => [`${platform}_url`, z.string().nullable().default(null)])) as Record<SocialLinkColumn, z.ZodDefault<z.ZodNullable<z.ZodString>>>;
export const postDetailSchema = postSchema.extend({
  body: z.string(), images: z.array(postImageSchema).default([]), created_at: z.string().datetime({ offset: true }),
  show_copyright: z.boolean().default(false), ...socialColumns,
});
/** Nilai formulir: tautan kosong = "" (dikirim lalu disimpan server sebagai null). */
export type PostFormValue = Required<Pick<StaffPostInput, "title" | "category" | "summary" | "body" | "status" | "show_copyright">> & Record<SocialLinkColumn, string>;
function socialLinkInput(platform: SocialPlatform) {
  const { label, hosts } = socialPlatformInfo[platform];
  return z.string().trim().max(500, `Tautan ${label} maksimal 500 karakter.`)
    .refine((value) => value === "" || isSocialLink(platform, value), `Tautan ${label} harus diawali https:// dan mengarah ke ${hosts[0]}.`);
}
export const postsPageSchema = z.object({
  data: z.array(postSchema), current_page: z.number().int().positive(), last_page: z.number().int().positive(), total: z.number().int().nonnegative(),
});
export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi.").max(160, "Judul maksimal 160 karakter."),
  category: z.enum(postCategories),
  summary: z.string().trim().min(1, "Ringkasan wajib diisi.").max(300, "Ringkasan maksimal 300 karakter."),
  body: z.string().trim().min(1, "Isi wajib diisi.").max(20000, "Isi maksimal 20.000 karakter."),
  status: z.enum(["draft", "published"]),
  show_copyright: z.boolean(),
  instagram_url: socialLinkInput("instagram"),
  tiktok_url: socialLinkInput("tiktok"),
  youtube_url: socialLinkInput("youtube"),
  facebook_url: socialLinkInput("facebook"),
});
export function postDate(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "Belum terbit";
}
export function parsePost(value: unknown) {
  const parsed = postDetailSchema.safeParse(value);
  if (!parsed.success) throw new Error("Format berita tidak sesuai. Muat ulang atau hubungi pengelola.");
  return parsed.data;
}
