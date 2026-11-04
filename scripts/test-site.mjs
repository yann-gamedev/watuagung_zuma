import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: path }).outputText;
}
const { pages, contact } = await import(dataUrl(compile("lib/data.ts")));
const service = compile("services/site.ts").replace('from "zod"', `from ${JSON.stringify(import.meta.resolve("zod"))}`).replace('import { apiBase } from "./pelayanan";', 'const apiBase = "http://site.test/api/v1";');
const { siteSchemas, parseSiteSection, parseSiteEnvelope, getSiteSection, getStaffSiteSection, putStaffSiteSection } = await import(dataUrl(service));
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
assert.deepEqual(parseSiteEnvelope("contact", contactEnvelope), { data: contact, updated_at: contactEnvelope.updated_at });
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
  globalThis.fetch = async (url) => { assert.equal(url, "http://site.test/api/v1/site/contact"); return Response.json(contactEnvelope); };
  assert.deepEqual(await getSiteSection("contact"), contact);
  globalThis.fetch = async () => Response.json({ ...contactEnvelope, data: { ...contact, phone: "+62" } });
  assert.equal(await getSiteSection("contact"), null);
} finally { globalThis.fetch = original; }
// Panel memakai request sesi (adminRequest), bukan fetch publik.
const calls = [];
const request = async (path, options) => { calls.push([path, options]); return contactEnvelope; };
assert.equal((await getStaffSiteSection(request, "contact")).updated_at, contactEnvelope.updated_at);
await putStaffSiteSection(request, "contact", contact);
assert.deepEqual(calls.map(([path, options]) => [path, options?.method]), [["/staff/site/contact", undefined], ["/staff/site/contact", "PUT"]]);
assert.deepEqual(JSON.parse(calls[1][1].body), { data: contact });
await assert.rejects(getStaffSiteSection(async () => ({ ...contactEnvelope, key: "profile" }), "contact"));
console.log("PASS: kontrak profil/sejarah/kontak, data lama, kontrol, arah, fallback demo/404/galat, transport tanpa token, get/put panel.");
