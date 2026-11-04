import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
function compile(path) {
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  }).outputText;
  for (const name of ["react/jsx-runtime", "react", "lucide-react"]) code = code.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
  return code;
}
const data = dataUrl(compile("lib/data.ts"));
const { contact, getContactLinks } = await import(data);
const { OfficeContact, ContactNumber, ContactContext, ContactAddress } = await import(dataUrl(compile("components/office-contact.tsx").replaceAll('"@/lib/data"', JSON.stringify(data))));
const original = { ...contact };
const render = (component) => renderToStaticMarkup(createElement(component));
try {
  assert.equal(contact.hours, "Hari kerja, 08.00–13.00 WIB");
  assert.equal(contact.contactName, "Pelayanan Desa (Bu Ita)");
  assert.deepEqual(getContactLinks(), { phone: null, mapsEmbedUrl: null, mapsLinkUrl: null });
  for (const value of ["", "[PLACEHOLDER]", "08123", "+62000", "62", "62000\n", "62 000", "62abc", "javascript:alert(1)"]) {
    contact.phone = contact.mapsEmbedUrl = contact.mapsLinkUrl = value;
    assert.deepEqual(getContactLinks(), { phone: null, mapsEmbedUrl: null, mapsLinkUrl: null }, value);
    const html = render(OfficeContact) + render(ContactNumber);
    assert.ok(html.includes("Nomor kontak segera diumumkan."));
    assert.ok(!/\[PLACEHOLDER\]|<iframe|href=/.test(html));
    assert.ok(html.includes(original.address));
  }
  for (const url of ["http://www.google.com/maps/embed?x", "https://www.google.com.evil.test/maps/embed?x", "https://www.google.com/maps/embed/", "https://maps.app.goo.gl.evil.test/x"]) {
    assert.equal(getContactLinks({ ...original, mapsEmbedUrl: url }).mapsEmbedUrl, null);
    if (!url.startsWith("https://www.google.com/maps/")) assert.equal(getContactLinks({ ...original, mapsLinkUrl: url }).mapsLinkUrl, null);
  }
  // Nomor uji fiktif, bukan nomor layanan. Tidak mengubah lib/data.ts.
  Object.assign(contact, original, { phone: "6200000000000", mapsEmbedUrl: "https://www.google.com/maps/embed?pb=contoh-fiktif", mapsLinkUrl: "https://maps.app.goo.gl/contoh-fiktif" });
  const html = render(OfficeContact);
  assert.match(html, /href="tel:\+6200000000000"/);
  assert.match(html, /href="https:\/\/wa.me\/6200000000000"/);
  assert.match(html, /Chat WhatsApp/);
  assert.match(html, /title="Peta lokasi Balai Desa Watuagung" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/);
  assert.match(html, /href="https:\/\/maps.app.goo.gl\/contoh-fiktif" target="_blank" rel="noopener noreferrer"/);
  assert.ok(!html.includes("[PLACEHOLDER]"));
  assert.equal(getContactLinks({ ...original, mapsLinkUrl: "https://www.google.com/maps/place/contoh" }).mapsLinkUrl, "https://www.google.com/maps/place/contoh");
  // Embed dan tautan independen: data parsial tetap berguna tanpa kotak kosong.
  contact.mapsEmbedUrl = "[PLACEHOLDER]";
  assert.ok(!render(OfficeContact).includes("<iframe"));
  assert.ok(render(OfficeContact).includes("Buka di Google Maps"));
  contact.mapsEmbedUrl = "https://www.google.com/maps/embed?pb=contoh-fiktif";
  contact.mapsLinkUrl = "[PLACEHOLDER]";
  assert.ok(render(OfficeContact).includes("<iframe"));
  assert.ok(!render(OfficeContact).includes("Buka di Google Maps"));
  // Provider menimpa nilai statis untuk semua komponen di bawahnya (data API R4).
  Object.assign(contact, original);
  const api = { ...original, address: "Alamat API fiktif", hours: "Jam API fiktif", contactName: "Kontak API fiktif", phone: "6200000000001" };
  const provided = renderToStaticMarkup(createElement(ContactContext.Provider, { value: api }, createElement(OfficeContact), createElement(ContactAddress)));
  for (const text of [api.address, api.hours, api.contactName, "tel:+6200000000001"]) assert.ok(provided.includes(text), text);
  assert.ok(!provided.includes(original.address));
  assert.ok(render(OfficeContact).includes(original.address), "tanpa provider tetap nilai statis");
  console.log("PASS: validasi kontak, fallback, nomor/WhatsApp, iframe, tautan peta, konfigurasi parsial, provider API.");
} finally {
  Object.assign(contact, original);
}
