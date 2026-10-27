import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Build produksi dengan konten contoh dimatikan, lalu periksa seluruh berkas teks di out/.
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SHOW_SAMPLE_CONTENT: "false" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const files = readdirSync("out", { recursive: true })
  .map(String)
  .filter((file) => /\.(html|js|txt|json|rsc)$/.test(file));
assert.ok(files.length > 0, "out/ kosong");
const forbidden = ["Artikel contoh", "Agenda contoh", "Contoh pengumuman", "Konten masih contoh"];
for (const file of files) {
  const text = readFileSync(join("out", file), "utf8");
  for (const phrase of forbidden) assert.ok(!text.includes(phrase), `${file} memuat "${phrase}"`);
}
const page = (path) => readFileSync(join("out", path, "index.html"), "utf8");
assert.match(page("berita"), /Belum ada berita resmi\./);
assert.match(page("berita/belum-ada"), /Belum ada berita resmi\./);
assert.match(page("agenda"), /Belum ada agenda resmi\./);
assert.match(page("pengumuman"), /Belum ada pengumuman resmi\./);
assert.match(page(""), /Sumber data: dokumen resmi Pemerintah Desa Watuagung\./);
assert.ok(!page("").includes('id="news-title"'), "Beranda masih merender bagian berita");
assert.ok(page("").includes('href="/berita/"'), "Tautan /berita hilang dari beranda");
assert.match(page("pelayanan/sku"), /masih contoh/, "Label contoh persyaratan harus tetap");
console.log(`PASS: ${files.length} files without sample news/agenda/announcement text; empty states and official footer present.`);
