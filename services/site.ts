import { z } from "zod";
import { apiBase } from "./pelayanan";
import type { SiteSectionData } from "@/types/site";

const text = (max: number) => z.string().min(1).max(max).regex(/^[^\p{Cc}]*$/u);
const block = z.object({ title: text(160), text: z.string().min(1).max(10000).regex(/^[^\x00-\x09\x0b\x0c\x0e-\x1f\x7f-\x9f]*$/) }).strict();
const fields = { intro: text(2000), blocks: z.array(block).min(1).max(20) };
export const profileDetailsSchema = z.object({
  themes: z.array(text(160)).max(6),
  stats: z.array(z.object({ value: text(160), label: text(160), detail: text(1000).optional() }).strict()).max(6),
  location: text(1000),
  boundaries: z.array(z.object({ direction: z.enum(["Utara", "Timur", "Selatan", "Barat"]), place: text(1000) }).strict()).length(4)
    .refine((items) => items.every((item, i) => item.direction === ["Utara", "Timur", "Selatan", "Barat"][i])),
  institutions: z.array(z.object({ name: text(160), description: text(2000) }).strict()).max(20),
  source: text(1000),
}).strict();
export const siteSchemas = {
  profile: z.object({ ...fields, profileDetails: profileDetailsSchema.optional() }).strict(),
  history: z.object(fields).strict(),
};
export type TextSiteKey = keyof typeof siteSchemas;

export function parseSiteSection<K extends TextSiteKey>(key: K, value: unknown): SiteSectionData[K] {
  const result = z.object({ key: z.literal(key), data: siteSchemas[key], updated_at: z.string().datetime() }).strict().safeParse(value);
  if (!result.success) throw new Error("Format bagian situs tidak valid. Data belum diubah.");
  return result.data.data as SiteSectionData[K];
}

/** Cadangan statis tetap tampil sampai seluruh respons berhasil diperiksa. Tanpa storage/polling. */
export async function getSiteSection<K extends TextSiteKey>(key: K): Promise<SiteSectionData[K] | null> {
  if (!apiBase) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiBase}/site/${key}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    return parseSiteSection(key, await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
