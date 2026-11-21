import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// E4: klien persetujuan email & verifikasi email (services/approval.ts). Sumber asli dikompilasi di memori,
// tanpa dependensi baru. Pola sama dengan scripts/test-demo.mjs.
function sourceUrl(path, mode) {
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  code = code.replaceAll('"zod"', JSON.stringify(import.meta.resolve("zod")));
  code = code.replace(/"@\/([^"\n]+)"/g, (_match, dependency) => JSON.stringify(sourceUrl(`${dependency}.ts`, mode)));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${mode}`;
}
const load = (mode) => import(sourceUrl("services/approval.ts", mode));

// Demo: tidak pernah memanggil API.
process.env.NEXT_PUBLIC_DEMO_MODE = "true";
process.env.NEXT_PUBLIC_API_URL = "http://127.0.0.1:8000/api/v1";
globalThis.fetch = () => { throw new Error("Demo must not call fetch"); };
{
  const { approvalService, ApprovalError } = await load("demo");
  await assert.rejects(approvalService.preview("token-fiktif"), (error) => error instanceof ApprovalError && /simulasi/.test(error.message));
  await assert.rejects(approvalService.verifyEmail("?user=1"), ApprovalError);
}

process.env.NEXT_PUBLIC_DEMO_MODE = "false";
const { approvalService, ApprovalError } = await load("api");
const calls = [];
let reply;
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return reply();
};
const json = (status, body) => () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const token = "TokenFiktif-abc_123";
const preview = {
  request_id: "REQ-2026-FIKTIF", jenis_surat: "DOMISILI", jenis_surat_label: "Surat keterangan domisili", nama: "Warga Fiktif",
  submitted_at: "2026-11-20T03:00:00.000000Z", verified_by: "Petugas Fiktif", letter_number: "470/1/424.314.2.02/2026",
  head_name: "Kepala Desa Fiktif", expires_at: "2026-11-23T03:00:00.000000Z", pin_attempts_left: 5,
};

// Token hanya di body POST, tidak pernah di URL; tanpa referrer.
reply = json(200, preview);
assert.deepEqual(await approvalService.preview(token), preview);
assert.equal(calls[0].url, "http://127.0.0.1:8000/api/v1/approvals/preview");
assert.equal(calls[0].options.method, "POST");
assert.equal(calls[0].options.referrerPolicy, "no-referrer");
assert.equal(calls[0].options.cache, "no-store");
assert.deepEqual(JSON.parse(calls[0].options.body), { token });
assert.ok(!calls[0].url.includes(token));

// Status yang dibedakan halaman.
const gone = "Tautan sudah tidak berlaku. Buka panel admin untuk memutuskan permohonan ini.";
reply = json(410, { message: gone });
await assert.rejects(approvalService.preview(token), (error) => error instanceof ApprovalError && error.status === 410 && error.message === gone);
reply = json(423, { message: "PIN salah 5 kali. Tautan dikunci; putuskan permohonan ini lewat panel admin.", pin_attempts_left: 0 });
await assert.rejects(approvalService.decide({ token, pin: "000001", decision: "approve" }), (error) => error.status === 423 && error.attemptsLeft === 0);
reply = json(422, { message: "PIN salah. Sisa 3 percobaan.", errors: { pin: ["PIN salah. Sisa 3 percobaan."] }, pin_attempts_left: 3 });
await assert.rejects(approvalService.decide({ token, pin: "000001", decision: "approve" }), (error) => error.status === 422 && error.attemptsLeft === 3 && error.message === "PIN salah. Sisa 3 percobaan.");
reply = json(422, { message: "The note field is required.", errors: { note: ["Alasan penolakan wajib diisi."] } });
await assert.rejects(approvalService.decide({ token, pin: "482915", decision: "reject" }), (error) => error.status === 422 && error.attemptsLeft === undefined && error.message === "Alasan penolakan wajib diisi.");
reply = json(429, { message: "Too Many Attempts." });
await assert.rejects(approvalService.preview(token), (error) => error.status === 429 && /^Terlalu banyak percobaan/.test(error.message));
reply = () => { throw new TypeError("Failed to fetch"); };
await assert.rejects(approvalService.preview(token), (error) => error instanceof ApprovalError && error.status === 0 && /Server belum dapat dihubungi/.test(error.message));
reply = json(200, { ...preview, pin_attempts_left: "lima" });
await assert.rejects(approvalService.preview(token), (error) => error instanceof ApprovalError && /tidak dikenali/.test(error.message));

// Keputusan.
calls.length = 0;
reply = json(200, { success: true, request_id: "REQ-2026-FIKTIF", status: "APPROVED", letter_number: "470/1/424.314.2.02/2026", message: "Permohonan disetujui." });
const decided = await approvalService.decide({ token, pin: "482915", decision: "approve" });
assert.equal(decided.letter_number, "470/1/424.314.2.02/2026");
assert.deepEqual(JSON.parse(calls[0].options.body), { token, pin: "482915", decision: "approve" });

// Draf PDF sebagai blob; bukan PDF ditolak.
reply = () => new Response("%PDF-1.4 draf fiktif", { status: 200, headers: { "Content-Type": "application/pdf" } });
const blob = await approvalService.draft(token);
assert.equal(await blob.text(), "%PDF-1.4 draf fiktif");
reply = () => new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
await assert.rejects(approvalService.draft(token), /Draf surat tidak dapat dibaca/);

// Verifikasi email: query bertanda tangan diteruskan apa adanya.
calls.length = 0;
const query = "?user=7&email=abc&expires=1700000000&signature=def";
reply = json(200, { success: true, message: "Email notifikasi terverifikasi." });
assert.equal((await approvalService.verifyEmail(query)).message, "Email notifikasi terverifikasi.");
assert.equal(calls[0].url, `http://127.0.0.1:8000/api/v1/notifications/verify${query}`);
reply = json(403, { success: false, message: "Tautan verifikasi tidak valid atau sudah kedaluwarsa. Minta tautan baru dari panel." });
await assert.rejects(approvalService.verifyEmail(query), (error) => error.status === 403);

console.log("PASS: approval client — demo isolation, token only in POST body, no-referrer, 410/422/423/429/network mapping, PIN attempts, field errors, schema guard, PDF blob, signed verify query.");
