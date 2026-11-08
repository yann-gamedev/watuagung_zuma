import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the actual source in memory; no generated test files or new dependencies.
const modules = new Map();
function sourceUrl(path) {
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code.replaceAll('"zod"', JSON.stringify(import.meta.resolve("zod")));
  code = code.replace(/"@\/([^"\n]+)"/g, (_match, dependency) => JSON.stringify(sourceUrl(`${dependency}.ts`)));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${process.env.NEXT_PUBLIC_DEMO_MODE}`;
}
async function source(path) {
  if (modules.has(path)) return modules.get(path);
  const loaded = await import(sourceUrl(path));
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
const { submissionSchema, todayInJakarta } = await source("lib/validation.ts");
const { offeredServiceCodes, dusunOptions, agamaOptions, kewarganegaraanOptions, statusPerkawinanOptions, pendidikanOptions } = await source("types/pelayanan.ts");
const { services } = await source("lib/data.ts");
assert.deepEqual(services.map((service) => service.code).sort(), [...offeredServiceCodes].sort());
for (const service of services) {
  assert.deepEqual(service.requirements, ["Bawa KTP dan KK asli saat mengambil surat."]);
  assert.ok(service.description && service.example);
}
for (const file of ["components/service-list.tsx", "components/site.tsx", "app/page.tsx"]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /\/pelayanan\/(?:sku|ktp-kk)(?:[\/"'`])/);
}
const { dummyResidents, findDummyResident } = await source("lib/dummy-residents.ts");
for (const resident of dummyResidents) assert.deepEqual(findDummyResident(resident.nik), resident);
for (const nik of ["", "123", "0000000000000009", "abcdefghijklmnop"]) assert.ok(!findDummyResident(nik));
const valid = { jenis_surat: "DOMISILI", ...dummyResidents[0], no_kk: "0000000000000001", jenis_kelamin: "Laki-laki", dusun: "Talang", alamat: "Alamat contoh", rt: "01", rw: "02", telepon: "081234567890", kewarganegaraan: "WNI", agama: "Islam", status_perkawinan: "Belum Kawin", pendidikan: "SLTA/Sederajat", pekerjaan: "Pekerjaan fiktif", keperluan: "Simulasi surat" };
const today = todayInJakarta();
const addDays = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
assert.equal(todayInJakarta(new Date("2026-12-31T16:59:59Z")), "2026-12-31");
assert.equal(todayInJakarta(new Date("2026-12-31T17:00:00Z")), "2027-01-01");
const specific = {
  KERAMAIAN: { acara: "Acara fiktif", tempat_acara: "Tempat contoh", tanggal_mulai: today, tanggal_selesai: today, jenis_hiburan: "Hiburan contoh" },
  KEHILANGAN: { barang_hilang: "Dokumen contoh" },
  UMUM: { isi_keterangan: "Keterangan fiktif untuk simulasi" },
};
const payloads = offeredServiceCodes.map((jenis_surat) => {
  const data = { ...valid, jenis_surat, ...specific[jenis_surat] };
  if (jenis_surat === "KERAMAIAN") for (const field of ["agama", "status_perkawinan", "pendidikan", "pekerjaan"]) delete data[field];
  return data;
});
async function rejected(data, field, message) {
  const parsed = submissionSchema.safeParse(data);
  assert.equal(parsed.success, false, `${data.jenis_surat}: ${field}`);
  assert.ok(parsed.error.issues.some((issue) => issue.path[0] === field && (!message || issue.message === message)), JSON.stringify(parsed.error.issues));
  const before = stored;
  await assert.rejects(pelayananService.submit(data), message ? (error) => error.message.includes(message) : undefined);
  assert.equal(stored, before, "Invalid submission must not create receipt");
}
const commonRequired = ["jenis_surat", "nama", "nik", "no_kk", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "dusun", "alamat", "rt", "rw", "telepon", "keperluan"];
const foreign = { nama_usaha: "Usaha contoh", jenis_usaha: "Jenis contoh", alamat_usaha: "Alamat usaha contoh", ...specific.KERAMAIAN, ...specific.KEHILANGAN, ...specific.UMUM };
for (const data of payloads) {
  assert.equal(submissionSchema.safeParse(data).success, true, data.jenis_surat);
  const required = [...commonRequired, ...Object.keys(specific[data.jenis_surat] || {}), ...(data.jenis_surat === "KERAMAIAN" ? [] : ["agama", "status_perkawinan", "pendidikan", "pekerjaan"])];
  for (const field of required) {
    const missing = { ...data };
    delete missing[field];
    await rejected(missing, field);
    await rejected({ ...data, [field]: "" }, field);
  }
  for (const [field, value] of Object.entries(foreign)) {
    if (!(field in (specific[data.jenis_surat] || {}))) await rejected({ ...data, [field]: value }, field);
  }
  const receipt = await pelayananService.submit(data);
  assert.deepEqual(await pelayananService.getStatus(receipt.request_id), receipt);
  assert.equal(receipt.jenis_surat, data.jenis_surat);
  assert.equal(receipt.requires_neighborhood_approval, false);
  assert.deepEqual(Object.keys(JSON.parse(stored).at(-1)).sort(), ["jenis_surat", "request_id", "requires_neighborhood_approval", "status", "success"]);
  for (const field of Object.keys(data).filter((field) => field !== "jenis_surat")) assert.ok(!Object.hasOwn(JSON.parse(stored).at(-1), field), `Do not persist ${field}`);
  assert.ok(!stored.includes(data.nama), "Do not persist identity");
}
for (const jenis_surat of ["SKU", "KTP_KK", "INVALID"]) await rejected({ ...valid, jenis_surat }, "jenis_surat", "Jenis surat ini tidak dapat diajukan secara online.");
for (const [field, options] of Object.entries({ dusun: dusunOptions, agama: agamaOptions, kewarganegaraan: kewarganegaraanOptions, status_perkawinan: statusPerkawinanOptions, pendidikan: pendidikanOptions, jenis_kelamin: ["Laki-laki", "Perempuan"] })) {
  for (const value of options) assert.equal(submissionSchema.safeParse({ ...valid, [field]: value }).success, true, `${field}: ${value}`);
  await rejected({ ...valid, [field]: "INVALID" }, field);
}
assert.equal(submissionSchema.safeParse({ ...valid, kewarganegaraan: undefined }).success, true, "API defaults citizenship to WNI");
const event = payloads.find((data) => data.jenis_surat === "KERAMAIAN");
for (const field of ["agama", "status_perkawinan", "pendidikan", "pekerjaan"]) {
  assert.equal(submissionSchema.safeParse({ ...event, [field]: valid[field] }).success, true, "Event accepts optional personal data");
  await rejected({ ...event, [field]: field === "pekerjaan" ? "x" : "INVALID" }, field);
}
for (const data of payloads) {
  for (const [field, max] of Object.entries({ nama: 200, tempat_lahir: 200, alamat: 200, keperluan: 200, ...(data.jenis_surat !== "KERAMAIAN" && { pekerjaan: 60 }), ...Object.fromEntries(Object.keys(specific[data.jenis_surat] || {}).filter((field) => !field.startsWith("tanggal_")).map((field) => [field, field === "isi_keterangan" ? 500 : field === "barang_hilang" ? 200 : 120])) })) {
    assert.equal(submissionSchema.safeParse({ ...data, [field]: "x".repeat(max) }).success, true, `${field}: max`);
    await rejected({ ...data, [field]: "x" }, field);
    await rejected({ ...data, [field]: "x".repeat(max + 1) }, field);
    await rejected({ ...data, [field]: "  " }, field);
  }
}
for (const [field, values] of Object.entries({ nik: ["123", "abcdefghijklmnop", "０".repeat(16)], no_kk: ["0".repeat(15), "0".repeat(17)], rt: ["0000", "abc"], rw: ["", "1a"], telepon: ["1234567890", "08123456", "+6212345678901234"] }))
  for (const value of values) await rejected({ ...valid, [field]: value }, field);
for (const telepon of ["012345678", "01234567890123", "+6212345678", "+621234567890123"]) assert.equal(submissionSchema.safeParse({ ...valid, telepon }).success, true);
for (const tanggal_lahir of ["2000-02-31", "2001-02-29", "2026-04-31", "1899-12-31", addDays(today, 1), "invalid", "2026-1-01", "2000-02-29T00:00:00Z"])
  await rejected({ ...valid, tanggal_lahir }, "tanggal_lahir");
for (const tanggal_lahir of ["1900-01-01", "2000-02-29", today]) assert.equal(submissionSchema.safeParse({ ...valid, tanggal_lahir }).success, true);
for (let days = 0; days < 7; days++) assert.equal(submissionSchema.safeParse({ ...event, tanggal_selesai: addDays(today, days) }).success, true, "1..7 inclusive event days");
await rejected({ ...event, tanggal_selesai: addDays(today, 7) }, "tanggal_selesai", "Izin keramaian paling lama 7 hari.");
await rejected({ ...event, tanggal_mulai: addDays(today, -1) }, "tanggal_mulai", "Tanggal mulai tidak boleh sebelum hari ini.");
await rejected({ ...event, tanggal_selesai: addDays(today, -1) }, "tanggal_selesai", "Tanggal selesai tidak boleh sebelum tanggal mulai.");
for (const date of ["2026-02-29", "2028-02-30", "2026-04-31", "not a date", "2026-1-01"]) {
  await rejected({ ...event, tanggal_mulai: date }, "tanggal_mulai");
  await rejected({ ...event, tanggal_selesai: date }, "tanggal_selesai");
}
for (const [tanggal_mulai, tanggal_selesai] of [["2096-02-29", "2096-03-06"], ["2099-12-29", "2100-01-04"]])
  assert.equal(submissionSchema.safeParse({ ...event, tanggal_mulai, tanggal_selesai }).success, true, "Leap/year rollover within seven days");
// UTC still December 31; birth/event cutoffs must already use January 1 in Jakarta.
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : ["2026-12-31T17:00:00Z"])); }
};
try {
  assert.equal(submissionSchema.safeParse({ ...valid, tanggal_lahir: "2027-01-01" }).success, true);
  await rejected({ ...valid, tanggal_lahir: "2027-01-02" }, "tanggal_lahir", "Tanggal lahir tidak boleh melewati hari ini.");
  assert.equal(submissionSchema.safeParse({ ...event, tanggal_mulai: "2027-01-01", tanggal_selesai: "2027-01-07" }).success, true);
  await rejected({ ...event, tanggal_mulai: "2026-12-31", tanggal_selesai: "2027-01-01" }, "tanggal_mulai", "Tanggal mulai tidak boleh sebelum hari ini.");
} finally { globalThis.Date = RealDate; }
const legacyReceipt = { success: true, request_id: "REQ-2026-PRIVACY", status: "SUBMITTED" };
stored = JSON.stringify([{ ...legacyReceipt, ...valid }]);
assert.deepEqual(await pelayananService.getStatus(legacyReceipt.request_id), { ...legacyReceipt, jenis_surat: valid.jenis_surat });
await pelayananService.submit(valid);
for (const receipt of JSON.parse(stored)) {
  for (const field of Object.keys(valid).filter((field) => field !== "jenis_surat")) assert.ok(!Object.hasOwn(receipt, field), `Strip legacy ${field}`);
}
for (const corrupt of ["{}", "null", "not json", '[{"status":"BAD"}]']) {
  stored = corrupt;
  assert.equal((await pelayananService.getStatus("REQ-2026-000001")).status, "PROCESSING");
  await pelayananService.submit(valid);
  assert.equal(JSON.parse(stored).length, 1);
}
for (const [suffix, status] of [["000002", "NEED_REVISION"], ["000003", "APPROVED"], ["000004", "REJECTED"], ["000005", "READY_FOR_PICKUP"], ["000006", "COMPLETED"], ["000007", "SUBMITTED"], ["000008", "VERIFIED"]])
  assert.equal((await pelayananService.getStatus(`REQ-2026-${suffix}`)).status, status);
