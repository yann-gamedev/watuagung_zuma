// Jalankan Chrome dengan --remote-debugging-port=9222 memakai profil uji terpisah.
// Frontend :3000 memakai Laravel lokal :8000; seluruh data/foto dibuat fiktif.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const endpoint = await (await fetch("http://127.0.0.1:9222/json/new?about:blank", { method: "PUT" })).json();
const socket = new WebSocket(endpoint.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let sequence = 0;
const pending = new Map();
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data);
  const callbacks = pending.get(message.id);
  if (!callbacks) return;
  pending.delete(message.id);
  if (message.error) callbacks.reject(new Error(message.error.message));
  else callbacks.resolve(message.result);
};
function command(method, params = {}) {
  const id = ++sequence;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + " " + result.exceptionDetails.exception?.description);
  return result.result.value;
}
async function wait(expression) {
  const until = Date.now() + 40_000;
  do {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < until);
  throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText.slice(-3000)')}`);
}
async function click(text) {
  assert.equal(await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)} && x.getClientRects().length); if (!button) return false; button.click(); return true; })()`), true, text);
}
async function screenshot(name) {
  if (!process.env.ATTACHMENT_SCREENSHOT_DIR) return;
  const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(join(process.env.ATTACHMENT_SCREENSHOT_DIR, name), Buffer.from(shot.data, "base64"));
}
try {
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await command("Page.navigate", { url: "http://127.0.0.1:3000/pelayanan/domisili/" });
  await wait("document.querySelector('.application-submit')?.textContent.includes('Lanjut: Unggah dokumen')");
  await wait("!!document.querySelector('form')?.__reactFiber$ || [...document.querySelectorAll('form')].some(x=>Object.keys(x).some(k=>k.startsWith('__reactProps'))) ");
  await evaluate(`(() => {
    const original = XMLHttpRequest.prototype.send;
    window.sentFiles = [];
    XMLHttpRequest.prototype.send = function(body) {
      if (body instanceof FormData) window.sentFiles = [...body].filter(([,v])=>v instanceof Blob).map(([key,v])=>({key,size:v.size,type:v.type,name:v.name}));
      return original.call(this,body);
    };
  })()`);
  const preparation = await evaluate(`(() => { const a=document.querySelector('.service-preparation').getBoundingClientRect(), b=document.querySelector('.application-form').getBoundingClientRect(); return {width:innerWidth, before:a.bottom<=b.top, overflow:document.documentElement.scrollWidth>innerWidth}; })()`);
  assert.deepEqual(preparation, { width: 390, before: true, overflow: false });
  const values = { nik: "0000000000000001", nama: "Pemohon Fiktif Uji Lampiran", no_kk: "0000000000000001", tempat_lahir: "Tempat Fiktif", tanggal_lahir: "1990-01-01", jenis_kelamin: "Laki-laki", telepon: "081234567890", dusun: "Talang", kewarganegaraan: "WNI", agama: "Islam", status_perkawinan: "Belum Kawin", pendidikan: "SLTA/Sederajat", pekerjaan: "Pekerjaan Fiktif", alamat: "Alamat fiktif untuk uji", rt: "01", rw: "02", keperluan: "Uji unggah dokumen fiktif" };
  await evaluate(`(() => { const values=${JSON.stringify(values)}; for (const [name,value] of Object.entries(values)) { const input=document.querySelector('[name="'+name+'"]'); const proto=input.tagName==='SELECT'?HTMLSelectElement.prototype:input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); } })()`);
  await click("Lanjut: Unggah dokumen");
  await wait("document.querySelector('#upload-heading')?.getClientRects().length > 0");
  await click("Periksa ringkasan");
  await wait("!!document.querySelector('#error-KTP')");
  assert.equal(await evaluate("document.activeElement.classList.contains('error-box')"), true);
  // Sumber canvas 4032×3024 menggantikan foto identitas nyata.
  await evaluate(`(async () => { const c=document.createElement('canvas');c.width=4032;c.height=3024; const x=c.getContext('2d'); x.fillStyle='#eee';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111';x.font='120px sans-serif';x.fillText('DOKUMEN FIKTIF - BUKAN IDENTITAS',100,300); window.fakePhoto=await new Promise(resolve=>c.toBlob(resolve,'image/png')); })()`);
  for (let i = 0; i < 3; i++) {
    await evaluate(`(() => { const input=document.querySelectorAll('input[type=file]')[${i * 2 + 1}], dt=new DataTransfer();dt.items.add(new File([window.fakePhoto],'identitas-fiktif.png',{type:'image/png'}));input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
    await wait(`document.querySelectorAll('img[alt^="Pratinjau"]').length === ${i + 1} && !document.querySelector('.application-submit').disabled`);
  }
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await evaluate("document.querySelector('#upload-heading').scrollIntoView({block:'center'})");
  await screenshot("attachments-390.png");
  // Ganti/hapus mempertahankan data; PDF >5 MB ditolak per kartu.
  await click("Hapus KTP");
  await wait("document.querySelectorAll('img[alt^=\"Pratinjau\"]').length === 2");
  await evaluate(`(() => { const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(5*1024*1024+1)],'besar.pdf',{type:'application/pdf'}));const input=document.querySelectorAll('input[type=file]')[1];input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await wait("document.querySelector('#error-KTP')?.textContent.includes('5 MB')");
  await evaluate(`(() => { const dt=new DataTransfer();dt.items.add(new File([window.fakePhoto],'fiktif.png',{type:'image/png'}));const input=document.querySelectorAll('input[type=file]')[1];input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await wait("document.querySelectorAll('img[alt^=\"Pratinjau\"]').length === 3 && !document.querySelector('.application-submit').disabled");
  await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await evaluate("document.querySelector('#upload-heading').scrollIntoView({block:'center'})");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
  await screenshot("attachments-1440.png");
  await click("Periksa ringkasan");
  await wait("document.body.innerText.includes('Dokumen terlampir')");
  assert.equal(await evaluate("document.querySelector('.application-summary').textContent.includes('Pemohon Fiktif Uji Lampiran')"), true);
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  // Respons 422 tiruan memastikan galat server kembali ke kartu yang benar, file tetap ada.
  await evaluate(`(() => {
    const send=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send=function(body) {
      XMLHttpRequest.prototype.send=send;
      Object.defineProperty(this,'status',{value:422});
      Object.defineProperty(this,'responseText',{value:JSON.stringify({message:'Periksa lampiran.',errors:{'lampiran.KK':['Foto KK tidak terbaca (uji fiktif).']}})});
      queueMicrotask(()=>this.onload());
    };
  })()`);
  await click("Kirim permohonan");
  await wait("document.querySelector('#error-KK')?.textContent.includes('tidak terbaca')");
  assert.equal(await evaluate("document.querySelectorAll('img[alt^=\"Pratinjau\"]').length"), 3);
  await evaluate(`(() => { const dt=new DataTransfer();dt.items.add(new File([window.fakePhoto],'fiktif.png',{type:'image/png'}));const input=document.querySelectorAll('input[type=file]')[3];input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await wait("!document.querySelector('#error-KK') && !document.querySelector('.application-submit').disabled");
  await click("Periksa ringkasan");
  await wait("document.body.innerText.includes('Dokumen terlampir')");
  await click("Kirim permohonan");
  await wait("location.pathname.includes('/sukses') || !!document.querySelector('.error-box')");
  const files = await evaluate("window.sentFiles");
  assert.deepEqual(files.map((x) => x.key), ["lampiran[KTP]", "lampiran[KK]", "lampiran[PENGANTAR_RT_RW]"]);
  for (const file of files) { assert.ok(file.size < 1_500_000); assert.equal(file.type, "image/jpeg"); }
  assert.equal(await evaluate("location.pathname.includes('/sukses')"), true, await evaluate("document.querySelector('.error-box')?.innerText"));
  const requestId = await evaluate("new URL(location.href).searchParams.get('id')");
  assert.match(requestId, /^REQ-\d{4}-[A-Z0-9]{6,36}$/);
  const lookupSecret = await evaluate(`sessionStorage.getItem('watuagung-receipt-' + ${JSON.stringify(requestId)})`);
  // Hanya permohonan fiktif yang baru dibuat skrip ini; tak menyentuh data lain.
  const php = `require 'vendor/autoload.php'; $app=require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); $a=App\\Models\\Application::where('request_id',${JSON.stringify(requestId)})->where('nama','Pemohon Fiktif Uji Lampiran')->firstOrFail(); $a->update(['status'=>'NEED_REVISION','catatan'=>'Uji fiktif: foto KK perlu diganti.']);`;
  execFileSync("php", ["-r", php], { cwd: "backend", stdio: "pipe" });
  await command("Page.navigate", { url: "http://127.0.0.1:3000/pelayanan/status/" });
  await wait("!!document.querySelector('#lookup-submit') && Object.keys(document.querySelector('form') || {}).some(k=>k.startsWith('__reactProps'))");
  await evaluate(`(() => { for (const [id,value] of Object.entries({'request-id':${JSON.stringify(requestId)},'lookup-secret':${JSON.stringify(lookupSecret)}})) {const x=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(x,value);x.dispatchEvent(new Event('input',{bubbles:true}));} })()`);
  await click("Cek Status Surat");
  await wait("document.body.innerText.includes('Uji fiktif: foto KK perlu diganti.')");
  await click("Ganti dokumen");
  await wait("!!document.querySelector('#upload-heading')");
  await evaluate(`(async () => {const c=document.createElement('canvas');c.width=1600;c.height=1200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1600,1200);x.fillStyle='black';x.font='50px sans-serif';x.fillText('PENGGANTI FIKTIF KK',50,100);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'pengganti-fiktif.png',{type:'image/png'}));const input=document.querySelectorAll('input[type=file]')[3];input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait("document.querySelectorAll('img[alt^=\"Pratinjau\"]').length === 1 && !document.querySelector('.form-card button[type=submit]').disabled");
  await click("Kirim dokumen pengganti");
  await wait("document.body.innerText.includes('Dokumen pengganti sudah diterima.') || !!document.querySelector('.form-card .error-box')");
  assert.equal(await evaluate("document.body.innerText.includes('Dokumen pengganti sudah diterima.')"), true, await evaluate("document.querySelector('.form-card .error-box')?.textContent"));
  assert.equal(await evaluate("document.body.innerText.includes('Uji fiktif: foto KK perlu diganti.')"), true, "Keep staff note after partial L2 response");
  console.log("PASS: Laravel lokal 201 via formulir 390px, preparation first, required files, preview/change/delete, oversized PDF, inline 422 (mock), review, 1440px no overflow, L2 replace KK with status/note retained.");
  console.log("Multipart photo sizes (bytes):", files.map(({ size }) => size).join(", "));
} finally { socket.close(); }
