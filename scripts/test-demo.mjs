import assert from "node:assert/strict";
import { File } from "node:buffer";
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
globalThis.XMLHttpRequest = class { constructor() { throw new Error("Demo must not create XMLHttpRequest"); } };
const attachments = Object.fromEntries(["KTP", "KK", "PENGANTAR_RT_RW"].map((kind) => [kind, new File([`%PDF-1.4 fictional ${kind}`], `${kind}-contoh.pdf`, { type: "application/pdf" })]));
let stored = "[]";
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: () => stored,
  setItem: (_key, value) => { stored = value; },
} });
const { pelayananService, isDemo, apiBase, apiRequest, SubmissionValidationError } = await source("services/pelayanan.ts");
assert.equal(isDemo, true);
assert.equal(apiBase, undefined);
await assert.rejects(apiRequest("/staff/login"), /simulasi/);
const beforeDemoRevision = stored;
await assert.rejects(pelayananService.replaceAttachments("REQ-2026-000002", "test-only", { KTP: attachments.KTP }), /Penggantian lampiran.*simulasi/);
assert.equal(stored, beforeDemoRevision, "Demo revision must not change storage");
const { submissionSchema, todayInJakarta } = await source("lib/validation.ts");
const { offeredServiceCodes, dusunOptions, agamaOptions, kewarganegaraanOptions, statusPerkawinanOptions, pendidikanOptions } = await source("types/pelayanan.ts");
const { services } = await source("lib/data.ts");
assert.deepEqual(services.filter((service) => service.mode === "online").map((service) => service.code).sort(), [...offeredServiceCodes].sort());
assert.deepEqual(services.filter((service) => service.mode === "office").map((service) => service.code), ["KERAMAIAN"], "Crowd permit stays listed, served at the village hall");
for (const service of services) {
  assert.deepEqual(service.requirements, service.mode === "office" ? ["KTP", "Kartu Keluarga", "Surat Pengantar RT/RW asli"] : ["Scan KTP", "Scan Kartu Keluarga", "Scan Surat Pengantar RT/RW"]);
  assert.ok(service.description && service.example);
}
const servicePage = readFileSync("app/pelayanan/[service]/page.tsx", "utf8");
const officeBranch = servicePage.slice(servicePage.indexOf('item.mode === "office"'), servicePage.indexOf("<ApplicationForm"));
assert.match(officeBranch, /Dilayani langsung di Balai Desa/);
assert.match(officeBranch, /<HubungiPetugas \/>/);
assert.match(officeBranch, /<ContactAddress \/>[\s\S]*<ContactHours \/>/);
assert.doesNotMatch(officeBranch, /<(?:input|select|textarea|form)|ApplicationForm|FormField/, "Office service page has no input fields");
assert.match(readFileSync("components/service-list.tsx", "utf8"), /office \? "Datang ke Balai Desa" : "Ajukan online"/);
for (const file of ["components/service-list.tsx", "components/site.tsx", "app/page.tsx"]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /\/pelayanan\/(?:sku|ktp-kk)(?:[\/"'`])/);
}
const { dummyResidents, findDummyResident } = await source("lib/dummy-residents.ts");
for (const resident of dummyResidents) assert.deepEqual(findDummyResident(resident.nik), resident);
for (const nik of ["", "123", "0000000000000009", "abcdefghijklmnop"]) assert.ok(!findDummyResident(nik));
const valid = { jenis_surat: "DOMISILI", ...dummyResidents[0], no_kk: "0000000000000001", jenis_kelamin: "Laki-laki", dusun: "Talang", alamat: "Alamat contoh", rt: "01", rw: "02", telepon: "081234567890", kewarganegaraan: "WNI", agama: "Islam", status_perkawinan: "Belum Kawin", pendidikan: "SLTA/Sederajat", pekerjaan: "Pekerjaan fiktif", keperluan: "Simulasi surat" };
for (const kind of Object.keys(attachments)) {
  for (const file of [undefined, "not a file", new Blob([])]) {
    const before = stored;
    await assert.rejects(pelayananService.submit(valid, { ...attachments, [kind]: file }), (error) => error instanceof SubmissionValidationError && error.errors[`lampiran.${kind}`]?.length === 1);
    assert.equal(stored, before, "Missing attachment must not create receipt");
  }
}
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
const { maskApplicantEmail } = await source("lib/applicant-email.ts");
for (const [email, masked] of [["email@example.test", "e•••@example.test"], ['"a@b"@example.test', '"•••@example.test'], ["ü@例子.广告", "ü•••@例子.广告"]]) assert.equal(maskApplicantEmail(email), masked);
for (const email of ["", "  "]) assert.equal(submissionSchema.safeParse({ ...valid, email, email_consent: false }).success, true);
for (const email of ["e@example.test", '"a b"@example.test', "ü@例子.广告", "a@localhost", `${"a".repeat(107)}@example.test`]) {
  assert.equal(submissionSchema.safeParse({ ...valid, email, email_consent: true }).success, true);
  await rejected({ ...valid, email, email_consent: false }, "email_consent");
  await rejected({ ...valid, email }, "email_consent");
}
for (const email of ["bukan-email", "@example.test", "a@", "a\r\n@example.test", `${"a".repeat(108)}@example.test`]) await rejected({ ...valid, email, email_consent: true }, "email");
await pelayananService.submit({ ...valid, email: "fictional@example.test", email_consent: true }, attachments);
assert.ok(!stored.includes("fictional@example.test") && !stored.includes("email_consent"), "Demo never stores email or consent");
await assert.rejects(pelayananService.unsubscribeEmail("?id=test&signature=test"), /simulasi/);
const commonRequired = ["jenis_surat", "nama", "nik", "no_kk", "tempat_lahir", "tanggal_lahir", "jenis_kelamin", "dusun", "alamat", "rt", "rw", "telepon", "keperluan"];
const foreign = { nama_usaha: "Usaha contoh", jenis_usaha: "Jenis contoh", alamat_usaha: "Alamat usaha contoh", ...specific.KERAMAIAN, ...specific.KEHILANGAN, ...specific.UMUM };
for (const data of payloads) {
  assert.equal(submissionSchema.safeParse(data).success, true, data.jenis_surat);
  const required = [...commonRequired, ...Object.keys(specific[data.jenis_surat] || {}), "agama", "status_perkawinan", "pendidikan", "pekerjaan"];
  for (const field of required) {
    const missing = { ...data };
    delete missing[field];
    await rejected(missing, field);
    await rejected({ ...data, [field]: "" }, field);
  }
  for (const [field, value] of Object.entries(foreign)) {
    if (!(field in (specific[data.jenis_surat] || {}))) await rejected({ ...data, [field]: value }, field);
  }
  const progress = [];
  const receipt = await pelayananService.submit(data, attachments, (percent) => progress.push(percent));
  assert.deepEqual(progress, [0, 50, 100]);
  assert.equal(receipt.lampiran, undefined);
  assert.ok(!stored.includes("lampiran") && !stored.includes("%PDF") && !stored.includes("contoh.pdf"), "Do not persist attachments or file data");
  assert.deepEqual(await pelayananService.getStatus(receipt.request_id), receipt);
  assert.equal(receipt.jenis_surat, data.jenis_surat);
  assert.equal(receipt.requires_neighborhood_approval, false);
  assert.deepEqual(Object.keys(JSON.parse(stored).at(-1)).sort(), ["jenis_surat", "request_id", "requires_neighborhood_approval", "status", "success"]);
  for (const field of Object.keys(data).filter((field) => field !== "jenis_surat")) assert.ok(!Object.hasOwn(JSON.parse(stored).at(-1), field), `Do not persist ${field}`);
  assert.ok(!stored.includes(data.nama), "Do not persist identity");
}
for (const jenis_surat of ["SKU", "KTP_KK", "INVALID"]) await rejected({ ...valid, jenis_surat }, "jenis_surat", "Jenis surat ini tidak dapat diajukan secara online.");
// Izin keramaian dilayani di Balai Desa: demo menolak dengan pesan yang sama dengan API (422).
for (const data of [{ ...valid, jenis_surat: "KERAMAIAN" }, { ...valid, jenis_surat: "KERAMAIAN", ...specific.KERAMAIAN }])
  await rejected(data, "jenis_surat", "Izin Keramaian dilayani langsung di Balai Desa.");
for (const [field, options] of Object.entries({ dusun: dusunOptions, agama: agamaOptions, kewarganegaraan: kewarganegaraanOptions, status_perkawinan: statusPerkawinanOptions, pendidikan: pendidikanOptions, jenis_kelamin: ["Laki-laki", "Perempuan"] })) {
  for (const value of options) assert.equal(submissionSchema.safeParse({ ...valid, [field]: value }).success, true, `${field}: ${value}`);
  await rejected({ ...valid, [field]: "INVALID" }, field);
}
assert.equal(submissionSchema.safeParse({ ...valid, kewarganegaraan: undefined }).success, true, "API defaults citizenship to WNI");
for (const data of payloads) {
  for (const [field, max] of Object.entries({ nama: 200, tempat_lahir: 200, alamat: 200, keperluan: 200, pekerjaan: 60, ...Object.fromEntries(Object.keys(specific[data.jenis_surat] || {}).filter((field) => !field.startsWith("tanggal_")).map((field) => [field, field === "isi_keterangan" ? 500 : field === "barang_hilang" ? 200 : 120])) })) {
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
// UTC still December 31; birth date cutoff must already use January 1 in Jakarta.
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : ["2026-12-31T17:00:00Z"])); }
};
try {
  assert.equal(submissionSchema.safeParse({ ...valid, tanggal_lahir: "2027-01-01" }).success, true);
  await rejected({ ...valid, tanggal_lahir: "2027-01-02" }, "tanggal_lahir", "Tanggal lahir tidak boleh melewati hari ini.");
} finally { globalThis.Date = RealDate; }
const legacyReceipt = { success: true, request_id: "REQ-2026-PRIVACY", status: "SUBMITTED" };
stored = JSON.stringify([{ ...legacyReceipt, ...valid, lampiran: ["KTP"], files: attachments }]);
assert.deepEqual(await pelayananService.getStatus(legacyReceipt.request_id), { ...legacyReceipt, jenis_surat: valid.jenis_surat });
await pelayananService.submit(valid, attachments);
for (const receipt of JSON.parse(stored)) {
  assert.equal(receipt.lampiran, undefined, "Strip legacy attachment metadata");
  assert.equal(receipt.files, undefined, "Strip legacy file objects");
  for (const field of Object.keys(valid).filter((field) => field !== "jenis_surat")) assert.ok(!Object.hasOwn(receipt, field), `Strip legacy ${field}`);
}
for (const corrupt of ["{}", "null", "not json", '[{"status":"BAD"}]']) {
  stored = corrupt;
  assert.equal((await pelayananService.getStatus("REQ-2026-000001")).status, "PROCESSING");
  await pelayananService.submit(valid, attachments);
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
await assert.rejects(pelayananService.submit(valid, attachments), /Penyimpanan simulasi tidak tersedia/);
const { letterSteps, timelineStatus, isCitizenFinal } = await source("lib/letter-workflow.ts");
// Bagi warga alur selesai saat Kepala Desa menyetujui: tahap terakhir = disetujui; APPROVED/COMPLETED dipetakan ke sana.
assert.deepEqual(letterSteps().map(([status]) => status), ["SUBMITTED", "VERIFIED", "PROCESSING", "WAITING_APPROVAL", "READY_FOR_PICKUP"]);
assert.equal(timelineStatus("APPROVED"), "READY_FOR_PICKUP");
assert.equal(timelineStatus("COMPLETED"), "READY_FOR_PICKUP");
assert.equal(timelineStatus("PROCESSING"), "PROCESSING");
assert.equal(timelineStatus("REJECTED"), "REJECTED");
assert.equal(letterSteps().find(([code]) => code === "READY_FOR_PICKUP")[2], "Surat sudah bisa diunduh dan dicetak. Berlaku sampai {tanggal}.");
assert.deepEqual(letterSteps(true).map(([status]) => status), ["SUBMITTED", "RT_APPROVED", "RW_APPROVED", ...letterSteps().slice(1).map(([status]) => status)]);
assert.equal(letterSteps().find(([code]) => code === "READY_FOR_PICKUP")[1], "Selesai — disetujui Kepala Desa");
// Badge warga (StatusBadge citizen): semua status pasca-persetujuan berlabel Selesai; panel tetap label server.
assert.deepEqual(["APPROVED", "READY_FOR_PICKUP", "COMPLETED", "WAITING_APPROVAL", "REJECTED", "NEED_REVISION"].map(isCitizenFinal), [true, true, true, false, false, false]);
const beforeDownload = stored;
assert.equal((await pelayananService.getStatus("REQ-2026-000005")).letter_available, true);
const demoPdf = await pelayananService.downloadLetter("REQ-2026-000005");
assert.equal(demoPdf.type, "application/pdf");
assert.match(await demoPdf.text(), /SIMULASI - BUKAN SURAT RESMI/);
assert.equal((await pelayananService.getStatus("REQ-2026-000005")).status, "COMPLETED");
assert.equal((await pelayananService.getStatus("REQ-2026-000005")).letter_available, true);
assert.equal((await pelayananService.downloadLetter("REQ-2026-000005")).size, demoPdf.size, "Repeat download allowed");
await assert.rejects(pelayananService.downloadLetter("REQ-2026-000003"), /belum tersedia/);
assert.equal(stored, beforeDownload, "Demo PDF and completion remain in memory, no private data stored");
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
const { pelayananService: apiService, SubmissionValidationError: ApiSubmissionValidationError } = await source("services/pelayanan.ts");
let apiReceipt = { success: true, request_id: "REQ-2026-APITEST", status: "SUBMITTED", jenis_surat: "SKTM", requires_neighborhood_approval: true, lookup_secret: "test-only", lampiran: Object.keys(attachments), letter_available: false, letter_available_until: null, valid_until: null };
let outcome = { status: 201 };
const xhrs = [];
let xhrCount = 0;
globalThis.XMLHttpRequest = class {
  constructor() { this.upload = {}; this.headers = {}; xhrs.push(this); xhrCount++; }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(body) {
    this.body = body;
    queueMicrotask(() => {
      if (outcome.event) return this[`on${outcome.event}`]();
      this.upload.onprogress({ lengthComputable: true, loaded: 1, total: 4 });
      this.upload.onprogress({ lengthComputable: false, loaded: 2, total: 0 });
      this.upload.onprogress({ lengthComputable: true, loaded: 4, total: 4 });
      this.status = outcome.status;
      this.responseText = outcome.raw ?? JSON.stringify(outcome.body ?? apiReceipt);
      this.onload();
    });
  }
};
await apiService.submit({ ...valid, email: "fictional@example.test", email_consent: true }, attachments);
assert.equal(xhrs.at(-1).body.get("email"), "fictional@example.test");
assert.equal(xhrs.at(-1).body.get("email_consent"), "true");
let fetchCount = 0;
globalThis.fetch = async (_url, options) => {
  fetchCount++;
  assert.equal(options.headers["Content-Type"], "application/json", "Status keeps JSON transport");
  return { ok: true, json: async () => apiReceipt };
};
const apiProgress = [];
const storageBeforeApi = stored;
assert.equal((await apiService.submit({ ...valid, pekerjaan: undefined }, attachments, (percent) => apiProgress.push(percent))).requires_neighborhood_approval, true);
assert.deepEqual(apiProgress, [null, 25, null, 100, 100]);
assert.equal(fetchCount, 0, "Upload uses XHR, not fetch");
assert.equal(xhrs.at(-1).method, "POST");
assert.equal(xhrs.at(-1).url, "http://127.0.0.1:8000/api/v1/applications");
assert.equal(xhrs.at(-1).timeout, 120000);
assert.deepEqual(xhrs.at(-1).headers, { Accept: "application/json" }, "Browser supplies multipart boundary");
assert.ok(xhrs.at(-1).body instanceof FormData);
for (const [field, value] of Object.entries(valid)) {
  if (field === "pekerjaan") assert.equal(xhrs.at(-1).body.has(field), false, "Omit undefined fields");
  else assert.equal(xhrs.at(-1).body.get(field), String(value));
}
for (const [kind, file] of Object.entries(attachments)) {
  const uploaded = xhrs.at(-1).body.get(`lampiran[${kind}]`);
  assert.equal(uploaded.name, file.name);
  assert.equal(uploaded.type, file.type);
  assert.equal(await uploaded.text(), await file.text());
}
assert.equal([...xhrs.at(-1).body.keys()].length, Object.keys(valid).length - 1 + 3);
assert.equal(stored, storageBeforeApi, "API must not persist files or receipts");
const beforeMissing = xhrCount;
await assert.rejects(apiService.submit(valid, {}), (error) => error instanceof ApiSubmissionValidationError && Object.keys(error.errors).length === 3);
assert.equal(xhrCount, beforeMissing, "Missing files rejected before network");
await apiService.submit(valid, { ...attachments, KTP: new Blob(["%PDF-1.4 fictional blob"], { type: "application/pdf" }) });
assert.ok(xhrs.at(-1).body.get("lampiran[KTP]") instanceof Blob, "Blob input supported");
const beforeInvalidRevision = xhrCount;
for (const secret of ["", "   "]) await assert.rejects(apiService.replaceAttachments(apiReceipt.request_id, secret, { KTP: attachments.KTP }), /Masukkan kode akses/);
await assert.rejects(apiService.replaceAttachments(apiReceipt.request_id, "revision-test-only", {}), (error) => error instanceof ApiSubmissionValidationError && error.errors.lampiran?.[0] === "Pilih minimal satu lampiran yang akan diganti.");
for (const file of ["not a file", new Blob([])]) await assert.rejects(apiService.replaceAttachments(apiReceipt.request_id, "revision-test-only", { KTP: file }), (error) => error instanceof ApiSubmissionValidationError && error.errors["lampiran.KTP"]?.length === 1);
assert.equal(xhrCount, beforeInvalidRevision, "Invalid revision rejected before network");
const revisionReceipt = { success: true, request_id: apiReceipt.request_id, status: "NEED_REVISION", lampiran: Object.keys(attachments) };
outcome = { status: 200, body: revisionReceipt };
for (const selected of [{ KTP: attachments.KTP }, { KK: attachments.KK, PENGANTAR_RT_RW: attachments.PENGANTAR_RT_RW }]) {
  const progress = [];
  assert.deepEqual(await apiService.replaceAttachments(apiReceipt.request_id, "revision-test-only", selected, (percent) => progress.push(percent)), revisionReceipt, "Replacement keeps NEED_REVISION, without requiring submit/status-only fields");
  assert.deepEqual(progress, [null, 25, null, 100, 100]);
  const xhr = xhrs.at(-1);
  assert.equal(xhr.method, "POST");
  assert.equal(xhr.url, "http://127.0.0.1:8000/api/v1/applications/attachments");
  assert.ok(!xhr.url.includes("revision-test-only"), "Secret never enters URL");
  assert.equal(xhr.timeout, 120000);
  assert.deepEqual(xhr.headers, { Accept: "application/json" });
  assert.ok(xhr.body instanceof FormData);
  assert.equal(xhr.body.get("request_id"), apiReceipt.request_id);
  assert.equal(xhr.body.get("lookup_secret"), "revision-test-only");
  assert.deepEqual([...xhr.body.keys()], ["request_id", "lookup_secret", ...Object.keys(selected).map((kind) => `lampiran[${kind}]`)], "Only selected attachments and credentials sent");
  for (const [kind, file] of Object.entries(selected)) assert.equal(await xhr.body.get(`lampiran[${kind}]`).text(), await file.text());
}
assert.equal(fetchCount, 0, "Revision uses actual multipart service, not JSON fetch");
assert.equal(stored, storageBeforeApi, "Revision never stores secret or files");
const revisionErrors = { "lampiran.KTP": ["Foto KTP terlalu kecil."] };
outcome = { status: 422, body: { message: "Periksa lampiran.", errors: revisionErrors } };
await assert.rejects(apiService.replaceAttachments(apiReceipt.request_id, "revision-test-only", { KTP: attachments.KTP }), (error) => {
  assert.ok(error instanceof ApiSubmissionValidationError);
  assert.deepEqual(error.errors, revisionErrors);
  assert.equal(error.message, "Periksa lampiran.");
  return true;
});
outcome = { status: 422, body: { message: "Lampiran hanya dapat diganti saat permohonan berstatus perlu perbaikan." } };
await assert.rejects(apiService.replaceAttachments(apiReceipt.request_id, "revision-test-only", { KTP: attachments.KTP }), (error) => error instanceof ApiSubmissionValidationError && error.message === outcome.body.message);
for (const body of [{ ...revisionReceipt, status: "SUBMITTED" }, { ...revisionReceipt, lampiran: ["INVALID"] }, { ...revisionReceipt, lampiran: undefined }]) {
  outcome = { status: 200, body };
  await assert.rejects(apiService.replaceAttachments(apiReceipt.request_id, "revision-test-only", { KTP: attachments.KTP }), /status|lampiran/);
}
const serverErrors = { "lampiran.KTP": ["Foto KTP terlalu kecil."], "lampiran.KK": ["KK wajib dilampirkan."], nama: ["Nama wajib diisi."] };
outcome = { status: 422, body: { message: "Periksa isian.", errors: serverErrors } };
await assert.rejects(apiService.submit(valid, attachments), (error) => {
  assert.ok(error instanceof ApiSubmissionValidationError);
  assert.deepEqual(error.errors, serverErrors);
  assert.equal(error.message, "Periksa isian.");
  return true;
});
for (const response of [{ status: 422, body: { message: "Pengajuan tidak valid." } }, { status: 422, raw: "not JSON" }]) {
  outcome = response;
  await assert.rejects(apiService.submit(valid, attachments), (error) => error instanceof ApiSubmissionValidationError && Object.keys(error.errors).length === 0);
}
for (const [response, message] of [
  [{ event: "timeout" }, /Waktu unggah habis/],
  [{ event: "error" }, /Periksa koneksi internet/],
  [{ event: "abort" }, /Pengiriman dibatalkan/],
  [{ status: 413, raw: "<html>Too large</html>" }, /Ukuran lampiran terlalu besar/],
  [{ status: 500, body: { message: "Server sedang bermasalah." } }, /Server sedang bermasalah/],
  [{ status: 201, raw: "not JSON" }, /Respons layanan tidak dapat dibaca/],
]) {
  outcome = response;
  await assert.rejects(apiService.submit(valid, attachments), message);
}
outcome = { status: 201 };
assert.deepEqual((await apiService.getStatus(apiReceipt.request_id, "test-only")).lampiran, Object.keys(attachments));
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).requires_neighborhood_approval, true);
apiReceipt = { ...apiReceipt, requires_neighborhood_approval: false };
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).requires_neighborhood_approval, false);
for (const lampiran of [undefined, ["INVALID"], "KTP"]) {
  outcome = { status: 201, body: { ...apiReceipt, lampiran } };
  await assert.rejects(apiService.submit(valid, attachments), /lampiran/);
}
outcome = { status: 201 };
apiReceipt = { ...apiReceipt, lampiran: ["INVALID"] };
await assert.rejects(apiService.getStatus(apiReceipt.request_id, "test-only"), /lampiran/);
apiReceipt = { ...apiReceipt, lampiran: [] };
delete apiReceipt.requires_neighborhood_approval;
await assert.rejects(apiService.submit(valid, attachments), /requires_neighborhood_approval/);
await assert.rejects(apiService.getStatus(apiReceipt.request_id, "test-only"), /requires_neighborhood_approval/);
apiReceipt = { ...apiReceipt, requires_neighborhood_approval: false, letter_available: true, letter_available_until: "2026-12-19T13:00:00+07:00", valid_until: "2026-12-19T13:00:00+07:00" };
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).letter_available, true);
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).letter_available_until, apiReceipt.letter_available_until);
assert.equal((await apiService.getStatus(apiReceipt.request_id, "test-only")).valid_until, apiReceipt.valid_until);
const pdfBytes = new Blob(["%PDF-1.4 fictional signed scan"], { type: "application/pdf" });
let downloadOutcome = 200;
globalThis.fetch = async (url, options) => {
  assert.equal(url, "http://127.0.0.1:8000/api/v1/applications/letter");
  assert.equal(options.method, "POST");
  assert.equal(options.cache, "no-store");
  assert.deepEqual(JSON.parse(options.body), { request_id: apiReceipt.request_id, lookup_secret: "download-test-only" });
  assert.ok(!url.includes("download-test-only"));
  return downloadOutcome === 200
    ? new Response(pdfBytes, { headers: { "Content-Type": "application/pdf" } })
    : Response.json({ message: downloadOutcome === 410 ? "Masa unduh sudah berakhir." : "Gagal mengunduh." }, { status: downloadOutcome });
};
await assert.rejects(apiService.downloadLetter(apiReceipt.request_id, " "), /Masukkan kode akses/);
assert.equal(await (await apiService.downloadLetter(apiReceipt.request_id, "download-test-only")).text(), await pdfBytes.text());
assert.equal(await (await apiService.downloadLetter(apiReceipt.request_id, "download-test-only")).text(), await pdfBytes.text());
for (const code of [404, 410, 429, 500]) {
  downloadOutcome = code;
  await assert.rejects(apiService.downloadLetter(apiReceipt.request_id, "download-test-only"), code === 410 ? /Masa unduh/ : /Gagal mengunduh/);
}
assert.equal(stored, storageBeforeApi, "Download credentials and PDF never persisted");
const signedQuery = "?id=REQ-2026-FICTIONAL&signature=abc%2Bdef";
let unsubscribeStatus = 200;
let unsubscribeCalls = 0;
globalThis.fetch = async (url, options) => {
  unsubscribeCalls++;
  assert.equal(url, `http://127.0.0.1:8000/api/v1/applications/unsubscribe${signedQuery}`, "Preserve raw signed query");
  assert.equal(options.method, "POST");
  assert.equal(options.cache, "no-store");
  return Response.json(unsubscribeStatus === 200 ? { success: true, message: "Email dihentikan." } : { message: "Tautan tidak berlaku." }, { status: unsubscribeStatus });
};
for (const query of ["", "?id=x", "?signature=x"]) await assert.rejects(apiService.unsubscribeEmail(query), /Tautan tidak lengkap/);
assert.equal(unsubscribeCalls, 0);
for (let repeat = 0; repeat < 2; repeat++) assert.equal((await apiService.unsubscribeEmail(signedQuery)).success, true);
for (const code of [403, 404, 429, 500]) {
  unsubscribeStatus = code;
  await assert.rejects(apiService.unsubscribeEmail(signedQuery), /Tautan tidak berlaku/);
}
console.log("PASS: optional email precheck/120-character limit/consent, masking, demo no email network/storage, multipart consent, signed POST unsubscribe and errors.");
execFileSync(process.execPath, ["scripts/test-attachments.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-public-news.mjs"], { stdio: "inherit" });
execFileSync(process.execPath, ["scripts/test-public-businesses.mjs"], { stdio: "inherit" });
console.log("PASS: citizen POST/blob downloads, body-only secret, first/repeat demo PDF, availability/deadline parsing, 404/410/429/500 errors; demo/API isolation, three required attachments, native XHR multipart fields/files, revision subsets with body-only secret and unchanged NEED_REVISION, demo revision blocked, upload progress, structured 422, timeout/network/413 errors, validated attachment receipts, five online payloads, crowd permit office-only (no form, 422 message), per-type required/prohibited fields, enums and text limits, retired types rejected, valid calendar dates and Jakarta midnight, storage privacy/legacy sanitization without files, server workflow metadata, removed autofill, complaint URL, public news, public UMKM.");
