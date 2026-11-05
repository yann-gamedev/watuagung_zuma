import { z } from "zod";
import { apiBase, isDemo } from "@/services/pelayanan";
import { businessCategories, businessHamlets, type BusinessCategory, type PublicBusiness } from "@/types/business";

// Pola sama dengan services/posts.ts. Tanpa API (demo) daftar kosong: UMKM tidak pernah dikarang.
const mediaUrl = z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)).nullable();
export const publicBusinessSchema = z.object({
  slug: z.string().min(1), name: z.string().min(1), category: z.enum(businessCategories), category_label: z.string().min(1),
  description: z.string(), hamlet: z.enum(businessHamlets).nullable(), photo_url: mediaUrl,
  published_at: z.string().datetime({ offset: true }),
  // Hanya ada bila pemilik mengizinkan; server tidak mengirim key ini tanpa izin.
  owner_name: z.string().nullable().optional(), whatsapp: z.string().regex(/^62[0-9]{8,13}$/).nullable().optional(),
}).strict();
const pageSchema = z.object({
  data: z.array(publicBusinessSchema), current_page: z.number().int().positive(),
  last_page: z.number().int().positive(), total: z.number().int().nonnegative(),
}).passthrough();
export type BusinessPage = { data: PublicBusiness[]; current_page: number; last_page: number; total: number };
export const emptyBusinessPage: BusinessPage = { data: [], current_page: 1, last_page: 1, total: 0 };

/** Sama dengan App\Domain\BusinessCategory::label(). */
export const businessCategoryLabels: Record<BusinessCategory, string> = {
  makanan_minuman: "Makanan & Minuman", kerajinan: "Kerajinan", pertanian_peternakan: "Pertanian & Peternakan",
  jasa: "Jasa", perdagangan: "Perdagangan", lainnya: "Lainnya",
};

export const businessHref =(slug: string) => `/umkm/lihat/?slug=${encodeURIComponent(slug)}`;
/** Tautan wa.me hanya untuk nomor 62… yang dikirim server (berarti pemilik mengizinkan). */
export function whatsappHref(business: Pick<PublicBusiness, "whatsapp" | "name">) {
  if (!business.whatsapp || !/^62[0-9]{8,13}$/.test(business.whatsapp)) return null;
  return `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Halo, saya melihat ${business.name} di website Desa Watuagung.`)}`;
}

async function request<T>(path: string, schema: z.ZodType<T>, allowMissing = false): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiBase}${path}`, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error("UMKM belum dapat dimuat");
    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Waktu tunggu habis. Coba lagi.");
    throw error;
  } finally { clearTimeout(timeout); }
}

/** `latest` = terbit terbaru (beranda); bawaan urut nama. */
export async function listBusinesses(page = 1, category?: BusinessCategory, sort: "name" | "latest" = "name"): Promise<BusinessPage> {
  z.number().int().positive().parse(page);
  if (category !== undefined) z.enum(businessCategories).parse(category);
  if (isDemo || !apiBase) return { ...emptyBusinessPage, current_page: page };
  const search = new URLSearchParams({ page: String(page) });
  if (category) search.set("category", category);
  if (sort === "latest") search.set("sort", "latest");
  const result = (await request(`/businesses?${search}`, pageSchema))!;
  return { data: result.data as PublicBusiness[], current_page: result.current_page, last_page: result.last_page, total: result.total };
}

export async function getBusiness(slug: string): Promise<PublicBusiness | null> {
  if (!slug.trim() || isDemo || !apiBase) return null;
  return (await request(`/businesses/${encodeURIComponent(slug)}`, publicBusinessSchema, true)) as PublicBusiness | null;
}
