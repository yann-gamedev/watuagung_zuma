// Node 22+ / Chrome. Real local Laravel; no mocks, migrations, DB resets, or source/env changes.
// Start frontend :3000 with NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1 and Laravel :8000.
// Backend schema must already be current, including 2026_11_19_000000_add_ready_at_to_letters.
// Never migrate/reset a user's DB from this script; prepare an isolated local DB separately.
// Supply ONLINE_LETTER_TEST_TOKENS: private JSON file {"staff":"...","village_head":"..."},
// or ONLINE_LETTER_TEST_CREDENTIALS: private JSON file with {staff:{username,password},village_head:{username,password}}.
// Create dedicated fictional accounts interactively from backend/ (password remains private):
// php artisan staff:create online-letter-test-staff --role=staff --name="Petugas Fiktif Uji Online"
// php artisan staff:create online-letter-test-kades --role=village_head --name="Kades Fiktif Uji Online"
// Run from root: node scripts/test-online-letter-browser.mjs
// Only adds one fictional application per run; leaves application/audit history intact for inspection.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, mkdtemp, readdir, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const web = process.env.ONLINE_LETTER_TEST_WEB ?? "http://127.0.0.1:3000";
const api = process.env.ONLINE_LETTER_TEST_API ?? "http://127.0.0.1:8000/api/v1";
for (const url of [web, api]) {
  const parsed = new URL(url);
  assert.ok(parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname) && !parsed.username && !parsed.password, "Local HTTP test servers only");
}
assert.equal(typeof WebSocket, "function", "Node 22+ required");
const tokens = process.env.ONLINE_LETTER_TEST_TOKENS ? JSON.parse(await readFile(process.env.ONLINE_LETTER_TEST_TOKENS, "utf8")) : {};
if (!tokens.staff || !tokens.village_head) {
  assert.ok(process.env.ONLINE_LETTER_TEST_CREDENTIALS, "Set ONLINE_LETTER_TEST_TOKENS or ONLINE_LETTER_TEST_CREDENTIALS (see script header)");
  const credentials = JSON.parse(await readFile(process.env.ONLINE_LETTER_TEST_CREDENTIALS, "utf8"));
  for (const role of ["staff", "village_head"]) {
    assert.ok(credentials[role]?.username && credentials[role]?.password, `Missing ${role} credentials`);
    const response = await fetch(`${api}/staff/login`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(credentials[role]), signal: AbortSignal.timeout(30_000) });
    assert.equal(response.status, 200, `${role} login: HTTP ${response.status}; stop on rate limit, do not retry`);
    tokens[role] = (await response.json()).token;
  }
}
async function http(path, { role = "staff", body, status = 200 } = {}) {
  const response = await fetch(api + path, { method: body ? "POST" : "GET", headers: { Accept: "application/json", ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, status, `${path}: HTTP ${response.status}`);
  return response.headers.get("content-type")?.includes("json") ? response.json() : null;
}
for (const role of ["staff", "village_head"]) {
  const profile = await http("/staff/me", { role });
  assert.equal(profile.role, role);
  assert.equal(profile.must_change_password, false, "Use dedicated test accounts without pending password change");
  assert.equal(profile.features.neighborhood_approval, false, "Test covers default direct-to-office workflow only");
}
const baseDir = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Temp", "opencode") : tmpdir();
await mkdir(baseDir, { recursive: true });
const dir = process.env.ONLINE_LETTER_TEST_DIR ? resolve(process.env.ONLINE_LETTER_TEST_DIR) : await mkdtemp(join(baseDir, "online-letter-"));
await mkdir(dir, { recursive: true });
const downloads = join(dir, "downloads");
await mkdir(downloads, { recursive: true });
// Minimal valid one-page PDF. Explicit test text, never a real signature/stamp or village document.
const stream = "BT /F1 18 Tf 50 750 Td (SURAT FIKTIF - UJI ONLINE) Tj 0 -35 Td (SIMULASI SCAN TANDA TANGAN DAN STEMPEL) Tj 0 -35 Td (BUKAN SURAT RESMI - TANPA TANDA TANGAN ASLI) Tj ET";
const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const signedPdf = Buffer.from(pdf);
assert.equal(signedPdf.subarray(xref, xref + 4).toString(), "xref");
await writeFile(join(dir, "scan-surat-fiktif.pdf"), signedPdf);
const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", `--user-data-dir=${join(dir, "chrome-profile")}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
let chromeError;
chrome.on("error", (error) => { chromeError = error; });
let socket;
let requestId;
let failureCapture;
const pause = () => new Promise((resolvePause) => setTimeout(resolvePause, 100));
try {
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    if (chromeError) throw chromeError;
    if (chrome.exitCode !== null) throw Error(`Chrome exited: ${chrome.exitCode}`);
    try { port = Number((await readFile(join(dir, "chrome-profile", "DevToolsActivePort"), "utf8")).split("\n")[0]); } catch { await pause(); }
  }
  assert.ok(port, "Chrome debugging port unavailable");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const network = [];
  const responses = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const callback = pending.get(message.id);
      if (!callback) return;
      pending.delete(message.id);
      clearTimeout(callback.timer);
      if (message.error) callback.reject(Error(message.error.message)); else callback.resolve(message.result);
    }
    if (message.method === "Network.requestWillBeSent") {
      const { request } = message.params;
      // Keep metadata only: never record bodies, bearer tokens, or lookup secrets.
      if (request.url.startsWith(api)) network.push({ url: request.url, method: request.method });
    }
    if (message.method === "Network.responseReceived" && message.params.response.url.startsWith(api)) responses.push({ url: message.params.response.url, status: message.params.response.status });
  });
  function command(method, params = {}) {
    return new Promise((resolveCommand, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method}`)); }, 40_000);
      pending.set(id, { resolve: resolveCommand, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  failureCapture = async () => {
    await writeFile(join(dir, "response-statuses.json"), JSON.stringify(responses, null, 2));
    const shot = await command("Page.captureScreenshot", { format: "png" });
    await writeFile(join(dir, "failure.png"), Buffer.from(shot.data, "base64"));
    // This browser contains only fictional applicant data; omit inputs and credentials.
    await writeFile(join(dir, "failure.txt"), await evaluate("document.body.innerText"));
  };
  async function wait(expression, label = expression) {
    for (let i = 0; i < 400; i++) { if (await evaluate(expression)) return; await pause(); }
    throw Error(`Timed out: ${label}`);
  }
  async function click(text, scope = "document") {
    assert.equal(await evaluate(`(() => {const b=[...${scope}.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && e.getClientRects().length && !e.disabled);if(!b)return false;b.click();return true;})()`), true, `Enabled button: ${text}`);
  }
  async function fill(values, by = "name") {
    await evaluate(`(() => {for(const [key,value] of Object.entries(${JSON.stringify(values)})){const input=document.querySelector('[${by}="'+key+'"]');if(!input)throw Error('Missing input '+key);const proto=input.tagName==='SELECT'?HTMLSelectElement.prototype:input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  }
  async function navigate(path, ready) {
    await command("Page.navigate", { url: web + path });
    await wait(ready);
    await evaluate("document.fonts.ready.then(()=>true)");
  }
  async function screenshots(name, anchor) {
    for (const width of [390, 1440]) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: width === 390 });
      await evaluate(`${anchor}.scrollIntoView({block:'start'});window.scrollBy(0,-88);new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      await new Promise((resolve) => setTimeout(resolve, 300)); // Wait for existing responsive sidebar CSS transition before capture.
      assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth"), true, `${name} ${width}: no page overflow`);
      const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(join(dir, `${name}-${width}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate("/pelayanan/domisili/", "document.querySelector('.application-submit')?.textContent.includes('Lanjut: Unggah dokumen') && Object.keys(document.querySelector('form')||{}).some(k=>k.startsWith('__reactProps'))");
  const name = `Pemohon Fiktif Uji Online ${Date.now()}`;
  await fill({ nik: "0000000000000701", nama: name, no_kk: "0000000000000702", tempat_lahir: "Kota Fiktif", tanggal_lahir: "1990-01-01", jenis_kelamin: "Laki-laki", telepon: "080000000000", dusun: "Talang", kewarganegaraan: "WNI", agama: "Islam", status_perkawinan: "Belum Kawin", pendidikan: "SLTA/Sederajat", pekerjaan: "Pekerjaan Fiktif", alamat: "Alamat fiktif uji surat online", rt: "01", rw: "02", keperluan: "Pengujian fiktif alur surat online" });
  await click("Lanjut: Unggah dokumen");
  await wait("!!document.getElementById('upload-heading')");
  // Canvas replaces real scans; every identity/document is conspicuously fictional.
  await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=1600;c.height=1200;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='48px sans-serif';x.fillText('DOKUMEN FIKTIF - BUKAN IDENTITAS',50,150);window.fakeScan=await new Promise(r=>c.toBlob(r,'image/png'));})()`);
  for (let i = 0; i < 3; i++) {
    await evaluate(`(()=>{const input=[...document.querySelectorAll('input[type=file]')].filter(e=>e.accept.includes('application/pdf'))[${i}],dt=new DataTransfer();dt.items.add(new File([window.fakeScan],'scan-fiktif.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`document.querySelectorAll('img[alt^="Pratinjau"]').length===${i + 1} && !document.querySelector('.application-submit').disabled`);
  }
  await click("Periksa ringkasan");
  await wait("document.body.innerText.includes('Dokumen terlampir')");
  await click("Kirim permohonan");
  await wait("location.pathname.includes('/sukses')", "real Laravel submission succeeds");
  requestId = await evaluate("new URL(location.href).searchParams.get('id')");
  assert.match(requestId, /^REQ-\d{4}-[A-Z0-9]{6,36}$/);
  const secret = await evaluate(`sessionStorage.getItem('watuagung-receipt-'+${JSON.stringify(requestId)})`);
  assert.ok(secret, "Secret receipt stored per tab, not URL");
  const credentials = { request_id: requestId, lookup_secret: secret };
  const detail = () => http(`/staff/applications/${requestId}`);
  const publicStatus = () => http("/applications/status", { role: null, body: credentials });
  assert.equal((await detail()).nama, name);
  assert.equal((await detail()).status, "SUBMITTED");
  assert.equal((await detail()).attachments.length, 3);
  async function panel(role) {
    await evaluate(`sessionStorage.setItem('watuagung-staff-token',${JSON.stringify(tokens[role])})`);
    await navigate(`/admin/permohonan/detail/?id=${requestId}`, `!!document.getElementById('actions-heading') || document.body.innerText.includes('Tindakan petugas')`);
    await wait(`document.body.innerText.includes(${JSON.stringify(name)})`);
  }
  async function transition(status, label) {
    await click(label);
    if (status === "APPROVED") {
      await wait("!!document.querySelector('[role=dialog]')");
      await click("Ya, setujui", "document.querySelector('[role=dialog]')");
    }
    await wait(`!document.getElementById('status-${status}') && document.body.innerText.includes('Status permohonan berhasil diperbarui.')`, `UI refreshed after ${status}`);
    assert.equal((await detail()).status, status, `Persisted ${status}`);
  }
  await panel("staff");
  await transition("VERIFIED", "Verifikasi");
  await transition("PROCESSING", "Proses");
  await transition("WAITING_APPROVAL", "Ajukan ke Kepala Desa");
  await panel("village_head");
  await transition("APPROVED", "Setujui");
  assert.equal((await publicStatus()).letter_available, false, "Generated office PDF is not available to citizens");
  await http("/applications/letter", { role: null, body: credentials, status: 404 });
  await panel("staff");
  await screenshots("panel-approved", "[...document.querySelectorAll('h2')].find(e=>e.textContent==='Surat bertanda tangan')");
  await evaluate(`(()=>{const input=document.getElementById('letter-upload'),dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(${JSON.stringify(signedPdf.toString("base64"))}),c=>c.charCodeAt(0))],'scan-surat-fiktif.pdf',{type:'application/pdf'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait("document.body.innerText.includes('Scan tersimpan. Status, masa unduh, dan riwayat telah dimuat ulang.')");
  const readyDetail = await detail();
  assert.equal(readyDetail.status, "READY_FOR_PICKUP", "Upload automatically advances status");
  assert.equal(readyDetail.letter.source, "uploaded");
  assert.ok(Date.parse(readyDetail.letter.download_until) > Date.now());
  assert.equal(await evaluate("!!document.getElementById('status-READY_FOR_PICKUP') || !!document.getElementById('status-COMPLETED')"), false, "No manual ready/completed action");
  await screenshots("panel-ready", "[...document.querySelectorAll('h2')].find(e=>e.textContent==='Surat bertanda tangan')");
  await screenshots("panel-detail", "document.querySelector('main')");
  // Laravel's unprefixed IP throttle is shared by several earlier write routes; respect its one-minute window.
  await new Promise((resolve) => setTimeout(resolve, 61_000));
  await navigate("/pelayanan/status/",  "!!document.getElementById('lookup-secret') && Object.keys(document.querySelector('form')||{}).some(k=>k.startsWith('__reactProps'))");
  await fill({ "request-id": requestId, "lookup-secret": secret }, "id");
  await click("Cek Status Surat");
  await wait("document.querySelector('.lookup-result-header')?.textContent.includes('Siap diunduh')");
  await screenshots("status-ready", "document.querySelector('.lookup-result')");
  const ready = await publicStatus();
  assert.equal(ready.status, "READY_FOR_PICKUP");
  assert.equal(ready.letter_available, true);
  assert.equal(ready.letter_available_until, readyDetail.letter.download_until);
  for (let count = 1; count <= 2; count++) {
    await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Unduh surat (PDF)'&&!b.disabled)");
    await click("Unduh surat (PDF)");
    let files = [];
    for (let i = 0; i < 400; i++) {
      files = (await readdir(downloads)).filter((file) => file.endsWith(".pdf"));
      if (files.length === 1) break;
      await pause();
    }
    assert.equal(files.length, 1, `Browser saved download ${count}`);
    for (const file of files) {
      assert.deepEqual(await readFile(join(downloads, file)), signedPdf, "Downloaded scan bytes match uploaded fixture");
      await unlink(join(downloads, file)); // Headless Chrome may overwrite repeated filenames; verify each transfer independently.
    }
    await wait("document.querySelector('.lookup-result-header')?.textContent.includes('Selesai')");
    const afterDownload = await detail();
    assert.equal(afterDownload.status, "COMPLETED");
    assert.equal(afterDownload.letter.download_count, count);
    assert.ok(afterDownload.letter.last_downloaded_at);
  }
  const completed = await publicStatus();
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.letter_available, true, "Repeat download remains allowed before deadline");
  await screenshots("status-completed", "document.querySelector('.lookup-result')");
  await panel("staff");
  await screenshots("panel-completed", "[...document.querySelectorAll('h2')].find(e=>e.textContent==='Surat bertanda tangan')");
  assert.equal(network.filter((r) => r.method === "POST" && r.url === `${api}/applications/letter`).length, 2, "Two real browser download requests");
  assert.ok(responses.some((r) => r.url === `${api}/applications` && r.status === 201), "Browser received Laravel 201");
  assert.ok(responses.filter((r) => r.url === `${api}/applications/letter` && r.status === 200).length === 2);
  for (const request of network) for (const value of [secret, tokens.staff, tokens.village_head]) assert.ok(!request.url.includes(value), "No secret in request URL");
  await writeFile(join(dir, "result.json"), JSON.stringify({ request_id: requestId, status: completed.status, downloads: 2, screenshots: (await readdir(dir)).filter((file) => file.endsWith(".png")), network }, null, 2));
  console.log(`PASS: real Laravel form + 3 fictional scans; staff VERIFIED/PROCESSING/WAITING_APPROVAL; village head APPROVED; scan upload auto READY_FOR_PICKUP; citizen download auto COMPLETED; repeat download exact PDF bytes; panel/status 390/1440 no overflow.\nApplication: ${requestId}\nEvidence: ${dir}`);
} catch (error) {
  await failureCapture?.().catch(() => {});
  console.error(`FAIL; evidence directory: ${dir}${requestId ? `; fictional application: ${requestId}` : ""}`);
  throw error;
} finally {
  socket?.close();
  chrome.kill();
}
