import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

// Local-only E2E: use a separate Laravel database and fictional staff tokens, never production.
const web = process.env.ADMIN_TEST_WEB ?? "http://127.0.0.1:3104";
const api = process.env.ADMIN_TEST_API ?? "http://127.0.0.1:8004/api/v1";
const builtApi = process.env.ADMIN_TEST_BUILT_API ?? "http://127.0.0.1:8000/api/v1";
const dir = process.env.ADMIN_TEST_DIR;
assert.ok(dir && process.env.ADMIN_TEST_TOKENS, "Set ADMIN_TEST_DIR and ADMIN_TEST_TOKENS (JSON file with staff/admin/village_head tokens).");
for (const url of [web, api, builtApi]) assert.ok(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Local test servers only");
const tokens = JSON.parse(await readFile(process.env.ADMIN_TEST_TOKENS, "utf8"));
await mkdir(dir, { recursive: true });
async function http(path, { role = "staff", method = "GET", body, status = 200 } = {}) {
  const response = await fetch(api + path, { method, headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${tokens[role]}` }, body: body && JSON.stringify(body) });
  assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}`);
  if (response.headers.get("content-type")?.includes("pdf")) {
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
    return bytes;
  }
  return response.json();
}
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const common = { nama: "Pemohon Fiktif S4", nik: "0000000000000401", no_kk: "0000000000000402", tempat_lahir: "Kota Fiktif", tanggal_lahir: "2000-02-29", jenis_kelamin: "Laki-laki", dusun: "Talang", alamat: "Alamat Fiktif S4", rt: "001", rw: "002", telepon: "080000000000", kewarganegaraan: "WNI", keperluan: "Keperluan Fiktif S4" };
const ids = {};
for (const type of ["UMUM", "KERAMAIAN"]) {
  const special = type === "UMUM" ? { agama: "Islam", status_perkawinan: "Belum Kawin", pendidikan: "SLTA/Sederajat", pekerjaan: "Pekerjaan Fiktif", isi_keterangan: "Keterangan asli fiktif dari warga." } : { acara: "Acara Fiktif S4", tempat_acara: "Tempat Fiktif S4", jenis_hiburan: "Hiburan Fiktif S4", tanggal_mulai: today, tanggal_selesai: today };
  ids[type] = (await http("/applications", { method: "POST", body: { ...common, jenis_surat: type, ...special }, status: 201 })).request_id;
  for (const status of ["VERIFIED", "PROCESSING"]) await http(`/staff/applications/${ids[type]}/status`, { method: "PATCH", body: { status } });
}
const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--no-first-run", `--user-data-dir=${dir}/chrome-${Date.now()}`, "--remote-debugging-port=9344", "about:blank"], { stdio: "ignore" });
let ws;
try {
  let tabs;
  for (let i = 0; i < 100 && !tabs; i++) {
    try { tabs = await (await fetch("http://127.0.0.1:9344/json/list")).json(); } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  ws = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`CDP timeout: ${method} ${params.expression ?? ""}`.slice(0, 300))); }, 30000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  let failSave = false;
  const network = [];
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const waiter = pending.get(message.id); pending.delete(message.id);
      if (waiter && message.error) waiter.reject(Error(message.error.message));
      else if (waiter) waiter.resolve(message.result);
    }
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      network.push({ url: request.url, method: request.method });
      const rejectSave = failSave && request.method === "PATCH" && request.url.endsWith("/isi-keterangan");
      if (rejectSave) failSave = false;
      void call(rejectSave ? "Fetch.failRequest" : "Fetch.continueRequest", rejectSave ? { requestId, errorReason: "Failed" } : { requestId, url: request.url.replace(builtApi, api) });
    }
  });
  const evaluate = async (expression) => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(`${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text} in ${expression.slice(0, 200)}`);
    return result.result.value;
  };
  const until = async (expression, label) => {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await new Promise((r) => setTimeout(r, 100)); }
    throw Error(`Timeout: ${label}`);
  };
  const click = (text) => evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
  const fill = async (value) => {
    await evaluate("document.getElementById('printed-statement').focus();document.getElementById('printed-statement').select()");
    await call("Input.insertText", { text: value });
  };
  await call("Page.enable"); await call("Runtime.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: `${builtApi}/*`, requestStage: "Request" }] });
  const injection = await call("Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem('watuagung-staff-token',${JSON.stringify(tokens.staff)})` });
  const navigate = async (id) => {
    await call("Page.navigate", { url: `${web}/admin/permohonan/detail/?id=${id}` });
    await until(`document.body.innerText.includes('Detail permintaan') && document.body.innerText.includes(${JSON.stringify(id)})`, "detail hydrated");
  };
  await navigate(ids.UMUM);
  assert.equal(await evaluate("document.body.innerText.includes('Islam')"), false);
  assert.equal(await evaluate("document.body.innerText.includes('Belum Kawin')"), false);
  assert.equal(await evaluate(`document.body.innerText.includes('${common.nik}')`), true);
  const detailGets = () => network.filter((request) => request.method === "GET" && request.url.endsWith(`/${ids.UMUM}`)).length;
  const beforeReveal = detailGets();
  await evaluate("document.querySelector('[aria-label=\"Tampilkan agama\"]').click()");
  await until("document.body.innerText.includes('Islam')", "reveal religion");
  assert.ok(detailGets() > beforeReveal, "reveal must re-fetch audited detail");
  await evaluate("document.querySelector('[aria-label=\"Tampilkan status perkawinan\"]').click()");
  await until("document.body.innerText.includes('Belum Kawin')", "reveal marital status");
  await evaluate("document.querySelector('[aria-label=\"Sembunyikan agama\"]').click()");
  assert.equal(await evaluate("document.body.innerText.includes('Islam')"), false);
  for (const width of [390, 1440]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const type of ["UMUM", "KERAMAIAN"]) {
      await navigate(ids[type]);
      assert.equal(await evaluate("!!document.getElementById('printed-statement')"), type === "UMUM");
      const text = await evaluate("document.body.innerText");
      if (type === "KERAMAIAN") for (const value of ["Acara Fiktif S4", "Tempat Fiktif S4", "Hiburan Fiktif S4", "Tanggal mulai", "Tanggal selesai"]) assert.ok(text.includes(value));
      else for (const value of ["Kewarganegaraan", "Pendidikan", "Pekerjaan Fiktif", "Teks asli dari warga", "Keterangan asli fiktif dari warga."]) assert.ok(text.includes(value));
      assert.ok(await evaluate(`document.documentElement.scrollWidth<=${width}`), "No page overflow");
      assert.deepEqual(await evaluate("[...document.querySelectorAll('main button,main textarea')].filter(e=>e.offsetParent&&e.getBoundingClientRect().height<48).map(e=>e.textContent)"), []);
      for (const part of ["Data diri", "Detail permintaan", "Tindakan petugas"]) {
        await evaluate(`[...document.querySelectorAll('h2')].find(e=>e.textContent===${JSON.stringify(part)}).scrollIntoView({block:'start'})`);
        const shot = await call("Page.captureScreenshot", { format: "png" });
        await writeFile(`${dir}/${type}-${width}-${part.replaceAll(" ", "-")}.png`, Buffer.from(shot.data, "base64"));
      }
    }
  }
  await navigate(ids.UMUM);
  const revised = "Pemohon menerangkan bahwa dirinya bekerja di tempat fiktif untuk pengujian.";
  await fill(revised);
  assert.equal(await evaluate("document.getElementById('status-WAITING_APPROVAL').disabled"), true);
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Lihat draf PDF').disabled"), true);
  failSave = true; await click("Simpan kalimat");
  await until("!!document.getElementById('statement-error')", "failed save visible");
  assert.equal(await evaluate("document.getElementById('printed-statement').value"), revised);
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent==='Simpan kalimat'&&!b.disabled)", "retry ready");
  await click("Simpan kalimat");
  await until("document.body.innerText.includes('Kalimat tersimpan.')", "saved");
  assert.equal(await evaluate("document.getElementById('status-WAITING_APPROVAL').disabled"), false);
  assert.equal((await http(`/staff/applications/${ids.UMUM}`)).isi_keterangan, revised);
  assert.equal((await http(`/staff/applications/${ids.UMUM}`)).isi_keterangan_awal, "Keterangan asli fiktif dari warga.");
  assert.ok(await evaluate("[...document.querySelectorAll('h3')].some(h=>h.textContent==='Isi keterangan disunting')"));
  const pdfRequested = () => network.some((request) => request.method === "GET" && request.url.endsWith(`/${ids.UMUM}/letter.pdf`));
  assert.equal(pdfRequested(), false);
  await click("Lihat draf PDF");
  for (let i = 0; i < 100 && !pdfRequested(); i++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(pdfRequested(), "draft button must request letter.pdf");
  await writeFile(`${dir}/UMUM-draft.pdf`, await http(`/staff/applications/${ids.UMUM}/letter.pdf`));
  await click("Ajukan ke Kepala Desa");
  await until("!document.getElementById('printed-statement')", "locked after submission");
  await http(`/staff/applications/${ids.UMUM}/isi-keterangan`, { method: "PATCH", body: { isi_keterangan: "Tidak boleh berubah" }, status: 422 });
  await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: injection.identifier });
  await http(`/staff/applications/${ids.UMUM}/status`, { role: "village_head", method: "PATCH", body: { status: "NEED_REVISION", catatan: "Perbaikan fiktif S4" } });
  // Admin can edit UMUM returned for revision; village head cannot.
  for (const role of ["admin", "village_head"]) {
    await evaluate(`sessionStorage.setItem('watuagung-staff-token',${JSON.stringify(tokens[role])})`);
    await navigate(ids.UMUM);
    assert.equal(await evaluate("!!document.getElementById('printed-statement')"), role === "admin");
    if (role === "admin") {
      await fill("Kalimat perbaikan fiktif oleh admin."); await click("Simpan kalimat");
      await until("document.body.innerText.includes('Kalimat tersimpan.')", "admin saved revision");
    } else await http(`/staff/applications/${ids.UMUM}/isi-keterangan`, { role, method: "PATCH", body: { isi_keterangan: "Dilarang" }, status: 403 });
    await navigate(ids.KERAMAIAN);
    assert.equal(await evaluate("!!document.getElementById('printed-statement')"), false);
    await http(`/staff/applications/${ids.KERAMAIAN}/isi-keterangan`, { role, method: "PATCH", body: { isi_keterangan: "Keterangan fiktif" }, status: role === "admin" ? 422 : 403 });
  }
  await writeFile(`${dir}/KERAMAIAN-draft.pdf`, await http(`/staff/applications/${ids.KERAMAIAN}/letter.pdf`));
  for (const type of ["UMUM", "KERAMAIAN"]) {
    const rows = await http(`/staff/applications?jenis_surat=${type}`);
    assert.ok(rows.data.some((row) => row.request_id === ids[type]));
  }
  assert.ok(network.every((request) => !request.url.includes(tokens.staff)));
  await writeFile(`${dir}/ids.json`, JSON.stringify(ids));
  console.log("PASS: UMUM/KERAMAIAN Laravel detail, reveal, save failure/retry, original text, history, PDF, submission lock, roles, filters, 390/1440 layout.");
} finally { ws?.close(); chrome.kill(); }
