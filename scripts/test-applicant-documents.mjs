import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Node 22+, Chrome, API-enabled Next server. No Laravel, real tokens, or real identities.
// node scripts/test-applicant-documents.mjs
// Optional: ADMIN_TEST_WEB, ADMIN_TEST_API (compiled frontend API base), CHROME_PATH, ADMIN_TEST_DIR (screenshots).
// Fetch interception proves UI behavior only; Laravel authorization/audit/storage require separate real API tests.
const web = (process.env.ADMIN_TEST_WEB ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const api = (process.env.ADMIN_TEST_API ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
for (const url of [web, api]) assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Local test URLs only");
assert.equal(typeof WebSocket, "function", "Use Node 22+ (native WebSocket)");
assert.ok((await fetch(`${web}/admin/permohonan/detail/`).catch(() => null))?.ok, `Start API-enabled Next at ${web} first`);
const profileDir = await mkdtemp(join(process.env.TEMP ?? tmpdir(), "watuagung-documents-"));
const shots = process.env.ADMIN_TEST_DIR;
if (shots) await mkdir(shots, { recursive: true });
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
const id = "REQ-2026-L4FIKTIF";
const token = "fictional-l4-test-token";
let role = "staff";
const timestamp = "2026-11-17T08:00:00Z";
const attachments = [
  { id: 41, kind: "KTP", label: "KTP", stored_mime: "image/jpeg", size_bytes: 5000, uploaded_at: timestamp, purged: false },
  { id: 42, kind: "KK", label: "Kartu Keluarga (KK)", stored_mime: "application/pdf", size_bytes: 500, uploaded_at: timestamp, purged: false },
  { id: 43, kind: "PENGANTAR_RT_RW", label: "Surat Pengantar RT/RW", stored_mime: "image/webp", size_bytes: 0, uploaded_at: timestamp, purged: true },
];
const detail = {
  request_id: id, nama: "Pemohon Fiktif Uji L4", jenis_surat: "DOMISILI", status: "VERIFIED",
  created_at: timestamp, updated_at: timestamp, allowed_transitions: ["PROCESSING", "NEED_REVISION"],
  nik: "0000000000000041", no_kk: "0000000000000042", tempat_lahir: "Tempat Fiktif", tanggal_lahir: "1990-01-01",
  jenis_kelamin: "Laki-laki", alamat: "Alamat Fiktif Uji L4", rt: "001", rw: "002", telepon: "080000000041",
  nama_usaha: null, jenis_usaha: null, alamat_usaha: null, keperluan: "Pengujian dokumen fiktif, bukan permohonan warga.",
  catatan: null, can_reset_access_code: false, dusun: "Talang", barang_hilang: null, acara: null, tempat_acara: null,
  tanggal_mulai: null, tanggal_selesai: null, jenis_hiburan: null, isi_keterangan: null, isi_keterangan_awal: null,
  can_edit_isi_keterangan: false, agama: null, status_perkawinan: null, kewarganegaraan: "WNI", pendidikan: null,
  pekerjaan: null, letter_numbers: [], letter: null, attachments, history: [],
};
// Small valid, wholly fictional PDF; xref offsets count actual ASCII bytes.
const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>", "<< /Length 0 >>\nstream\n\nendstream"];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [index, object] of objects.entries()) { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
const xref = pdf.length;
pdf += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-popup-blocking",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding", `--user-data-dir=${profileDir}`,
  "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1", "about:blank",
], { stdio: "ignore" });
let launchError;
chrome.on("error", (error) => { launchError = error; });
let socket;
let port;
const pending = new Map();
const mockErrors = [];
const requests = [];
let nextResponse = "ok";
let held;
let image;
let sequence = 0;
try {
  for (let i = 0; i < 100 && !port; i++) {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null) throw Error(`Chrome exited: ${chrome.exitCode}`);
    try { port = Number((await readFile(join(profileDir, "DevToolsActivePort"), "utf8")).split("\n")[0]); } catch { await pause(); }
  }
  assert.ok(port, "Chrome CDP did not start");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((item) => item.type === "page");
  assert.ok(target, "Chrome page target missing");
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  function command(method, params = {}) {
    const requestId = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(Error(`CDP timeout: ${method}`)); }, 30_000);
      pending.set(requestId, { resolve: (value) => { clearTimeout(timer); resolve(value); }, reject: (error) => { clearTimeout(timer); reject(error); } });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
  }
  async function fulfill(requestId, status, mime, body = "") {
    await command("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [
      { name: "Content-Type", value: mime }, { name: "Access-Control-Allow-Origin", value: new URL(web).origin },
      { name: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, Accept" },
      { name: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" }, { name: "Cache-Control", value: "no-store" },
    ], body: Buffer.from(body).toString("base64") });
  }
  const json = (requestId, body, status = 200) => fulfill(requestId, status, "application/json", JSON.stringify(body));
  const blobReply = (requestId, kind, mode = "ok") => {
    if (mode === "network") return command("Fetch.failRequest", { requestId, errorReason: "Failed" });
    if (typeof mode === "number") return json(requestId, { message: "Galat dokumen fiktif." }, mode);
    if (mode === "wrong-mime") return fulfill(requestId, 200, "text/plain", "Not an image");
    if (mode === "invalid-image") return fulfill(requestId, 200, "image/jpeg", "Not valid image bytes");
    return fulfill(requestId, 200, kind === "42" ? "application/pdf" : "image/jpeg", kind === "42" ? pdf : image);
  };
  async function intercept({ requestId, request }) {
    // Intercept every API request, including preflight; unexpected routes fail test rather than reaching Laravel.
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return fulfill(requestId, 204, "text/plain");
    requests.push({ url: request.url, method: request.method, headers: request.headers, role });
    assert.equal(request.headers.Authorization ?? request.headers.authorization, `Bearer ${token}`, "Bearer token must remain in header");
    assert.ok(!request.url.includes(token), "Token leaked in URL");
    const path = url.pathname.slice(new URL(api).pathname.length);
    if (path === "/staff/me") return json(requestId, {
      name: `Akun Fiktif ${role}`, username: `uji-${role}`, role, rt: null, rw: null, must_change_password: false,
      features: { neighborhood_approval: false }, abilities: role === "kim" ? ["panel", "media:manage"] : role === "village_head" ? ["panel", "applications:manage"] : ["panel", "applications:manage", "media:manage", "site:manage"],
    });
    if (path === `/staff/applications/${id}`) return json(requestId, detail);
    if (path === "/staff/applications") return json(requestId, { data: [], current_page: 1, last_page: 1, per_page: 20, total: 0, from: null, to: null });
    if (path === "/staff/logout") return json(requestId, { message: "Keluar." });
    const attachment = path.match(new RegExp(`^/staff/applications/${id}/attachments/(41|42)$`));
    if (attachment) {
      assert.equal(request.method, "GET");
      const mode = nextResponse; nextResponse = "ok";
      if (mode === "hold") { assert.equal(held, undefined); held = { requestId, kind: attachment[1] }; return; }
      return blobReply(requestId, attachment[1], mode);
    }
    await json(requestId, { message: "Unexpected mocked API request" }, 500);
    throw Error(`Unexpected API request: ${request.method} ${request.url}`);
  }
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const waiter = pending.get(message.id); pending.delete(message.id);
      if (message.error) waiter?.reject(Error(message.error.message)); else waiter?.resolve(message.result);
    }
    if (message.method === "Fetch.requestPaused") void intercept(message.params).catch((error) => mockErrors.push(error));
  });
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function until(expression, label = expression) {
    for (let i = 0; i < 200; i++) {
      if (mockErrors.length) throw mockErrors[0];
      if (await evaluate(expression)) return;
      await pause();
    }
    throw Error(`Timeout: ${label}\n${await evaluate("document.body.innerText.slice(-2500)")}`);
  }
  async function click(text) {
    assert.equal(await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)} && !b.disabled); if(!b)return false;b.focus();b.click();return true; })()`), true, `Button enabled: ${text}`);
  }
  async function shot(name) {
    if (!shots) return;
    const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(join(shots, name), Buffer.from(result.data, "base64"));
  }
  const section = "document.querySelector('[aria-labelledby=\"applicant-documents-title\"]')";
  const dialog = "document.querySelector('[role=dialog]')";
  const urlCounts = () => evaluate("({created:__l4.created.length,revoked:__l4.revoked.length,live:__l4.created.filter(u=>!__l4.revoked.includes(u)).length})");
  async function noLeaks() {
    await until("__l4.created.length === __l4.revoked.length", "All object URLs revoked");
    const state = await evaluate("({created:__l4.created,revoked:__l4.revoked,tabs:__l4.tabs.map(t=>t.closed)})");
    assert.deepEqual([...state.created].sort(), [...state.revoked].sort(), "Each URL revoked exactly once");
    assert.ok(state.tabs.every(Boolean), "Every document tab closed");
  }
  async function navigate(nextRole = role) {
    role = nextRole;
    await command("Page.navigate", { url: `${web}/admin/permohonan/detail/?id=${id}` });
    await until(`${section} && ${section}.innerText.includes('Setiap pembukaan dokumen dicatat.')`, "Documents metadata hydrated");
  }
  async function imageOpen() {
    await click("Buka KTP");
    await until(`${dialog}?.querySelector('img')?.naturalWidth > 0`, "Decoded private image");
    assert.equal(await evaluate(`${dialog}.querySelector('img').src.startsWith('blob:')`), true);
    assert.equal((await urlCounts()).live, 1);
  }
  async function imageClose(escape = false) {
    if (escape) {
      await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    } else await click("Tutup dokumen");
    await until(`!${dialog} && document.activeElement?.textContent.trim()==='Buka KTP'`, "Close restores image trigger focus");
    await noLeaks();
  }
  async function pdfOpen() {
    await click("Buka Kartu Keluarga (KK)");
    await until(`${section}.innerText.includes('dibuka di tab PDF baru.') && __l4.tabs.at(-1)?.location.href.startsWith('blob:')`, "PDF blob in native tab");
    assert.equal(await evaluate("__l4.tabs.at(-1).opener===null"), true, "Private PDF has no opener");
    assert.equal(await evaluate("__l4.tabs.at(-1).sessionStorage.getItem('watuagung-staff-token')"), null, "PDF tab must not retain copied panel token");
    assert.equal(await evaluate("sessionStorage.getItem('watuagung-staff-token')"), token, "Clearing PDF storage must not clear panel session");
    assert.equal((await urlCounts()).live, 1);
  }
  async function releaseHeld() {
    const response = held; held = undefined;
    assert.ok(response, "Expected held blob request");
    const finished = await evaluate("__l4.finished");
    await blobReply(response.requestId, response.kind);
    await until(`__l4.finished > ${finished}`, "Late blob consumed");
    await evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
  }
  async function holdOpen(button = "Buka KTP") {
    nextResponse = "hold";
    await click(button);
    await until(`${section}.innerText.includes('Memuat dokumen dan mencatat akses...')`, "Loading state");
    for (let i = 0; i < 100 && !held; i++) await pause();
    assert.ok(held, "Blob request intercepted");
    if (button === "Buka Kartu Keluarga (KK)") {
      assert.equal(await evaluate("__l4.tabs.at(-1).sessionStorage.getItem('watuagung-staff-token')"), null, "Blank PDF tab token cleared before fetch completes");
      assert.equal(await evaluate("__l4.tabs.at(-1).opener===null"), true, "Blank PDF tab opener cleared before fetch completes");
    }
    assert.equal(await evaluate(`${section}.querySelectorAll('button[disabled]').length`), 2, "Prevent duplicate opens while loading");
  }
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  await command("Page.addScriptToEvaluateOnNewDocument", { source: `
    sessionStorage.setItem('watuagung-staff-token',${JSON.stringify(token)});
    window.__l4={created:[],revoked:[],tabs:[],finished:0,marker:Math.random()};
    const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),open=window.open.bind(window),fetchOriginal=window.fetch.bind(window);
    URL.createObjectURL=blob=>{const url=create(blob);__l4.created.push(url);return url};
    URL.revokeObjectURL=url=>{__l4.revoked.push(url);revoke(url)};
    window.open=(...args)=>{const tab=open(...args);if(tab)__l4.tabs.push(tab);return tab};
    window.fetch=async(...args)=>{const response=await fetchOriginal(...args);const blob=response.blob.bind(response);response.blob=async()=>{try{return await blob()}finally{__l4.finished++}};return response};
  ` });
  await navigate();
  image = Buffer.from(await evaluate(`(() => {const c=document.createElement('canvas');c.width=1600;c.height=1000;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#111';x.font='48px sans-serif';x.fillText('DOKUMEN FIKTIF L4 - BUKAN IDENTITAS',40,100);return c.toDataURL('image/jpeg').split(',')[1]})()`), "base64");
  assert.ok(image.length > 1000);

  // Both metadata-only states must have no open control or blob request.
  assert.deepEqual(await evaluate(`${section} && [...${section}.querySelectorAll('dl > div')].map(row=>({kind:row.querySelector('dt').textContent,state:row.querySelector('dd > span').textContent,open:!!row.querySelector('button')}))`), [
    { kind: "KTP", state: "Ada", open: true }, { kind: "Kartu Keluarga (KK)", state: "Ada", open: true },
    { kind: "Surat Pengantar RT/RW", state: "Dihapus sesuai masa simpan", open: false },
  ]);
  assert.equal(requests.some((request) => request.url.includes("/attachments/")), false, "Metadata must not prefetch document bytes");
  detail.attachments = [];
  await navigate();
  assert.equal(await evaluate(`${section}.querySelectorAll('button').length`), 0);
  assert.equal(await evaluate(`[...${section}.querySelectorAll('dd > span')].every(e=>e.textContent==='Belum')`), true);
  detail.attachments = attachments;

  for (const nextRole of ["staff", "admin", "village_head"]) {
    await navigate(nextRole);
    await imageOpen();
    await imageClose(true);
  }
  await navigate("staff");
  await click("Foto KTP buram");
  await click("Pengantar RT/RW belum ditandatangani");
  assert.equal(await evaluate("document.getElementById('staff-note').value"), "Foto KTP buram\nPengantar RT/RW belum ditandatangani", "Quick notes append without replacing existing text");
  assert.equal(await evaluate("document.activeElement.id"), "staff-note");
  assert.equal(requests.some((request) => request.method === "PATCH"), false, "Quick notes must not submit status");
  await evaluate("(() => {const input=document.getElementById('staff-note');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'x'.repeat(999));input.dispatchEvent(new Event('input',{bubbles:true}));})()");
  await until("[...document.querySelectorAll('[aria-label=\"Pilihan cepat catatan perbaikan\"] button')].every(b=>b.disabled)", "Quick notes respect 1000 character cap");
  await navigate();
  for (const width of [390, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate(`${section}.scrollIntoView({block:'center'})`);
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true, `Metadata no overflow at ${width}`);
    await shot(`documents-${width}.png`);
    await imageOpen();
    assert.equal(await evaluate(`${dialog}.querySelector('button').disabled`), true, "Zoom starts at minimum");
    for (let i = 0; i < 4; i++) await click("Perbesar");
    await until(`${dialog}.innerText.includes('Ukuran 300%')`, "Maximum zoom");
    assert.equal(await evaluate(`[...${dialog}.querySelectorAll('button')].find(b=>b.textContent==='Perbesar').disabled`), true);
    await click("Putar 90°");
    assert.equal(await evaluate(`${dialog}.querySelector('img').style.transform`), "rotate(90deg)");
    for (let i = 0; i < 3; i++) await click("Putar 90°");
    await click("Perkecil");
    await until(`${dialog}.innerText.includes('Ukuran 250%, putaran 0°.')`, "Zoom out and rotation wraps");
    assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"), true, `Viewer no page overflow at ${width}`);
    assert.equal(await evaluate(`${dialog}.querySelector('[role=region]').scrollWidth > ${dialog}.querySelector('[role=region]').clientWidth`), true, "Zoom scroll remains inside viewer");
    assert.deepEqual(await evaluate(`[...${dialog}.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height<48).map(b=>b.textContent)`), [], "Viewer controls >=48px");
    await shot(`documents-image-${width}.png`);
    await imageClose(width === 390);
  }
  await imageOpen();
  assert.equal(await evaluate(`${dialog}.innerText.includes('Ukuran 100%, putaran 0°.')`), true, "Reopen resets transforms");
  await imageClose();

  await pdfOpen();
  const pdfTab = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((item) => item.id !== target.id && item.type === "page");
  assert.ok(pdfTab, "Real PDF tab exists");
  await fetch(`http://127.0.0.1:${port}/json/close/${pdfTab.id}`);
  await until(`!${section}.innerText.includes('dibuka di tab PDF baru.')`, "Native tab close detected by polling");
  await noLeaks();
  await pdfOpen();
  await click("Tutup dokumen");
  await noLeaks();

  for (const button of ["Buka KTP", "Buka Kartu Keluarga (KK)"]) {
    await holdOpen(button);
    const before = await urlCounts();
    await click("Batalkan pembukaan");
    await releaseHeld();
    assert.deepEqual(await urlCounts(), before, "Cancelled late response must not create object URL");
    assert.equal(await evaluate(`!!${dialog}`), false);
    await noLeaks();
  }
  await holdOpen("Buka Kartu Keluarga (KK)");
  await evaluate("__l4.tabs.at(-1).close()");
  await releaseHeld();
  await until(`${section}.innerText.includes('Tab PDF sudah ditutup.')`, "PDF closed before response");
  await noLeaks();

  for (const [mode, message] of [[403, "Akun ini tidak memiliki akses"], [404, "Permohonan tidak ditemukan"], [500, "Galat dokumen fiktif."], ["network", "Server belum dapat dihubungi"], ["wrong-mime", "Format dokumen tidak sesuai"], ["invalid-image", "Gambar gagal ditampilkan"]]) {
    const before = await urlCounts();
    nextResponse = mode;
    await click("Buka KTP");
    await until(`${section}.querySelector('[role=alert]')?.textContent.includes(${JSON.stringify(message)})`, `Visible error: ${mode}`);
    await until(`![...${section}.querySelectorAll('button')].some(b=>b.disabled)`, "Retry enabled after error");
    await noLeaks();
    if (mode !== "invalid-image") assert.deepEqual(await urlCounts(), before, "Failed requests must not create object URLs");
  }
  await evaluate("window.open=()=>null");
  await click("Buka Kartu Keluarga (KK)");
  await until(`${section}.innerText.includes('Tab baru diblokir.')`, "Blocked popup error");
  await navigate();

  // Next Link navigation, not hard reload: instrumentation survives, component unmount cleans up.
  for (const kind of ["image", "pdf", "pending"]) {
    if (kind === "image") await imageOpen(); else if (kind === "pdf") await pdfOpen(); else await holdOpen();
    const marker = await evaluate("__l4.marker");
    const before = await urlCounts();
    await evaluate("[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Kembali ke daftar').click()");
    await until(`!${section} && !!document.getElementById('applications-title')`, "SPA leaves detail");
    assert.equal(await evaluate("__l4.marker"), marker, "Route test must not reload document");
    if (kind === "pending") { await releaseHeld(); assert.deepEqual(await urlCounts(), before, "Unmount rejects late response"); }
    await noLeaks();
    await navigate();
  }
  for (const kind of ["pdf", "pending"]) {
    if (kind === "pdf") await pdfOpen(); else await holdOpen();
    const before = await urlCounts();
    await evaluate("document.getElementById('staff-logout').click()");
    await until("!document.getElementById('staff-logout') && !!document.querySelector('input[type=password]')", "Logout unmounts detail");
    assert.equal(await evaluate("sessionStorage.getItem('watuagung-staff-token')"), null);
    if (kind === "pending") { await releaseHeld(); assert.deepEqual(await urlCounts(), before); }
    await noLeaks();
    await navigate();
  }
  nextResponse = 401;
  await click("Buka KTP");
  await until("document.body.innerText.includes('Sesi berakhir, silakan masuk lagi.')", "401 expires local session");
  assert.equal(await evaluate("sessionStorage.getItem('watuagung-staff-token')"), null);
  await noLeaks();

  role = "kim";
  const beforeKim = requests.length;
  await command("Page.navigate", { url: `${web}/admin/permohonan/detail/?id=${id}` });
  await until("document.body.innerText.includes('Halaman ini tidak tersedia untuk peran Anda.')", "KIM detail route blocked by shell");
  assert.equal(await evaluate(`!!${section}`), false);
  assert.equal(await evaluate("!!document.querySelector('#admin-sidebar a[href*=permohonan]')"), false);
  assert.equal(await evaluate("!!document.querySelector('#admin-sidebar a[href*=berita]') && !!document.querySelector('#admin-sidebar a[href*=umkm]')"), true);
  assert.equal(requests.slice(beforeKim).some((request) => request.url.includes("/staff/applications")), false, "KIM UI must not fetch applicant data");
  assert.equal(mockErrors.length, 0);
  assert.ok(requests.some((request) => request.url.endsWith("/attachments/41")));
  assert.ok(requests.some((request) => request.url.endsWith("/attachments/42")));
  assert.ok(requests.every((request) => !request.url.includes(token)));
  console.log("PASS (mocked API, real Chrome UI): staff/admin/village_head, KIM shell denial, Ada/Belum/purged, authenticated image/PDF blobs, zoom/rotation, close/Escape focus, native PDF tab close/explicit close, cancellation/late responses, SPA/logout cleanup, 401/403/404/500/network/MIME/decode/popup errors, 390/1440 layout.");
  console.log("Not covered: real Laravel permissions, audit persistence, encrypted storage, production deployment. Run backend tests separately.");
} finally {
  for (const waiter of pending.values()) waiter.reject(Error("Test session closed"));
  pending.clear();
  socket?.close();
  if (chrome.exitCode === null && !launchError) {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill();
    await Promise.race([exited, pause(5000)]);
  }
  await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
}
