import { z } from "zod";
import { news } from "@/lib/data";
import { apiBase, isDemo } from "@/services/pelayanan";
import { postCategories, socialPlatforms, type PublicPost, type SocialPlatform } from "@/types/posts";
import { isSocialLink, socialPlatformInfo } from "@/lib/social-links";

const mediaUrl = z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)).nullable();
const postSchema = z.object({
  slug: z.string().min(1), title: z.string().min(1), category: z.enum(postCategories),
  category_label: z.string().min(1), summary: z.string(), published_at: z.string().datetime({ offset: true }),
  cover_url: mediaUrl,
});
const imageSchema = z.object({ url: z.string().url().refine((value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol)), caption: z.string().nullable() });
const detailSchema = postSchema.extend({
  body: z.string(), images: z.array(imageSchema).default([]),
  show_copyright: z.boolean().default(false),
  social_links: z.record(z.string(), z.string()).default({}),
});
const pageSchema = z.object({
  data: z.array(postSchema), current_page: z.number().int().positive(),
  last_page: z.number().int().positive(), total: z.number().int().nonnegative(),
});
export type NewsItem = {
  slug: string; title: string; category: string; date: string; summary: string;
  coverUrl: string | null; sample: boolean;
};
export type NewsImage = { url: string; caption: string | null };
export type NewsSocialLink = { platform: SocialPlatform; label: string; url: string };
/** `copyrightYear` diisi hanya bila berita memilih menampilkan hak cipta KIM. */
export type NewsDetail = NewsItem & { body: string; images: NewsImage[]; copyrightYear: number | null; socialLinks: NewsSocialLink[] };
export type NewsPage = { data: NewsItem[]; current_page: number; last_page: number; total: number };
const demoPosts: NewsDetail[] = news.map((item) => ({
  ...item, body: item.content.join("\n\n"), coverUrl: null, sample: true, images: [], copyrightYear: null, socialLinks: [],
}));
export const initialNewsPage: NewsPage | null = isDemo
  ? { data: demoPosts, current_page: 1, last_page: 1, total: demoPosts.length }
  : null;
export function newsHref(slug: string) {
  return isDemo ? `/berita/${encodeURIComponent(slug)}/` : `/berita/baca/?slug=${encodeURIComponent(slug)}`;
}
function newsItem(post: PublicPost): NewsItem {
  return {
    slug: post.slug, title: post.title, category: post.category_label, summary: post.summary,
    date: new Date(post.published_at).toLocaleDateString("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }),
    coverUrl: post.cover_url, sample: false,
  };
}
async function request<T>(path: string, schema: z.ZodType<T>, allowMissing = false): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store",
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error("Berita belum dapat dimuat");
    return schema.parse(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Waktu tunggu habis. Coba lagi.");
    throw error;
  } finally { clearTimeout(timeout); }
}
export async function listPosts(page = 1): Promise<NewsPage> {
  z.number().int().positive().parse(page);
  if (isDemo) return { ...initialNewsPage!, data: page === 1 ? demoPosts : [], current_page: page };
  const result = (await request(`/posts?page=${page}`, pageSchema))!;
  return { ...result, data: result.data.map(newsItem) };
}
export async function getPost(slug: string): Promise<NewsDetail | null> {
  if (!slug.trim()) return null;
  if (isDemo) return demoPosts.find((item) => item.slug === slug) ?? null;
  const post = await request(`/posts/${encodeURIComponent(slug)}`, detailSchema, true);
  return post ? {
    ...newsItem(post), body: post.body, images: post.images ?? [],
    copyrightYear: post.show_copyright ? Number(new Date(post.published_at).toLocaleString("en-US", { year: "numeric", timeZone: "Asia/Jakarta" })) : null,
    // Urutan tetap; platform/host tak dikenal diabaikan walau server sudah memvalidasi.
    socialLinks: socialPlatforms.flatMap((platform) => {
      const url = post.social_links?.[platform];
      return url && isSocialLink(platform, url) ? [{ platform, label: socialPlatformInfo[platform].label, url }] : [];
    }),
  } : null;
}
