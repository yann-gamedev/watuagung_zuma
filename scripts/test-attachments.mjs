import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync("lib/attachments.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { prepareAttachment } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
let revoked = 0;
URL.createObjectURL = () => "blob:test-only";
URL.revokeObjectURL = () => revoked++;
let dimensions = [4032, 3024];
let outputSize = 120_000;
let broken = false;
globalThis.Image = class {
  naturalWidth = dimensions[0];
  naturalHeight = dimensions[1];
  set src(_value) { queueMicrotask(() => broken ? this.onerror() : this.onload()); }
};
const context = { fillStyle: "", fillRect() {}, drawImage() {} };
const canvas = {
  width: 0, height: 0, getContext: () => context,
  toBlob(callback, mime, quality) {
    assert.equal(mime, "image/jpeg");
    assert.equal(quality, 0.85);
    callback(new Blob([new Uint8Array(outputSize)], { type: mime }));
  },
};
globalThis.document = { createElement: (tag) => { assert.equal(tag, "canvas"); return canvas; } };
const photo = new File(["fake image; decoding stubbed"], "private-name.png", { type: "image/png" });
for (const [input, expected] of [ [[4032, 3024], [2000, 1500]], [[3024, 4032], [1500, 2000]], [[800, 600], [800, 600]] ]) {
  dimensions = input;
  const result = await prepareAttachment(photo);
  assert.equal(result.type, "image/jpeg");
  assert.equal(result.name, "foto.jpg");
  assert.equal(result.size, outputSize);
  assert.deepEqual([canvas.width, canvas.height], expected);
  assert.equal(context.fillStyle, "white");
}
let before = revoked;
dimensions = [800, 500];
await assert.rejects(prepareAttachment(photo), /terlalu kecil/);
assert.equal(revoked, before + 1);
dimensions = [2000, 1500];
outputSize = 1_500_000;
await assert.rejects(prepareAttachment(photo), /1,5 MB/);
outputSize = 100;
broken = true;
await assert.rejects(prepareAttachment(photo), /tidak dapat dibaca/);
broken = false;
before = revoked;
const pdf = new File(["%PDF-1.4\nfictitious test document"], "private-name.pdf", { type: "application/pdf" });
const result = await prepareAttachment(pdf);
assert.equal(result.name, "dokumen.pdf");
assert.equal(await result.text(), await pdf.text(), "PDF bytes unchanged");
assert.equal(revoked, before, "PDF bypasses canvas");
await assert.rejects(prepareAttachment(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" })), /Maksimal 5 MB/);
await assert.rejects(prepareAttachment(new File(["invalid"], "bad.pdf", { type: "application/pdf" })), /PDF tidak dapat dibaca/);
await assert.rejects(prepareAttachment(new File(["text"], "bad.txt", { type: "text/plain" })), /Pilih gambar atau PDF/);
const page = readFileSync("app/pelayanan/[service]/page.tsx", "utf8");
assert.ok(page.indexOf('className="service-preparation"') < page.indexOf("<ApplicationForm"));
assert.doesNotMatch(page, /Gunakan data fiktif saat mencoba formulir/);
const upload = readFileSync("features/pelayanan/document-upload.tsx", "utf8");
assert.match(upload, /accept="image\/\*" capture="environment"/);
assert.match(upload, /accept="image\/\*,application\/pdf"/);
assert.doesNotMatch(readFileSync("lib/attachments.ts", "utf8") + upload, /localStorage|sessionStorage/);
console.log("PASS: attachment scaling/quality/limits, PDF bytes, decode errors, URL cleanup, private filenames, camera inputs, preparation DOM order. Canvas encoding stubbed; real browser check separate.");