for (const status of ["READY_FOR_PICKUP", "COMPLETED", "RT_APPROVED", "RW_APPROVED"]) {
  const receipt = { success: true, request_id: "REQ-2026-PICKUPTEST", status };
  stored = JSON.stringify([receipt]);
  assert.deepEqual(await pelayananService.getStatus(receipt.request_id), receipt);
  assert.deepEqual(await pelayananService.getStatus(receipt.request_id), receipt, "Status must not advance automatically");
  assert.deepEqual(JSON.parse(stored), [receipt], "Lookup must not alter storage");
}
await assert.rejects(pelayananService.getStatus("REQ-2026-UNKNOWN"), /tidak ditemukan/);
localStorage.setItem = () => { throw new Error("Storage blocked"); };
await assert.rejects(pelayananService.submit(valid), /Penyimpanan simulasi tidak tersedia/);
const { letterSteps } = await source("lib/letter-workflow.ts");
assert.deepEqual(letterSteps().map(([status]) => status), ["SUBMITTED", "VERIFIED", "PROCESSING", "WAITING_APPROVAL", "APPROVED", "READY_FOR_PICKUP", "COMPLETED"]);
assert.deepEqual(letterSteps(true).map(([status]) => status), ["SUBMITTED", "RT_APPROVED", "RW_APPROVED", ...letterSteps().slice(1).map(([status]) => status)]);
const form = readFileSync("features/pelayanan/application-form.tsx", "utf8");
assert.doesNotMatch(form, /dummy-residents|dummyPreview|autofill/);
for (const field of ["rt", "rw"]) assert.ok(form.includes(`field("${field}"`), "Keep address territory fields");
assert.equal((await pelayananService.getStatus("REQ-2026-000007")).jenis_surat, "SKTM");
assert.equal((await pelayananService.getStatus("REQ-2026-000008")).jenis_surat, "DOMISILI");
const { parseComplaintFormUrl } = await source("lib/complaint.ts");
for (const url of ["https://forms.gle/Abc123", " https://docs.google.com/forms/d/e/x/viewform "])
  assert.equal(parseComplaintFormUrl(url), url.trim());
