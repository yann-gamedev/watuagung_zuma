import assert from "node:assert/strict";

// Jalankan setelah npm run dev; periksa CSS HTTP aktual, bukan hanya source JSX.
const base = process.argv[2] || "http://127.0.0.1:3000";
for (const [path, selectors] of [
  ["/profil/", [".profile-bento", ".profile-themes", ".profile-map-frame", ".profile-key-figures"]],
  ["/visi-misi/", [".constructive-board", ".constructive-mission", ".constructive-number", ".visi-heading-wrap"]],
]) {
  const page = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
  assert.equal(page.status, 200, path);
  const html = await page.text();
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => tag)
    .filter((tag) => /rel="stylesheet"/.test(tag))
    .map((tag) => tag.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
  assert.ok(links.length, `${path}: stylesheet tidak ditemukan`);
  const css = (await Promise.all(links.map(async (href) => {
    const response = await fetch(new URL(href.replaceAll("&amp;", "&"), base), { signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, href);
    return response.text();
  }))).join("\n");
  for (const selector of selectors) assert.ok(css.includes(selector), `${path}: CSS basi, ${selector} hilang`);
  console.log(`PASS ${path}: CSS redesain diterima dari server`);
}
