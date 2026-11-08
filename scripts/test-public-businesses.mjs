import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

// Sama dengan test-public-news.mjs: kompilasi sumber asli; tag mode memisahkan cache ESM.
async function source(mode, entry = "services/businesses.ts") {
  const modules = new Map();
  function url(path) {
    if (modules.has(path)) return modules.get(path);
    let code = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: path,
    }).outputText;
    code = code.replace(/(["'])(@\/[^"']+|zod)\1/g, (_match, _quote, name) => {
      if (!name.startsWith("@/")) return JSON.stringify(import.meta.resolve(name));
      const file = name.slice(2);
      return JSON.stringify(url(existsSync(`${file}.ts`) ? `${file}.ts` : `${file}.tsx`));
    });
    const result = `data:text/javascript;base64,${Buffer.from(`${code}\n//# sourceURL=${path}?mode=${mode}\n`).toString("base64")}`;
    modules.set(path, result);
    return result;
  }
  return import(url(entry));
}

const envKeys = ["NEXT_PUBLIC_DEMO_MODE", "NEXT_PUBLIC_API_URL"];
const savedEnv = envKeys.map((key) => process.env[key]);
const savedFetch = globalThis.fetch;
const apiBase = "https://api.example.test/api/v1";
const base = {
  slug: "keripik fiktif/?", name: "Keripik Fiktif", category: "makanan_minuman", category_label: "Makanan & Minuman",
  description: "Deskripsi fiktif.", hamlet: "Talang", photo_url: "https://media.example.test/businesses/a.webp", published_at: "2026-11-05T01:00:00+00:00",
};
const consented = { ...base, slug: "izin", owner_name: "Pemilik Fiktif", whatsapp: "6280000000001" };
const calls = [];
const reply = (body, status = 200) => { globalThis.fetch = async (url, options) => {
  calls.push(url); assert.equal(options.cache, "no-store"); assert.deepEqual(options.headers, { Accept: "application/json" });
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}; };
const mode = (demo, api = apiBase) => { process.env.NEXT_PUBLIC_DEMO_MODE = demo; process.env.NEXT_PUBLIC_API_URL = api; };

try {
  // Demo: tidak memanggil API dan tidak mengarang UMKM.
  globalThis.fetch = () => { throw new Error("Demo must not call fetch"); };
  mode("true");
  const demo = await source("demo");
  assert.deepEqual(await demo.listBusinesses(), { data: [], current_page: 1, last_page: 1, total: 0 });
  assert.deepEqual((await demo.listBusinesses(2, "jasa", "latest")).data, []);
  assert.equal(await demo.getBusiness("apa-saja"), null);
  assert.equal(demo.businessHref(base.slug), `/umkm/lihat/?slug=${encodeURIComponent(base.slug)}`);

  mode("false");
  const api = await source("api");
  reply({ data: [base, consented], current_page: 1, last_page: 2, total: 13, per_page: 12 });
  const page = await api.listBusinesses(1, "makanan_minuman");
  assert.equal(page.total, 13); assert.equal(page.data.length, 2);
  assert.equal(calls.at(-1), `${apiBase}/businesses?page=1&category=makanan_minuman`);
  await api.listBusinesses(1, undefined, "latest");
  assert.equal(calls.at(-1), `${apiBase}/businesses?page=1&sort=latest`);
  await assert.rejects(api.listBusinesses(0));
  await assert.rejects(api.listBusinesses(1, "bukan"));

  // WhatsApp hanya dari nomor yang dikirim server; tanpa izin tidak ada tombol.
  assert.equal(api.whatsappHref(base), null);
  assert.equal(api.whatsappHref({ ...consented, whatsapp: null }), null);
  assert.equal(api.whatsappHref({ ...consented, whatsapp: "081234" }), null);
  assert.match(api.whatsappHref(consented), /^https:\/\/wa\.me\/6280000000001\?text=/);

  reply(consented);
  assert.equal((await api.getBusiness("izin")).whatsapp, "6280000000001");
  assert.equal(calls.at(-1), `${apiBase}/businesses/izin`);
  reply({}, 404); assert.equal(await api.getBusiness("tidak-ada"), null);
  assert.equal(await api.getBusiness("  "), null);
  reply({}, 500); await assert.rejects(api.getBusiness("x"), /belum dapat dimuat/);
  for (const bad of [{ ...base, photo_url: "javascript:alert(1)" }, { ...base, hamlet: "Lain" }, { ...base, whatsapp: "+62" }, { ...base, extra: 1 }, { ...base, category: "x" }]) {
    reply(bad); await assert.rejects(api.getBusiness("x"), JSON.stringify(bad));
  }
  reply({ data: [{ ...base, slug: "" }], current_page: 1, last_page: 1, total: 1 }); await assert.rejects(api.listBusinesses());
  console.log("PASS: UMKM publik — demo kosong tanpa fetch, query kategori/urutan, skema ketat, 404/galat, tombol WhatsApp hanya bila nomor dikirim.");
} finally {
  globalThis.fetch = savedFetch;
  envKeys.forEach((key, index) => { if (savedEnv[index] === undefined) delete process.env[key]; else process.env[key] = savedEnv[index]; });
}
