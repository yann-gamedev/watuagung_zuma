import type { MetadataRoute } from "next";
import { pages, services } from "@/lib/data";
import { siteOrigin } from "@/lib/urls";

export const dynamic = "force-static";

// Halaman publik yang dirender penuh saat build. Berita dan UMKM per item dimuat di browser
// dari API, jadi tidak masuk sitemap; detailnya hanya diketahui lewat tautan di /berita/ dan /umkm/.
const staticPaths = [
  "/",
  ...Object.keys(pages).map((slug) => `/${slug}/`),
  "/statistik/",
  "/bumdes/",
  "/umkm/",
  "/berita/",
  "/pelayanan/",
  "/kebijakan-privasi/",
  ...services.map((service) => `/pelayanan/${service.slug}/`),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];
  const lastModified = new Date();
  return staticPaths.map((path) => ({
    url: `${origin}${path}`,
    lastModified,
    changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: path === "/" ? 1 : 0.7,
  }));
}
