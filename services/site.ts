import { z } from "zod";
import { apiBase } from "./pelayanan";
import { SPENDING_FIELDS } from "@/lib/transparency";
import type { EditableSiteSectionKey, SiteSectionData, SiteSectionDocumentResponse } from "@/types/site";

// Pesan Indonesia dipakai panel per field; batas sama dengan SiteSectionRules.
const required = "Wajib diisi.";
const noControls = "Hapus karakter khusus seperti tab atau baris baru.";
const text = (max: number) => z.string().min(1, required).max(max, `Maksimal ${max} karakter.`).regex(/^[^\p{Cc}]*$/u, noControls);
const rows = <T extends z.ZodTypeAny>(item: T, max: number) => z.array(item).max(max, `Maksimal ${max} baris.`);
const block = z.object({
  title: text(160),
  text: z.string().min(1, required).max(10000, "Maksimal 10000 karakter.").regex(/^[^\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]*$/, "Hapus karakter khusus seperti tab."),
}).strict();
const fields = { intro: text(2000), blocks: rows(block, 20).min(1, "Minimal 1 baris.") };
export const profileDetailsSchema = z.object({
  themes: rows(text(160), 6),
  stats: rows(z.object({ value: text(160), label: text(160), detail: text(1000).optional() }).strict(), 6),
  location: text(1000),
  boundaries: z.array(z.object({ direction: z.enum(["Utara", "Timur", "Selatan", "Barat"]), place: text(1000) }).strict()).length(4)
    .refine((items) => items.every((item, i) => item.direction === ["Utara", "Timur", "Selatan", "Barat"][i]), "Urutan batas harus Utara, Timur, Selatan, Barat."),
  institutions: rows(z.object({ name: text(160), description: text(2000) }).strict(), 20),
  source: text(1000),
}).strict();
const optional = (max: number) => z.string().max(max, `Maksimal ${max} karakter.`).regex(/^[^\p{Cc}]*$/u, noControls);
const mapUrl = (prefixes: string[], message: string) => optional(2048)
  .refine((value) => value === "" || value === "[PLACEHOLDER]" || (URL.canParse(value) && prefixes.some((prefix) => value.startsWith(prefix))), message);
