// E4 end-to-end: Node 22+ / Chrome. Real local Laravel with MAIL_MAILER=log; no mocks.
// Never run against a real/shared database: start an ISOLATED Laravel (temporary SQLite, MAIL_MAILER=log,
// QUEUE_CONNECTION=sync, SITE_URL = this frontend) and a frontend built/served with NEXT_PUBLIC_API_URL pointing to it.
//   EMAIL_APPROVAL_TEST_WEB   frontend origin (default http://127.0.0.1:3001)
//   EMAIL_APPROVAL_TEST_API   API base (default http://127.0.0.1:8001/api/v1)
//   EMAIL_APPROVAL_TEST_LOG   path of that Laravel's storage/logs/laravel.log (emails are read from it)
//   EMAIL_APPROVAL_TEST_CREDENTIALS  private JSON {staff:{username,password},village_head:{username,password}}
//                                    for dedicated FICTIONAL accounts (village head without PIN/email yet)
// Flow: verify head email (link from log, 390px) → set PIN in panel → staff sends application to head →
// approval link from log opened at 390px → approve with PIN → letter number → reuse link → "tidak berlaku";
// second application: wrong PIN then reject with reason. Screenshots at 390px and 1440px.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const web = process.env.EMAIL_APPROVAL_TEST_WEB ?? "http://127.0.0.1:3001";
const api = process.env.EMAIL_APPROVAL_TEST_API ?? "http://127.0.0.1:8001/api/v1";
const logPath = process.env.EMAIL_APPROVAL_TEST_LOG;
for (const url of [web, api]) {
  const parsed = new URL(url);
  assert.ok(parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname), "Local HTTP test servers only");
}
assert.ok(logPath, "Set EMAIL_APPROVAL_TEST_LOG (see header)");
assert.ok(process.env.EMAIL_APPROVAL_TEST_CREDENTIALS, "Set EMAIL_APPROVAL_TEST_CREDENTIALS (see header)");
const credentials = JSON.parse(await readFile(process.env.EMAIL_APPROVAL_TEST_CREDENTIALS, "utf8"));
const PIN = "482915";
const HEAD_EMAIL = "kades.uji@example.test";

