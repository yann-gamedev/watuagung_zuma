import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: path }).outputText;
}
const { pages } = await import(dataUrl(compile("lib/data.ts")));
const service = compile("services/site.ts").replace('from "zod"', `from ${JSON.stringify(import.meta.resolve("zod"))}`).replace('import { apiBase } from "./pelayanan";', 'const apiBase = "http://site.test/api/v1";');
const { siteSchemas, parseSiteSection, getSiteSection } = await import(dataUrl(service));
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
} finally { globalThis.fetch = original; }
console.log("PASS: kontrak profil/sejarah, data lama, kontrol, arah, fallback demo/404/galat, transport tanpa token.");