export const contactSchema = z.object({
  address: text(1000),
  hours: text(200),
  contactName: text(160),
  phone: optional(15).regex(/^(?:|\[PLACEHOLDER\]|62[0-9]{1,13})$/, "Gunakan format 62 diikuti angka saja, contoh 6281234567890."),
  mapsEmbedUrl: mapUrl(["https://www.google.com/maps/embed?"], "Tempel alamat yang diawali https://www.google.com/maps/embed? (isi src, bukan seluruh kode iframe)."),
  mapsLinkUrl: mapUrl(["https://maps.app.goo.gl/", "https://www.google.com/maps/"], "Tempel link yang diawali https://maps.app.goo.gl/ atau https://www.google.com/maps/."),
}).strict();
// Rupiah bulat; total sengaja tidak ada (budgetTotals di lib/transparency.ts).
const amount = z.number({ invalid_type_error: "Isi dengan angka." }).int("Isi rupiah tanpa desimal.").min(0, "Tidak boleh negatif.").max(100_000_000_000, "Maksimal Rp100.000.000.000.");
const line = z.object({ label: text(160), amount }).strict();
const budgetSchema = z.object({
  year: z.number({ invalid_type_error: "Isi tahun." }).int().min(2000, "Tahun 2000–2099.").max(2099, "Tahun 2000–2099."),
  status: z.enum(["Rancangan", "Ditetapkan", "Perubahan"], { errorMap: () => ({ message: "Pilih status." }) }),
  revenue: rows(line, 20).min(1, "Minimal 1 baris."),
  spending: z.array(line).length(5).refine((items) => items.every((item, i) => item.label === SPENDING_FIELDS[i]), "Bidang belanja harus lima bidang tetap."),
  financing: rows(line, 10).optional(),
  source: text(1000),
  documentPath: z.string().regex(/^site\/documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/, "Unggah ulang dokumen PDF.").optional(),
}).strict();
export const transparencySchema = z.object({
  intro: text(2000),
  programs: rows(block, 20).min(1, "Minimal 1 baris."),
  budgets: z.array(budgetSchema).max(5, "Maksimal 5 tahun.").superRefine((budgets, context) => budgets.forEach((budget, i) => {
    if (budgets.findIndex((other) => other.year === budget.year) !== i) context.addIssue({ code: "custom", path: [i, "year"], message: "Tahun sudah ada." });
  })),
}).strict();
export const siteSchemas = {
  profile: z.object({ ...fields, profileDetails: profileDetailsSchema.optional() }).strict(),
  history: z.object(fields).strict(),
  contact: contactSchema,
  transparency: transparencySchema,
};
export type TextSiteKey = "profile" | "history";
/** documentUrls hanya diisi server untuk transparency: { [documentPath]: URL publik }. */
export type SiteEnvelope<K extends EditableSiteSectionKey> = { data: SiteSectionData[K]; updated_at: string; documentUrls: Record<string, string> };
const httpUrl = z.string().refine((value) => /^https?:\/\//.test(value) && URL.canParse(value));

export function parseSiteEnvelope<K extends EditableSiteSectionKey>(key: K, value: unknown): SiteEnvelope<K> {
  const result = z.object({
    key: z.literal(key), data: siteSchemas[key], updated_at: z.string().datetime({ offset: true }),
    ...(key === "transparency" ? { document_urls: z.record(httpUrl) } : {}),
  }).strict().safeParse(value);
  if (!result.success) throw new Error("Format bagian situs tidak valid. Data belum diubah.");
  const { data, updated_at, document_urls } = result.data as { data: SiteSectionData[K]; updated_at: string; document_urls?: Record<string, string> };
  return { data, updated_at, documentUrls: document_urls ?? {} };
}
export function parseSiteSection<K extends EditableSiteSectionKey>(key: K, value: unknown): SiteSectionData[K] {
  return parseSiteEnvelope(key, value).data;
}

/** Publik. Cadangan statis tetap tampil sampai seluruh respons berhasil diperiksa. Tanpa storage/polling. */
export async function getSiteEnvelope<K extends EditableSiteSectionKey>(key: K): Promise<SiteEnvelope<K> | null> {
  if (!apiBase) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiBase}/site/${key}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    return parseSiteEnvelope(key, await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
export async function getSiteSection<K extends EditableSiteSectionKey>(key: K): Promise<SiteSectionData[K] | null> {
  return (await getSiteEnvelope(key))?.data ?? null;
}

/** `request` dari useAdminSession() (adminRequest + hapus sesi saat 401). */
export type AdminRequest = <T>(path: string, options?: RequestInit) => Promise<T>;

/** Panel. 404 (belum pernah disimpan) dilempar sebagai AdminSiteNotFoundError oleh features/admin/api.ts. */
export async function getStaffSiteSection<K extends EditableSiteSectionKey>(request: AdminRequest, key: K) {
  return parseSiteEnvelope(key, await request<unknown>(`/staff/site/${key}`));
}
export async function putStaffSiteSection<K extends EditableSiteSectionKey>(request: AdminRequest, key: K, data: SiteSectionData[K]) {
  return parseSiteEnvelope(key, await request<unknown>(`/staff/site/${key}`, { method: "PUT", body: JSON.stringify({ data }) }));
}
/** 422 (bukan PDF / > 10 MB) dilempar sebagai AdminValidationError dengan field `file`. */
export async function uploadTransparencyDocument(request: AdminRequest, file: File): Promise<SiteSectionDocumentResponse> {
  const body = new FormData();
  body.append("file", file);
  const result = z.object({ path: budgetSchema.shape.documentPath.unwrap(), url: httpUrl }).strict()
    .safeParse(await request<unknown>("/staff/site/transparency/document", { method: "POST", body }));
  if (!result.success) throw new Error("Respons unggah tidak valid. Coba lagi.");
  return result.data;
}