const tokens = {};
for (const role of ["staff", "village_head"]) {
  const response = await fetch(`${api}/staff/login`, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(credentials[role]) });
  assert.equal(response.status, 200, `${role} login: HTTP ${response.status}`);
  tokens[role] = (await response.json()).token;
}
async function http(path, { role = "staff", method = "GET", body, status = 200 } = {}) {
  const response = await fetch(api + path, { method, headers: { Accept: "application/json", ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}`);
  return response.json();
}

/** Laravel MAIL_MAILER=log writes raw MIME: decode quoted-printable soft breaks and =XX escapes. */
async function lastLink(pathPrefix, since, accept = () => true) {
  // Bagian teks tidak di-encode, bagian HTML quoted-printable: lepas soft break, lalu dekode hanya tautan
  // yang memang memuat =3D (tanda "=" ter-encode).
  const raw = (await readFile(logPath, "utf8")).slice(since).replace(/=\r?\n/g, "");
  const matches = [...raw.matchAll(new RegExp(`${web.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${pathPrefix}\\?[^\\s"'<>)\\]]+`, "g"))]
    .map(([link]) => (link.includes("=3D") ? link.replace(/=([0-9A-F]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16))) : link).replace(/&amp;/g, "&"));
  const wanted = matches.filter(accept);
  assert.ok(wanted.length, `No ${pathPrefix} link in mail log`);
  return wanted.at(-1);
}
// Log belum ada sebelum email pertama ditulis.
const logSize = async () => (await readFile(logPath, "utf8").catch(() => "")).length;

const dir = await mkdtemp(join(tmpdir(), "email-approval-"));
const stream = "BT /F1 18 Tf 50 750 Td (LAMPIRAN FIKTIF - UJI PERSETUJUAN EMAIL) Tj ET";
const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
let pdf = "%PDF-1.4\n";
const offsets = [];
for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; }
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

async function submitApplication(name) {
  const form = new FormData();
  const fields = { jenis_surat: "DOMISILI", nama: name, nik: "0000000000001234", no_kk: "0000000000005678", tempat_lahir: "Tempat Fiktif", tanggal_lahir: "2000-01-01", jenis_kelamin: "Perempuan", dusun: "Talang", alamat: "Alamat fiktif", rt: "1", rw: "2", telepon: "08000000000", kewarganegaraan: "WNI", agama: "Islam", status_perkawinan: "Belum Kawin", pendidikan: "SLTA/Sederajat", pekerjaan: "Karyawan Swasta", keperluan: "Uji persetujuan email fiktif" };
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  for (const kind of ["KTP", "KK", "PENGANTAR_RT_RW"]) form.append(`lampiran[${kind}]`, new Blob([pdf], { type: "application/pdf" }), `${kind}-fiktif.pdf`);
  const response = await fetch(`${api}/applications`, { method: "POST", headers: { Accept: "application/json" }, body: form });
  assert.equal(response.status, 201, `submit: HTTP ${response.status} ${await response.clone().text()}`);
  const { request_id } = await response.json();
  for (const status of ["VERIFIED", "PROCESSING", "WAITING_APPROVAL"]) await http(`/staff/applications/${request_id}/status`, { method: "PATCH", body: { status } });
  return request_id;
}

const chrome = spawn(process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${join(dir, "chrome-profile")}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
const pause = (ms = 100) => new Promise((done) => setTimeout(done, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 150 && !port; i++) {
    try { port = Number((await readFile(join(dir, "chrome-profile", "DevToolsActivePort"), "utf8")).split("\n")[0]); } catch { await pause(); }
  }
  assert.ok(port, "Chrome debugging port unavailable");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  await new Promise((open, reject) => { socket.addEventListener("open", open, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  const requests = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(Error(message.error.message)); else resolve(message.result);
    }
    // Metadata only (URL + Referer header presence); never bodies.
    if (message.method === "Network.requestWillBeSent") requests.push({ url: message.params.request.url, referer: message.params.request.headers.Referer ?? null });
  });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression, label = expression) {
    for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await pause(); }
    await writeFile(join(dir, "failure.txt"), String(await evaluate("document.body.innerText")));
    throw Error(`Timed out: ${label} (see ${dir})`);
  }
  const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
  async function click(text) {
    assert.equal(await evaluate(`(() => {const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)} && e.getClientRects().length && !e.disabled);if(!b)return false;b.click();return true;})()`), true, `Clickable: ${text}`);
  }
  async function fill(selector, value) {
    await evaluate(`(() => {const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing ${selector}');const proto=input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  }
  async function viewport(width) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: width === 390 ? 844 : 1000, deviceScaleFactor: 1, mobile: width === 390 });
  }
  async function shot(name) {
    const result = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(join(dir, `${name}.png`), Buffer.from(result.data, "base64"));
    assert.equal(await evaluate("document.documentElement.scrollWidth <= window.innerWidth"), true, `${name}: no horizontal scroll`);
  }
  async function open(url, ready) { await command("Page.navigate", { url }); await wait(ready); await evaluate("document.fonts.ready.then(()=>true)"); }
  async function signIn(role) {
    await open(`${web}/`, "document.readyState==='complete'");
    await evaluate(`sessionStorage.setItem('watuagung-staff-token', ${JSON.stringify(tokens[role])}), true`);
  }
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");

  // 1. Kepala Desa: email notifikasi → tautan verifikasi dari log → /verifikasi-email/ di ponsel.
  let since = await logSize();
  await http("/staff/me/notifications", { role: "village_head", method: "PUT", body: { email: HEAD_EMAIL } });
  const verifyLink = await lastLink("/verifikasi-email/", since);
  await viewport(390);
  // Tombol hanya muncul setelah komponen membaca dan menghapus query (judul statis memuat teks yang sama).
  await open(verifyLink, "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Konfirmasi email')");
  assert.equal(await evaluate("location.search"), "", "verification query removed from address bar");
  assert.equal(await evaluate("document.querySelector('meta[name=referrer]')?.content"), "no-referrer");
  await shot("01-verifikasi-email-390");
  await click("Konfirmasi email");
  await wait(hasText("Email terkonfirmasi"));
  await shot("02-email-terkonfirmasi-390");

  // 2. Atur PIN lewat panel (menu Akun → Notifikasi email), 1440px dan 390px.
  await signIn("village_head");
  await viewport(1440);
  await open(`${web}/admin/notifikasi/`, hasText("Persetujuan lewat email"));
  assert.ok(await evaluate(hasText("Terverifikasi")));
  assert.ok(await evaluate(hasText("PIN diminta setiap menyetujui lewat email. Jangan bagikan.")));
  await shot("03-notifikasi-1440");
  await fill("input[autocomplete=new-password]", "123456");
  await evaluate(`(() => {const inputs=[...document.querySelectorAll('input[autocomplete=new-password]')];const set=(i,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,v);i.dispatchEvent(new Event('input',{bubbles:true}));};set(inputs[1],'123456');set(document.querySelector('input[autocomplete=current-password]'),${JSON.stringify(credentials.village_head.password)});})()`);
  await click("Simpan PIN");
  await wait(hasText("PIN terlalu mudah ditebak"), "weak PIN rejected");
  await evaluate(`(() => {const inputs=[...document.querySelectorAll('input[autocomplete=new-password]')];const set=(i,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,v);i.dispatchEvent(new Event('input',{bubbles:true}));};set(inputs[0],'${PIN}');set(inputs[1],'${PIN}');set(document.querySelector('input[autocomplete=current-password]'),${JSON.stringify(credentials.village_head.password)});})()`);
  await click("Simpan PIN");
  await wait(hasText("PIN persetujuan disimpan."));
  assert.ok(await evaluate(hasText("Aktif")));
  await viewport(390);
  await shot("04-notifikasi-390");

  // 3. Staf mengajukan ke Kepala Desa → tautan dari log → buka di ponsel → setujui dengan PIN.
  since = await logSize();
  const first = await submitApplication("Warga Fiktif Satu");
  const approvalLink = await lastLink("/persetujuan/", since, (link) => !link.includes("pilih="));
  assert.ok(!approvalLink.includes("pilih="), "review button link");
  await evaluate("sessionStorage.clear(), true");
  await viewport(390);
  await open(approvalLink, hasText("Nomor pengajuan"));
  assert.equal(await evaluate("location.search"), "", "token removed from address bar");
  assert.equal(await evaluate("document.querySelector('meta[name=robots]')?.content.includes('noindex')"), true);
  assert.equal(await evaluate("document.querySelector('meta[name=referrer]')?.content"), "no-referrer");
  assert.equal(await evaluate("(() => {const i=document.querySelector('input[autocomplete=one-time-code]');return i?.inputMode==='numeric';})()"), true);
  assert.ok(await evaluate(hasText(first)));
  await shot("05-persetujuan-390");
  await evaluate("[...document.querySelectorAll('input[type=radio]')].find(i=>i.value==='approve').click(), true");
  await fill("input[autocomplete=one-time-code]", PIN);
  await click("Lanjutkan");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Yakin menyetujui?')", "confirm dialog");
  const buttonHeight = await evaluate("Math.min(...[...document.querySelectorAll('dialog[open] button')].map(b=>b.getBoundingClientRect().height))");
  assert.ok(buttonHeight >= 48, `dialog buttons >= 48px (${buttonHeight})`);
  await shot("06-konfirmasi-390");
  await click("Ya, setujui");
  await wait(hasText("Permohonan disetujui"));
  const detail = await http(`/staff/applications/${first}`);
  assert.equal(detail.status, "APPROVED");
  const number = detail.letter_numbers.find((entry) => entry.status === "issued").number;
  assert.ok(await evaluate(hasText(`Nomor surat: ${number}`)), "letter number shown");
  assert.equal(detail.history.find((event) => event.to_status === "APPROVED").via, "email");
  await shot("07-disetujui-390");

  // 4. Tautan dipakai lagi → tidak berlaku.
  await open(approvalLink, hasText("Tautan sudah tidak berlaku"));
  assert.ok(await evaluate(hasText("Masuk ke panel admin")));
  await shot("08-tidak-berlaku-390");

  // 5. Panel: riwayat "disetujui melalui email".
  await signIn("staff");
  await viewport(1440);
  await open(`${web}/admin/permohonan/detail/?id=${first}`, hasText("Riwayat status"));
  await wait(hasText("disetujui melalui email"));
  await shot("09-riwayat-panel-1440");

  // 6. Permohonan kedua (1440px): pilih=tolak dari email, PIN salah sekali, lalu tolak dengan alasan.
  since = await logSize();
  const second = await submitApplication("Warga Fiktif Dua");
  const rejectLink = await lastLink("/persetujuan/", since, (link) => link.endsWith("pilih=tolak"));
  await evaluate("sessionStorage.clear(), true");
  await open(rejectLink, hasText(second));
  assert.equal(await evaluate("document.querySelector('input[value=reject]').checked"), true, "pilih=tolak preselects reject");
  await shot("10-persetujuan-1440");
  await fill("input[autocomplete=one-time-code]", "000001");
  await click("Lanjutkan");
  await wait(hasText("Alasan penolakan wajib diisi."), "reason required before PIN");
  await fill("textarea", "Data domisili fiktif belum sesuai.");
  await click("Lanjutkan");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Yakin menolak?')");
  await click("Ya, tolak");
  await wait(hasText("PIN salah. Sisa 4 percobaan."));
  await fill("input[autocomplete=one-time-code]", PIN);
  await click("Lanjutkan");
  await wait("document.querySelector('dialog[open]')?.innerText.includes('Yakin menolak?')");
  await click("Ya, tolak");
  await wait(hasText("Permohonan ditolak"));
  assert.equal((await http(`/staff/applications/${second}`)).status, "REJECTED");
  await shot("11-ditolak-1440");

  // Token/tanda tangan tidak pernah dikirim sebagai Referer ke origin lain (API di sini lintas origin).
  // Same-origin: server dev Next tidak mengirim header Referrer-Policy dan <meta name="referrer"> baru berlaku
  // setelah di-parse, sehingga chunk awal bisa membawa Referer; di produksi header .htaccess/Nginx menutupnya.
  const tokenReferer = (entry) => entry.referer && /[?&]t=|signature=/.test(entry.referer);
  const leaked = requests.filter((entry) => tokenReferer(entry) && !entry.url.startsWith(web));
  assert.deepEqual(leaked, [], "no token/signature in cross-origin Referer");
  const sameOrigin = requests.filter((entry) => tokenReferer(entry) && entry.url.startsWith(web)).length;
  assert.equal(requests.filter((entry) => entry.url.startsWith(api) && /[?&]t=/.test(entry.url)).length, 0, "token never in API URL");
  console.log(`PASS: email approval E2E (${first} disetujui ${number}; ${second} ditolak). Same-origin dev requests with token Referer: ${sameOrigin}. Screenshots: ${dir}`);
} finally {
  socket?.close();
  chrome.kill();
}
