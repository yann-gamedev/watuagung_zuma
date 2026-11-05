import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: path }).outputText;
}
const { pages, contact } = await import(dataUrl(compile("lib/data.ts")));
const transparencyUrl = dataUrl(compile("lib/transparency.ts"));
const { budgetTotals, formatRupiah, SPENDING_FIELDS } = await import(transparencyUrl);
const youtubeUrl = dataUrl(compile("lib/youtube.ts"));
const { youtubeId, youtubeEmbedUrl, youtubeThumbnailUrl, youtubeWatchUrl } = await import(youtubeUrl);
const service = compile("services/site.ts").replace('from "zod"', `from ${JSON.stringify(import.meta.resolve("zod"))}`).replace('import { apiBase } from "./pelayanan";', 'const apiBase = "http://site.test/api/v1";')
  .replace('from "@/lib/transparency"', `from ${JSON.stringify(transparencyUrl)}`).replace('from "@/lib/youtube"', `from ${JSON.stringify(youtubeUrl)}`);
const { siteSchemas, siteInputSchemas, parseSiteSection, parseSiteEnvelope, getSiteSection, getSiteEnvelope, getStaffSiteSection, putStaffSiteSection, uploadTransparencyDocument, uploadStructureImage } = await import(dataUrl(service));
const structure = { blocks: pages["struktur-pemerintahan"].blocks, source: pages["struktur-pemerintahan"].source };
const chartImagePath = "site/structure/0123abcd-0123-4567-89ab-0123456789ab.webp";
assert.ok(siteSchemas.structure.safeParse(structure).success);
assert.ok(siteSchemas.structure.safeParse({ ...structure, chartImagePath, chartAlt: "Bagan fiktif" }).success);
assert.ok(siteSchemas.structure.safeParse({ ...structure, blocks: [{ title: "Jabatan", text: "Nama\nNama lain\r\nTeks" }] }).success);
for (const override of [
  { chartImagePath }, { chartImagePath, chartAlt: " " }, { chartImagePath, chartAlt: "x".repeat(301) },
  { chartImagePath: "https://evil.test/bagan.jpg", chartAlt: "Bagan" }, { chartImagePath: "site/structure/../x.jpg" },
  { chartImagePath: "" }, { chartImagePath: null }, { chartAlt: "x\t" }, { chartAlt: "x\n" },
  { source: "" }, { source: "x".repeat(1001) }, { source: "x\0" }, { blocks: [] },
  { blocks: Array(21).fill({ title: "x", text: "x" }) }, { blocks: [{ title: "x", text: "x", extra: "x" }] },
  { blocks: [{ title: "x".repeat(161), text: "x" }] }, { blocks: [{ title: "x", text: "x".repeat(10001) }] },
  { blocks: [{ title: "x", text: "x\t" }] }, { extra: "x" },
]) assert.equal(siteSchemas.structure.safeParse({ ...structure, ...override }).success, false, JSON.stringify(override).slice(0, 150));
const structureEnvelope = { key: "structure", data: { ...structure, chartImagePath, chartAlt: "Bagan" }, updated_at: "2026-11-05T00:00:00Z", image_url: `http://site.test/storage/${chartImagePath}` };
assert.equal(parseSiteEnvelope("structure", structureEnvelope).imageUrl, structureEnvelope.image_url);
assert.equal(parseSiteEnvelope("structure", { ...structureEnvelope, data: structure, image_url: null }).imageUrl, null);
assert.throws(() => parseSiteEnvelope("structure", { ...structureEnvelope, image_url: "javascript:alert(1)" }));
assert.throws(() => parseSiteEnvelope("structure", { ...structureEnvelope, image_url: undefined }));
const imageUpload = await uploadStructureImage(async (url, options) => {
  assert.equal(url, "/staff/site/structure/image"); assert.equal(options.method, "POST");
  assert.ok(options.body instanceof FormData); assert.equal(options.headers, undefined);
  assert.equal(options.body.get("file").name, "chart.png");
  return { path: chartImagePath, url: structureEnvelope.image_url };
}, new File(["fake"], "chart.png"));
assert.equal(imageUpload.path, chartImagePath);
await assert.rejects(uploadStructureImage(async () => ({ path: "../x.jpg", url: "http://x" }), new File([""], "a.png")));
// Transparansi: format, total, skema; total tidak boleh dikirim; bidang belanja sama dengan backend.
assert.equal(formatRupiah(1234567), "Rp1.234.567");
assert.equal(formatRupiah(0), "Rp0");
assert.equal(formatRupiah(100000000000), "Rp100.000.000.000");
assert.equal(formatRupiah(-5000), "-Rp5.000");
const php = readFileSync("backend/app/Domain/SiteSectionRules.php", "utf8");
assert.deepEqual([...SPENDING_FIELDS], [...php.match(/SPENDING_FIELDS = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
const budget = {
  year: 2027, status: "Ditetapkan", revenue: [{ label: "Dana Desa fiktif", amount: 1000000 }, { label: "PAD fiktif", amount: 250000 }],
  spending: SPENDING_FIELDS.map((label, i) => ({ label, amount: (i + 1) * 100000 })), financing: [{ label: "SiLPA fiktif", amount: 7000 }], source: "Sumber fiktif",
};
assert.deepEqual(budgetTotals(budget), { revenue: 1250000, spending: 1500000, financing: 7000, surplus: -250000 });
assert.deepEqual(budgetTotals({ revenue: [], spending: [] }), { revenue: 0, spending: 0, financing: 0, surplus: 0 });
const transparency = { intro: pages.transparansi.intro, programs: pages.transparansi.blocks, budgets: [budget] };
assert.ok(siteSchemas.transparency.safeParse(transparency).success);
assert.ok(siteSchemas.transparency.safeParse({ ...transparency, budgets: [] }).success);
assert.ok(siteSchemas.transparency.safeParse({ ...transparency, budgets: [{ ...budget, documentPath: "site/documents/0123abcd-0123-4567-89ab-0123456789ab.pdf" }] }).success);
for (const mutate of [
  (x) => { x.budgets[0].totalRevenue = 1; }, (x) => { x.total = 1; }, (x) => { x.budgets[0].revenue[0].total = 1; },
  (x) => { x.budgets[0].revenue[0].amount = -1; }, (x) => { x.budgets[0].revenue[0].amount = 1.5; }, (x) => { x.budgets[0].revenue[0].amount = Number.NaN; },
  (x) => { x.budgets[0].revenue[0].amount = 100000000001; }, (x) => { x.budgets[0].revenue = []; }, (x) => { x.budgets[0].spending.reverse(); },
  (x) => { x.budgets[0].spending.pop(); }, (x) => { x.budgets[0].year = 1999; }, (x) => { x.budgets[0].status = "Final"; },
  (x) => { x.budgets.push(structuredClone(x.budgets[0])); }, (x) => { x.budgets = Array.from({ length: 6 }, (_, i) => ({ ...budget, year: 2020 + i })); },
  (x) => { x.budgets[0].documentPath = "../.env"; }, (x) => { x.budgets[0].source = ""; }, (x) => { x.programs = []; }, (x) => { x.programs[0].text += "\t"; },
]) { const input = structuredClone(transparency); mutate(input); assert.equal(siteSchemas.transparency.safeParse(input).success, false, mutate.toString()); }
const duplicate = siteSchemas.transparency.safeParse({ ...transparency, budgets: [budget, budget] }).error.issues[0];
assert.deepEqual(duplicate.path, ["budgets", 1, "year"]);
const profile = { intro: pages.profil.intro, blocks: pages.profil.blocks, profileDetails: pages.profil.profileDetails };
assert.ok(siteSchemas.profile.safeParse(profile).success);
assert.ok(siteSchemas.profile.safeParse({ intro: profile.intro, blocks: profile.blocks }).success);
for (const mutate of [
  (x) => { x.profileDetails.themes = Array(7).fill("Tema"); },
  (x) => { x.profileDetails.boundaries[0].direction = "Timur"; },
  (x) => { x.profileDetails.stats[0].unknown = "x"; },
  (x) => { x.intro = "\tRingkasan"; },
  (x) => { x.profileDetails.institutions[0].description += "\n"; },
]) { const input = structuredClone(profile); mutate(input); assert.equal(siteSchemas.profile.safeParse(input).success, false); }
const envelope = { key: "profile", data: profile, updated_at: "2026-11-04T00:00:00.000000Z" };
assert.deepEqual(parseSiteSection("profile", envelope), profile);
assert.throws(() => parseSiteSection("history", envelope));
// Kontak: cadangan statis valid; batas sama dengan SiteSectionRules.
assert.ok(siteSchemas.contact.safeParse(contact).success);
for (const phone of ["", "[PLACEHOLDER]", "6281234567890"]) assert.ok(siteSchemas.contact.safeParse({ ...contact, phone }).success, phone);
for (const override of [
  { phone: "+6281234567890" }, { phone: "081234567890" }, { phone: "62 812" }, { phone: "6200000000000000" },
  { mapsEmbedUrl: "https://www.google.com.evil.test/maps/embed?x" }, { mapsEmbedUrl: "<iframe src=\"https://www.google.com/maps/embed?x\">" },
  { mapsLinkUrl: "javascript:alert(1)" }, { mapsLinkUrl: "https://maps.app.goo.gl.evil.test/x" },
  { address: "" }, { hours: "x".repeat(201) }, { contactName: "x".repeat(161) }, { address: "Alamat\nbaris" }, { nik: "0000000000000001" },
]) assert.equal(siteSchemas.contact.safeParse({ ...contact, ...override }).success, false, JSON.stringify(override));
const phoneIssue = siteSchemas.contact.safeParse({ ...contact, phone: "0812" }).error.issues[0];
assert.deepEqual(phoneIssue.path, ["phone"]);
assert.match(phoneIssue.message, /6281234567890/);
assert.ok(siteSchemas.contact.safeParse({ ...contact, mapsEmbedUrl: "https://www.google.com/maps/embed?pb=fiktif", mapsLinkUrl: "https://www.google.com/maps/place/fiktif" }).success);
const contactEnvelope = { key: "contact", data: contact, updated_at: "2026-11-05T01:02:03.000000Z" };
assert.deepEqual(parseSiteEnvelope("contact", contactEnvelope), { data: contact, updated_at: contactEnvelope.updated_at, documentUrls: {} });
const original = globalThis.fetch;
try {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://site.test/api/v1/site/profile");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, undefined);
    return Response.json(envelope);
  };
  assert.deepEqual(await getSiteSection("profile"), profile);
  for (const status of [404, 500]) { globalThis.fetch = async () => new Response("", { status }); assert.equal(await getSiteSection("profile"), null); }
  globalThis.fetch = async () => Response.json({ ...envelope, data: { intro: "rusak" } });
  assert.equal(await getSiteSection("profile"), null);
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal(await getSiteSection("profile"), null);
  const demo = await import(dataUrl(service.replace('const apiBase = "http://site.test/api/v1";', 'const apiBase = "";')));
  globalThis.fetch = async () => assert.fail("Demo tidak boleh memanggil API");
  assert.equal(await demo.getSiteSection("profile"), null);
  assert.equal(await demo.getSiteSection("structure"), null);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://site.test/api/v1/site/structure"); assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, undefined); return Response.json(structureEnvelope);
  };
  assert.equal((await getSiteEnvelope("structure")).imageUrl, structureEnvelope.image_url);
  for (const status of [404, 500]) { globalThis.fetch = async () => new Response("", { status }); assert.equal(await getSiteSection("structure"), null); }
  globalThis.fetch = async () => { throw new Error("offline"); };
  assert.equal(await getSiteSection("structure"), null);
  globalThis.fetch = async (url) => { assert.equal(url, "http://site.test/api/v1/site/contact"); return Response.json(contactEnvelope); };
  assert.deepEqual(await getSiteSection("contact"), contact);
  globalThis.fetch = async () => Response.json({ ...contactEnvelope, data: { ...contact, phone: "+62" } });
  assert.equal(await getSiteSection("contact"), null);
  // document_urls hanya sah untuk transparency dan harus http(s).
  globalThis.fetch = async () => Response.json({ ...contactEnvelope, document_urls: {} });
  assert.equal(await getSiteSection("contact"), null);
  const urls = { "site/documents/0123abcd-0123-4567-89ab-0123456789ab.pdf": "http://site.test/storage/site/documents/0123abcd-0123-4567-89ab-0123456789ab.pdf" };
  const transparencyEnvelope = { key: "transparency", data: transparency, updated_at: contactEnvelope.updated_at, document_urls: urls };
  globalThis.fetch = async () => Response.json(transparencyEnvelope);
  assert.deepEqual(await getSiteEnvelope("transparency"), { data: transparency, updated_at: contactEnvelope.updated_at, documentUrls: urls });
  for (const bad of [{ document_urls: undefined }, { document_urls: { x: "javascript:alert(1)" } }, { data: { ...transparency, budgets: [{ ...budget, totalRevenue: 1 }] } }]) {
    globalThis.fetch = async () => Response.json({ ...transparencyEnvelope, ...bad });
    assert.equal(await getSiteEnvelope("transparency"), null, JSON.stringify(bad));
  }
} finally { globalThis.fetch = original; }
const uploads = [];
const path = "site/documents/0123abcd-0123-4567-89ab-0123456789ab.pdf";
const uploaded = await uploadTransparencyDocument(async (url, options) => { uploads.push([url, options]); return { path, url: `http://site.test/storage/${path}` }; }, new File(["%PDF-"], "a.pdf"));
assert.equal(uploaded.path, path);
assert.equal(uploads[0][0], "/staff/site/transparency/document");
assert.equal(uploads[0][1].method, "POST");
assert.ok(uploads[0][1].body instanceof FormData);
await assert.rejects(uploadTransparencyDocument(async () => ({ path: "../x.pdf", url: "http://x" }), new File([""], "a.pdf")));
// Panel memakai request sesi (adminRequest), bukan fetch publik.
const calls = [];
const request = async (path, options) => { calls.push([path, options]); return contactEnvelope; };
assert.equal((await getStaffSiteSection(request, "contact")).updated_at, contactEnvelope.updated_at);
await putStaffSiteSection(request, "contact", contact);
assert.deepEqual(calls.map(([path, options]) => [path, options?.method]), [["/staff/site/contact", undefined], ["/staff/site/contact", "PUT"]]);
assert.deepEqual(JSON.parse(calls[1][1].body), { data: contact });
await assert.rejects(getStaffSiteSection(async () => ({ ...contactEnvelope, key: "profile" }), "contact"));
// Video R8: parser cermin SiteSectionRules::youtubeId; respons hanya ID, PUT mengirim link.
const id = "AbCdEfGh_1-";
for (const url of [`https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s`, `https://m.youtube.com/watch?feature=share&v=${id}`,
  `http://www.youtube.com/watch/?v=${id}`, `HTTPS://WWW.YOUTUBE.COM/watch?v=${id}`, `https://youtu.be/${id}`, `https://youtu.be/${id}/`, ` https://youtu.be/${id}?si=x `,
  `https://www.youtube.com/shorts/${id}?feature=share`, `https://youtube.com/embed/${id}?start=10`, `https://www.youtube.com/embed/${id}#x`]) assert.equal(youtubeId(url), id, url);
for (const url of [id, `www.youtube.com/watch?v=${id}`, `ftp://youtu.be/${id}`, `javascript:alert('${id}')`, `https://www.youtube-nocookie.com/embed/${id}`,
  `https://youtube.com.evil.test/watch?v=${id}`, `https://evil.test/?u=https://youtu.be/${id}`, `https://user@youtu.be/${id}`, `https://youtu.be:8443/${id}`,
  "https://www.youtube.com/watch?v=AbCdEfGh_1", `https://www.youtube.com/watch?v=${id}x`, `https://www.youtube.com/watch?list=${id}`, `https://www.youtube.com/channel/${id}`,
  `https://youtu.be/${id}/extra`, "https://www.youtube.com/shorts/", `https://youtu.be/${id}\t?x=1`, `https://you\ntu.be/${id}`,`<iframe src="https://www.youtube.com/embed/${id}"></iframe>`,
  `https://www.youtube.com/watch?v=${id}${"&x=1".repeat(600)}`, ""]) assert.equal(youtubeId(url), null, url);
assert.equal(youtubeThumbnailUrl(id), `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
assert.ok(youtubeEmbedUrl(id).startsWith(`https://www.youtube-nocookie.com/embed/${id}`));
assert.equal(youtubeId(youtubeWatchUrl(id)), id);
const storedVideos = { profile: { youtubeId: id, title: "Profil fiktif" }, tutorial: null };
assert.ok(siteSchemas.videos.safeParse(storedVideos).success);
assert.ok(siteSchemas.videos.safeParse({ profile: null, tutorial: null }).success);
for (const bad of [{ profile: null }, { ...storedVideos, extra: null }, { profile: { url: `https://youtu.be/${id}`, title: "x" }, tutorial: null },
  { profile: { youtubeId: "bad", title: "x" }, tutorial: null }, { profile: { youtubeId: id, title: "" }, tutorial: null }, { profile: { youtubeId: id, title: "a\nb" }, tutorial: null }])
  assert.equal(siteSchemas.videos.safeParse(bad).success, false, JSON.stringify(bad));
const videoInput = siteInputSchemas.videos.safeParse({ profile: { url: `https://youtu.be/${id}`, title: "Profil fiktif" }, tutorial: { url: "", title: "" } });
assert.deepEqual(videoInput.data, { profile: { url: `https://youtu.be/${id}`, title: "Profil fiktif" }, tutorial: null });
for (const [bad, path] of [[{ url: "https://vimeo.com/1", title: "x" }, "profile.url"], [{ url: `https://youtu.be/${id}`, title: "" }, "profile.title"], [{ url: "", title: "Judul" }, "profile.url"]]) {
  const result = siteInputSchemas.videos.safeParse({ profile: bad, tutorial: null });
  assert.equal(result.success, false); assert.equal(result.error.issues[0].path.join("."), path);
}
assert.equal(siteInputSchemas.contact, siteSchemas.contact);
const videoEnvelope = { key: "videos", data: storedVideos, updated_at: contactEnvelope.updated_at };
const savedFetch = globalThis.fetch;
try {
  globalThis.fetch = async (url, options) => { assert.equal(url, "http://site.test/api/v1/site/videos"); assert.equal(options.headers.Authorization, undefined); return Response.json(videoEnvelope); };
  assert.deepEqual(await getSiteSection("videos"), storedVideos);
  for (const status of [404, 500]) { globalThis.fetch = async () => new Response("", { status }); assert.equal(await getSiteSection("videos"), null); }
  globalThis.fetch = async () => Response.json({ ...videoEnvelope, data: { profile: { url: `https://youtu.be/${id}`, title: "x" }, tutorial: null } });
  assert.equal(await getSiteSection("videos"), null);
} finally { globalThis.fetch = savedFetch; }
const videoCalls = [];
await putStaffSiteSection(async (path, options) => { videoCalls.push([path, options]); return videoEnvelope; }, "videos", videoInput.data);
assert.deepEqual(JSON.parse(videoCalls[0][1].body), { data: videoInput.data });
console.log("PASS: video YouTube (parser, skema simpan/input, fallback, PUT link).");
console.log("PASS: kontrak profil/sejarah/kontak/transparansi/struktur, bagan+alt, unggah gambar/PDF, budgetTotals, formatRupiah, data lama, kontrol, arah, fallback demo/404/galat, transport tanpa token, get/put panel.");