for (const url of [undefined, "", "https://forms.gle/", "http://forms.gle/Abc", "https://forms.gle.evil.com/x", "https://docs.google.com/document/d/x", "javascript:alert(1)", "https://evil.com/?https://forms.gle/x"])
  assert.equal(parseComplaintFormUrl(url), "", String(url));
process.env.NEXT_PUBLIC_DEMO_MODE = "false";
modules.delete("services/pelayanan.ts");
const apiService = (await source("services/pelayanan.ts")).pelayananService;
let apiReceipt = { success: true, request_id: "REQ-2026-APITEST", status: "SUBMITTED", jenis_surat: "SKTM", requires_neighborhood_approval: true, lookup_secret: "test-only" };
globalThis.fetch = async () => ({ ok: true, json: async () => apiReceipt });
assert.equal((await apiService.submit(valid)).requires_neighborhood_approval, true);
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).requires_neighborhood_approval, true);
apiReceipt = { ...apiReceipt, requires_neighborhood_approval: false };
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).requires_neighborhood_approval, false);
delete apiReceipt.requires_neighborhood_approval;
await assert.rejects(apiService.submit(valid), /requires_neighborhood_approval/);
await assert.rejects(apiService.getStatus(apiReceipt.request_id, "test-only"), /requires_neighborhood_approval/);
execFileSync(process.execPath, ["scripts/test-public-news.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-public-businesses.mjs"], { stdio: "inherit" });
console.log("PASS: demo/API isolation, six final payloads, per-type required/prohibited fields, enums and text limits, retired types rejected, valid calendar dates and Jakarta midnight, 1..7 inclusive event days, storage privacy/legacy sanitization, server workflow metadata, removed autofill, complaint URL, public news, public UMKM.");
