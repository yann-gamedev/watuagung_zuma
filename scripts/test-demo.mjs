import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the actual source in memory; no generated test files or new dependencies.
const modules = new Map();
async function source(path) {
  if (modules.has(path)) return modules.get(path);
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code.replaceAll('"zod"', JSON.stringify(import.meta.resolve("zod")));
  if (code.includes('"@/types/pelayanan"')) {
    const types = ts.transpileModule(readFileSync("types/pelayanan.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText;
    code = code.replaceAll('"@/types/pelayanan"', JSON.stringify(`data:text/javascript;base64,${Buffer.from(types).toString("base64")}`));
  }
  const loaded = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  modules.set(path, loaded);
  return loaded;
}
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000/api/v1";
globalThis.fetch = () => { throw new Error("Demo must not call fetch"); };
let stored = "[]";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: () => stored,
  setItem: (_key, value) => { stored = value; },
} });
const { pelayananService, isDemo, apiBase, apiRequest } = await source("services/pelayanan.ts");
assert.equal(isDemo, true);
assert.equal(apiBase, undefined);
await assert.rejects(apiRequest("/staff/login"), /simulasi/);
const { submissionSchema } = await source("lib/validation.ts");
const { dummyResidents, findDummyResident } = await source("lib/dummy-residents.ts");
for (const resident of dummyResidents) assert.deepEqual(findDummyResident(resident.nik), resident);
for (const nik of ["", "123", "0000000000000009", "abcdefghijklmnop"]) assert.ok(!findDummyResident(nik));
const valid = { jenis_surat: "DOMISILI", ...dummyResidents[0], no_kk: "0000000000000001", jenis_kelamin: "Laki-laki", alamat: "Alamat contoh", rt: "01", rw: "02", telepon: "081234567890", keperluan: "Simulasi surat" };
assert.equal(submissionSchema.safeParse(valid).success, true);
for (const tanggal_lahir of ["2000-02-31", "2001-02-29", "2026-04-31", "1899-12-31", "2999-01-01", "invalid"])
  assert.equal(submissionSchema.safeParse({ ...valid, tanggal_lahir }).success, false, tanggal_lahir);
assert.equal(submissionSchema.safeParse({ ...valid, tanggal_lahir: "2000-02-29" }).success, true);
assert.equal(submissionSchema.safeParse({ ...valid, jenis_surat: "SKU" }).success, false);
for (const jenis_surat of ["SKU", "DOMISILI", "SKTM", "KTP_KK"]) {
  const data = { ...valid, jenis_surat, nama_usaha: "Contoh usaha", jenis_usaha: "Perdagangan", alamat_usaha: "Alamat contoh" };
  assert.equal(submissionSchema.safeParse(data).success, true);
  const receipt = await pelayananService.submit(data);
  assert.deepEqual(await pelayananService.getStatus(receipt.request_id), receipt);
  assert.ok(!stored.includes(data.nama), "Do not persist identity");
}
for (const corrupt of ["{}", "null", "not json", '[{"status":"BAD"}]']) {
  stored = corrupt;
  assert.equal((await pelayananService.getStatus("REQ-2026-000001")).status, "PROCESSING");
  await pelayananService.submit(valid);
  assert.equal(JSON.parse(stored).length, 1);
}
for (const [suffix, status] of [["000002", "NEED_REVISION"], ["000003", "APPROVED"], ["000004", "REJECTED"]])
  assert.equal((await pelayananService.getStatus(`REQ-2026-${suffix}`)).status, status);
await assert.rejects(pelayananService.getStatus("REQ-2026-UNKNOWN"), /tidak ditemukan/);
localStorage.setItem = () => { throw new Error("Storage blocked"); };
await assert.rejects(pelayananService.submit(valid), /Penyimpanan simulasi tidak tersedia/);
console.log("PASS: demo isolation, autofill fixtures, four services, calendar validation, status lookup, corrupted/blocked storage, identity privacy.");
