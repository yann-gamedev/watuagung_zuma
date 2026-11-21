// Satu-satunya parser NEXT_PUBLIC_SITE_URL dan NEXT_PUBLIC_ADMIN_URL (keduanya dibekukan saat build).
const warned = new Set<string>();

/** Origin tanpa slash akhir, atau null bila kosong/tidak valid (https wajib; http hanya localhost/127.0.0.1). */
function parseOrigin(raw: string | undefined, name: string, consequence: string): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const url = URL.canParse(value) ? new URL(value) : null;
  const local = url?.hostname === "localhost" || url?.hostname === "127.0.0.1";
  if (url && (url.protocol === "https:" || (url.protocol === "http:" && local))
    && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) return url.origin;
  if (!warned.has(`${name}=${value}`)) {
    warned.add(`${name}=${value}`);
    console.warn(`${name} tidak valid (${value}); ${consequence}`);
  }
  return null;
}

/** Origin situs publik (canonical, sitemap, tautan panel → situs). */
export function siteOrigin(raw = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  return parseOrigin(raw, "NEXT_PUBLIC_SITE_URL",
    "contoh: https://desawatuagung.com. Canonical, sitemap, dan indeks dimatikan.");
}

/** Origin panel petugas di subdomain (deploy/hostinger.md § N). Kosong = panel di origin yang sama. */
export function adminOrigin(raw = process.env.NEXT_PUBLIC_ADMIN_URL): string | null {
  return parseOrigin(raw, "NEXT_PUBLIC_ADMIN_URL",
    "contoh: https://admin.desawatuagung.com. Tautan ke panel tetap relatif.");
}

function join(origin: string | null, path: string): string {
  // Path wajib diawali satu "/" (bukan "//host" yang berarti origin lain).
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`Path tautan harus diawali "/": ${path}`);
  return origin ? `${origin}${path}` : path;
}

/**
 * Tautan panel → situs publik. Absolut hanya bila panel di origin lain (NEXT_PUBLIC_ADMIN_URL valid) dan
 * NEXT_PUBLIC_SITE_URL valid. NEXT_PUBLIC_SITE_URL sudah diisi untuk SEO, jadi tanpa panel subdomain tautan tetap
 * relatif. Bila hanya NEXT_PUBLIC_ADMIN_URL terisi, path relatif di subdomain dialihkan admin.htaccess ke situs utama.
 */
export function siteHref(path: string, site = siteOrigin(), admin = adminOrigin()): string {
  return join(admin ? site : null, path);
}

/** Tautan ke panel: absolut bila NEXT_PUBLIC_ADMIN_URL valid, selain itu relatif. */
export function adminHref(path: string, origin = adminOrigin()): string {
  return join(origin, path);
}

/** Tautan absolut (lintas origin) memakai <a>, bukan next/link. */
export function isAbsoluteHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}
