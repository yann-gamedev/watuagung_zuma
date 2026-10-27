import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile source in memory, like test-demo.mjs; no additional dependencies.
function moduleUrl(path) {
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [alias, file] of [["@/lib/data", "lib/data.ts"], ["@/types/pelayanan", "types/pelayanan.ts"]]) {
    if (code.includes(`"${alias}"`)) code = code.replaceAll(`"${alias}"`, JSON.stringify(moduleUrl(file)));
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const { parseApplicationFilters: parse, parseApplicationSection: section, buildApplicationsHref: list,
  buildApplicationDetailHref: detail, buildApplicationsApiPath: api, APPLICATION_SEARCH_MAX_LENGTH } = await import(moduleUrl("features/admin/application-filters.ts"));
const params = (query) => new URLSearchParams(query);
assert.equal(APPLICATION_SEARCH_MAX_LENGTH, 100);
assert.deepEqual(parse(params("status=INVALID&jenis_surat=INVALID&sort=invalid&page=-1")), {
  q: "", status: "", jenis_surat: "", sort: "terbaru", page: 1,
});
for (const page of ["1.5", "1e2", "Infinity", "9999999999999999999", "0"]) assert.equal(parse(params(`page=${page}`)).page, 1);
assert.equal(parse(params(`q=${"a".repeat(101)}`)).q.length, 100);
assert.equal(parse(params("q=%20Warga%20Fiktif%20")).q, "Warga Fiktif");
assert.equal(section("https://example.test/"), "permohonan");
assert.equal(section("//example.test/"), "permohonan");
assert.equal(parse(params("status=SUBMITTED"), "persetujuan").status, "WAITING_APPROVAL");
const fixed = new URL(api("surat", parse(params("status=REJECTED"))), "https://example.test");
assert.deepEqual(fixed.searchParams.getAll("statuses[]"), ["APPROVED", "READY_FOR_PICKUP"]);
assert.equal(fixed.searchParams.has("status"), false);
const filtered = new URL(api("surat", parse(params("status=READY_FOR_PICKUP"), "surat")), "https://example.test");
assert.equal(filtered.searchParams.get("status"), "READY_FOR_PICKUP");
assert.equal(filtered.searchParams.has("statuses[]"), false);
for (const from of ["permohonan", "persetujuan", "surat"]) {
  const filters = parse(params("q=Warga+Fiktif&jenis_surat=SKU&sort=terlama&page=2&status=APPROVED"), from);
  const href = new URL(detail("REQ-2026-000001", from, filters), "https://example.test");
  assert.equal(href.pathname, "/admin/permohonan/detail/");
  assert.equal(href.searchParams.get("id"), "REQ-2026-000001");
  assert.equal(href.searchParams.get("from"), from);
  assert.equal(list(section(href.searchParams.get("from")), parse(href.searchParams, from)), list(from, filters));
}
assert.equal(parse(params("status=APPROVED&jenis_surat=SKU"), "antrean-rt").status, "SUBMITTED");
assert.equal(parse(params("status=APPROVED&jenis_surat=SKU"), "antrean-rt").jenis_surat, "");
assert.equal(parse(params("status=APPROVED"), "antrean-rw").status, "RT_APPROVED");
const all = parse(params("view=all&status=SUBMITTED"), "antrean-rw");
assert.equal(all.status, "SUBMITTED");
assert.equal(new URL(api("antrean-rw", all), "https://example.test").searchParams.has("view"), false);
assert.equal(new URL(list("antrean-rw", all), "https://example.test").searchParams.get("view"), "all");
const safe = list("permohonan", parse(params("nik=0000000000000001&token=secret&returnTo=https://example.test/&alamat=Fiktif")));
assert.equal(safe, "/admin/permohonan/?sort=terbaru&page=1");
for (const from of ["permohonan", "antrean-rt", "antrean-rw"]) {
  for (const query of ["my_queue=1", "today=1", "status=WAITING_APPROVAL", "status=READY_FOR_PICKUP", "my_queue=1&today=1&sort=terlama&page=2"]) {
    const filters = parse(params(`view=all&${query}`), from);
    const href = new URL(detail("REQ-2026-FICTITIOUS", from, filters), "https://example.test");
    assert.equal(list(from, parse(href.searchParams, from)), list(from, filters));
    const backend = new URL(api(from, filters), "https://example.test");
    for (const [key, value] of params(query)) assert.equal(backend.searchParams.get(key), value);
  }
}
assert.equal(parse(params("my_queue=true&today=garbage")).my_queue, undefined);
assert.equal(parse(params("my_queue=true&today=garbage")).today, undefined);
console.log("PASS: admin query validation, fixed queues, search limit, safe navigation, pagination, summary filters and detail round-trip.");
