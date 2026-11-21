import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Build produksi dengan env contoh, periksa out/, lalu build demo untuk memastikan noindex.
const origin = "https://contoh-desa.test";
const build = (env) => {
  const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

build({
  NEXT_PUBLIC_SITE_URL: origin,
  NEXT_PUBLIC_DEMO_MODE: "false",
  NEXT_PUBLIC_API_URL: `${origin}/api/v1`,
  NEXT_PUBLIC_SHOW_SAMPLE_CONTENT: "false",
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: "test-verification-token",
});

const read = (path) => readFileSync(join("out", path), "utf8");
const page = (path) => read(join(path, "index.html"));
const decode = (text) =>
  text
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
const tags = (html) => [...html.matchAll(/<meta\b[^>]*>/g)].map((match) => match[0]);
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const meta = (html, name) =>
  tags(html)
    .map((tag) => ({ name: attr(tag, "name") ?? attr(tag, "property"), content: attr(tag, "content") }))
    .find((item) => item.name === name)?.content;
const title = (html) => decode(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? "").trim();
const canonical = (html) => html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

const publicPaths = [
  "",
  "profil", "sejarah", "visi-misi", "struktur-pemerintahan", "statistik", "transparansi",
  "potensi", "bumdes", "umkm", "berita", "pelayanan", "kontak", "kebijakan-privasi", "agenda", "pengumuman",
  "pelayanan/domisili", "pelayanan/sktm", "pelayanan/belum-menikah", "pelayanan/keramaian",
  "pelayanan/kehilangan", "pelayanan/umum",
];

const seenTitles = new Map();
for (const path of publicPaths) {
  const html = page(path);
  const pageTitle = title(html);
  assert.ok(pageTitle, `${path}: judul kosong`);
  if (path) assert.ok(pageTitle.endsWith("| Desa Watuagung"), `${path}: judul "${pageTitle}" tanpa imbuhan desa`);
  assert.ok(!seenTitles.has(pageTitle), `${path}: judul sama dengan ${seenTitles.get(pageTitle)}`);
  seenTitles.set(pageTitle, path);
  const description = meta(html, "description");
  assert.ok(description, `${path}: deskripsi kosong`);
  assert.ok(description.length >= 120 && description.length <= 160, `${path}: deskripsi ${description.length} karakter`);
  assert.equal(canonical(html), `${origin}/${path ? `${path}/` : ""}`, `${path}: canonical`);
  assert.doesNotMatch(meta(html, "robots") ?? "", /noindex/, `${path}: halaman publik noindex`);
  assert.equal(meta(html, "og:locale"), "id_ID", `${path}: og:locale`);
  assert.equal(meta(html, "og:site_name"), "Desa Watuagung", `${path}: og:site_name`);
  assert.equal(meta(html, "og:image"), `${origin}/og/balai-desa.jpg`, `${path}: og:image`);
  assert.equal(meta(html, "twitter:card"), "summary_large_image", `${path}: twitter:card`);
}
assert.match(page(""), /google-site-verification" content="test-verification-token"/);
assert.match(page(""), /"@type":"GovernmentOrganization"/, "JSON-LD organisasi desa hilang");
assert.match(page(""), /"name":"Pemerintah Desa Watuagung"/);
assert.doesNotMatch(page(""), /"telephone"/, "JSON-LD memuat telepon placeholder");

for (const path of ["admin", "persetujuan", "verifikasi-email", "berhenti-email", "verifikasi", "pelayanan/status", "pelayanan/sukses"]) {
  const html = page(path);
  assert.match(meta(html, "robots") ?? "", /noindex/, `${path}: wajib noindex`);
  if (path === "admin") assert.equal(canonical(html), undefined, "admin tidak boleh punya canonical");
}
assert.ok(existsSync(join("out", "404.html")), "out/404.html tidak dibuat");
assert.match(meta(read("404.html"), "robots") ?? "", /noindex/, "404 wajib noindex");

const robots = read("robots.txt");
assert.match(robots, /User-Agent: \*/i);
assert.match(robots, /Allow: \//);
for (const path of ["/admin/", "/persetujuan/", "/verifikasi-email/", "/berhenti-email/", "/api/"]) {
  assert.ok(robots.includes(`Disallow: ${path}`), `robots.txt tanpa Disallow ${path}`);
}
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`), "robots.txt tanpa sitemap absolut");

const sitemap = read("sitemap.xml");
assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
assert.equal(urls.length, publicPaths.length, "jumlah URL sitemap tidak sesuai");
for (const path of publicPaths) assert.ok(urls.includes(`${origin}/${path ? `${path}/` : ""}`), `sitemap tanpa /${path}/`);
for (const path of urls) assert.doesNotMatch(path, /\/admin|\/pelayanan\/(status|sukses)|\/berita\/baca|\/umkm\/lihat/, `sitemap memuat ${path}`);

// Build demo: apa pun env sebelumnya, demo tidak boleh diindeks dan robot menutup semua.
build({
  NEXT_PUBLIC_SITE_URL: "",
  NEXT_PUBLIC_DEMO_MODE: "true",
  NEXT_PUBLIC_API_URL: "",
  NEXT_PUBLIC_SHOW_SAMPLE_CONTENT: "true",
});
assert.match(meta(page(""), "robots") ?? "", /noindex/, "demo: beranda wajib noindex");
assert.equal(canonical(page("")), undefined, "demo: canonical tanpa domain");
assert.doesNotMatch(page(""), /localhost:3000/, "demo: jangan menebak domain untuk og:image");
assert.match(read("robots.txt"), /Disallow: \/(\r?\n|$)/, "demo: robots wajib disallow semua");
assert.ok(!read("robots.txt").includes("Sitemap:"), "demo: robots tanpa sitemap");
assert.ok(!read("sitemap.xml").includes("<loc>"), "demo: sitemap kosong");

console.log(`PASS: ${publicPaths.length} public pages with unique titles, descriptions, canonicals, OG; private/404 noindex; robots and sitemap; demo noindex.`);
