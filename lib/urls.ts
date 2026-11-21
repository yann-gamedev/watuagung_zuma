// Satu-satunya parser NEXT_PUBLIC_SITE_URL (dibekukan saat build). Sesi A1 menambah siteHref/adminHref di sini.
const warned = new Set<string>();

/** Origin situs publik tanpa slash akhir, atau null bila kosong/tidak valid (https wajib; http hanya localhost/127.0.0.1). */
export function siteOrigin(raw = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const url = URL.canParse(value) ? new URL(value) : null;
  const local = url?.hostname === "localhost" || url?.hostname === "127.0.0.1";
  if (url && (url.protocol === "https:" || (url.protocol === "http:" && local))
    && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) return url.origin;
  if (!warned.has(value)) {
    warned.add(value);
    console.warn(`NEXT_PUBLIC_SITE_URL tidak valid (${value}); contoh: https://desawatuagung.com. Canonical, sitemap, dan indeks dimatikan.`);
  }
  return null;
}
