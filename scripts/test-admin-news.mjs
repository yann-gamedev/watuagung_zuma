import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Compile actual source in memory, like test-demo.mjs; no generated files.
const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const modules = new Map();
function sourceUrl(path) {
  if (modules.has(path)) return modules.get(path);
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  }).outputText;
  for (const name of ["zod", "react/jsx-runtime"]) {
    code = code.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
  }
  if (code.includes('"@/types/posts"')) code = code.replaceAll('"@/types/posts"', JSON.stringify(sourceUrl("types/posts.ts")));
  code = code.replaceAll('"@/services/pelayanan"', JSON.stringify(dataUrl('export const apiBase = "https://api.example.test/api/v1";')));
  // ponytail: only Next Image is stubbed; browser image loading belongs in UI checks.
  code = code.replaceAll('"next/image"', JSON.stringify(dataUrl(`
    import { createElement } from ${JSON.stringify(import.meta.resolve("react"))};
    export default function Image({ src, alt }) { return createElement("img", { src, alt }); }
  `)));
  const url = dataUrl(code);
  modules.set(path, url);
  return url;
}
const { postCategories } = await import(sourceUrl("types/posts.ts"));
const { categoryLabels, postInputSchema, postSchema, postsPageSchema, parsePost, postDate } = await import(sourceUrl("features/admin/news-data.ts"));
const input = { title: "Judul contoh", category: "kegiatan_desa", summary: "Ringkasan contoh", body: "Isi contoh", status: "draft" };
assert.deepEqual(postInputSchema.parse(input), input);
for (const [field, max] of [["title", 160], ["summary", 300], ["body", 20000]]) {
  assert.equal(postInputSchema.safeParse({ ...input, [field]: "x".repeat(max) }).success, true, `${field}: max accepted`);
  assert.equal(postInputSchema.safeParse({ ...input, [field]: "x".repeat(max + 1) }).success, false, `${field}: max + 1 rejected`);
  for (const value of ["", " \r\n\t ", null, 123, undefined]) {
    assert.equal(postInputSchema.safeParse({ ...input, [field]: value }).success, false, `${field}: ${String(value)}`);
  }
  assert.equal(postInputSchema.parse({ ...input, [field]: "  Contoh \n" })[field], "Contoh");
}
assert.deepEqual(postCategories, ["kegiatan_desa", "pemerintahan", "pembangunan", "pemberdayaan", "layanan_publik", "ekonomi_lokal", "pengumuman"]);
assert.deepEqual(Object.keys(categoryLabels).sort(), [...postCategories].sort());
for (const category of postCategories) assert.equal(postInputSchema.safeParse({ ...input, category }).success, true);
for (const category of ["", "lainnya", "KEGIATAN_DESA", null]) assert.equal(postInputSchema.safeParse({ ...input, category }).success, false);
for (const status of ["draft", "published"]) assert.equal(postInputSchema.safeParse({ ...input, status }).success, true);
assert.equal(postInputSchema.safeParse({ ...input, status: "deleted" }).success, false);
const post = {
  ...input, id: 1, slug: "judul-contoh", category_label: "Kegiatan desa", cover_url: null,
  published_at: null, updated_at: "2026-10-29T10:00:00+07:00", created_at: "2026-10-29T03:00:00Z",
};
assert.deepEqual(parsePost(post), post);
for (const cover_url of [null, "http://localhost:8000/storage/cover.jpg", "https://example.test/cover.webp"]) {
  assert.equal(parsePost({ ...post, cover_url }).cover_url, cover_url);
}
for (const cover_url of ["javascript:alert(1)", "data:image/svg+xml,<svg/>", "file:///tmp/cover.jpg", "ftp://example.test/a.jpg", "//example.test/a.jpg", "/storage/a.jpg", "", 42]) {
  let result;
  assert.doesNotThrow(() => { result = postSchema.safeParse({ ...post, cover_url }); }, `safeParse must reject, not throw: ${String(cover_url)}`);
  assert.equal(result.success, false, String(cover_url));
  assert.throws(() => parsePost({ ...post, cover_url }), /Format berita tidak sesuai/);
}
for (const change of [{ id: 0 }, { id: 1.5 }, { id: "1" }, { category: "lainnya" }, { status: "deleted" }, { body: null }, { updated_at: "yesterday" }, { published_at: "invalid" }, { created_at: null }]) {
  assert.throws(() => parsePost({ ...post, ...change }), /Format berita tidak sesuai/);
}
const page = { data: [post], current_page: 1, last_page: 1, total: 1 };
assert.equal(postsPageSchema.safeParse(page).success, true);
for (const change of [{ data: [{ ...post, cover_url: "javascript:alert(1)" }] }, { current_page: 0 }, { last_page: 0 }, { total: -1 }]) {
  assert.equal(postsPageSchema.safeParse({ ...page, ...change }).success, false);
}
assert.equal(postDate(null), "Belum terbit");

const { adminRequest, AdminUnauthorizedError, AdminNetworkError, SESSION_EXPIRED_MESSAGE } = await import(sourceUrl("features/admin/api.ts"));
const originalFetch = globalThis.fetch;
const unauthorized = [];
const session = { token: "fictional-test-token", onUnauthorized: (token) => unauthorized.push(token) };
let calls = [];
let response;
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const multipart = new FormData();
multipart.append("file", new Blob(["fictional test image"], { type: "image/png" }), "sample.png");
try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (response instanceof Error) throw response;
    return response;
  };
  for (const body of [JSON.stringify(input), multipart]) {
    const path = body === multipart ? "/staff/posts/1/cover" : "/staff/posts";
    response = jsonResponse(post);
    assert.deepEqual(await adminRequest(session, path, { method: "POST", body, headers: { "X-Test": "news" } }), post);
    const call = calls.at(-1);
    const headers = new Headers(call.options.headers);
    assert.equal(call.url, `https://api.example.test/api/v1${path}`);
    assert.ok(!call.url.includes(session.token), "Token stays out of URL");
    assert.equal(call.options.body, body);
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.cache, "no-store");
    assert.ok(call.options.signal instanceof AbortSignal);
    assert.equal(headers.get("Authorization"), `Bearer ${session.token}`);
    assert.equal(headers.get("Accept"), "application/json");
    assert.equal(headers.get("X-Test"), "news");
    assert.equal(headers.get("Content-Type"), body === multipart ? null : "application/json", "Browser must set multipart boundary");

    response = jsonResponse({ message: "Ignored unauthorized server message" }, 401);
    const before = unauthorized.length;
    await assert.rejects(adminRequest(session, path, { method: "POST", body }), (error) => {
      assert.ok(error instanceof AdminUnauthorizedError);
      assert.equal(error.message, SESSION_EXPIRED_MESSAGE);
      return true;
    });
    assert.equal(unauthorized.length, before + 1, "401 callback runs exactly once");
    assert.equal(unauthorized.at(-1), session.token);

    for (const [status, payload, message] of [
      [403, { message: "Berita tidak boleh diubah oleh akun ini." }, "Berita tidak boleh diubah oleh akun ini."],
      [404, { message: "Berita contoh tidak ditemukan." }, "Berita contoh tidak ditemukan."],
      [422, { message: "Validasi gagal.", errors: { title: ["Judul wajib diisi."], file: ["Foto maksimal 3 MB.", "Lebar foto minimal 600 piksel."] } }, "Judul wajib diisi. Foto maksimal 3 MB. Lebar foto minimal 600 piksel."],
      [500, { message: "Penyimpanan foto gagal. Coba lagi." }, "Penyimpanan foto gagal. Coba lagi."],
    ]) {
      response = jsonResponse(payload, status);
      await assert.rejects(adminRequest(session, path, { method: "POST", body }), { message });
      assert.equal(unauthorized.length, before + 1, `${status} must not clear session`);
    }
  }
  for (const path of ["/staff/posts", "/staff/posts?status=draft", "/staff/posts/1/cover"]) {
    response = new Response("not JSON", { status: 502 });
    await assert.rejects(adminRequest(session, path), { message: "Berita gagal diproses. Coba lagi nanti." });
  }
  response = jsonResponse({ message: "Internal model detail" }, 404);
  await assert.rejects(adminRequest(session, "/staff/posts-other"), { message: "Permohonan tidak ditemukan. Periksa nomor atau kembali ke daftar." });
  const before = unauthorized.length;
  for (const error of [new TypeError("fetch failed"), new DOMException("aborted", "AbortError")]) {
    response = error;
    await assert.rejects(adminRequest(session, "/staff/posts"), (cause) => {
      assert.ok(cause instanceof AdminNetworkError);
      assert.match(cause.message, error.name === "AbortError" ? /Waktu tunggu habis/ : /Server belum dapat dihubungi/);
      return true;
    });
    assert.equal(unauthorized.length, before, "Network failure must not clear session");
  }
} finally {
  globalThis.fetch = originalFetch;
}

const { NewsArticle } = await import(sourceUrl("components/news-article.tsx"));
const render = (props, children) => renderToStaticMarkup(createElement(NewsArticle, props, children));
const attack = '<script>alert("contoh")</script><img src=x onerror="alert(1)"> &';
const html = render({ summary: attack, body: `${attack}\n\nParagraf dua\nmasih paragraf dua\r\n \t\r\nParagraf tiga\n\n  \n\n` });
assert.ok(html.startsWith('<article class="article-body">'));
assert.ok(!html.includes("<script"));
assert.ok(!html.includes("<img"));
assert.ok(html.includes("&lt;script&gt;alert(&quot;contoh&quot;)&lt;/script&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;"));
assert.equal((html.match(/<p(?:\s|>)/g) ?? []).length, 4, "One summary and three nonempty body paragraphs");
assert.ok(html.includes("<p>Paragraf dua\nmasih paragraf dua</p>"), "Single newline stays within paragraph");
assert.ok(html.includes("<p>Paragraf tiga</p>"), "CRLF plus whitespace splits paragraphs");
assert.ok(!html.includes("Artikel contoh"));
assert.ok(!html.includes("article-endnote"));
assert.ok(!html.includes("<figure"));
const empty = render({ summary: "Ringkasan contoh", body: " \n\n \t " });
assert.equal((empty.match(/<p(?:\s|>)/g) ?? []).length, 1, "Whitespace-only body adds no paragraphs");
const covered = render({ summary: "Ringkasan contoh", body: "Isi contoh", coverUrl: "https://example.test/cover.jpg" });
assert.ok(covered.includes('src="https://example.test/cover.jpg"'));
assert.ok(covered.includes('alt="Foto sampul berita"'));
assert.ok(!covered.includes("Foto ilustrasi"));
const sample = render({ summary: "Ringkasan contoh", body: "Isi contoh", sample: true, coverUrl: "https://example.test/ignored.jpg" }, createElement("footer", null, "Anak contoh"));
for (const text of ["Artikel contoh", "Bukan laporan kegiatan resmi dan belum diverifikasi.", "Foto ilustrasi suasana pertanian desa, bukan dokumentasi kegiatan dalam artikel.", "Informasi dalam artikel contoh ini perlu dikonfirmasi melalui kanal resmi desa.", 'src="/village.jpg"', 'alt="Petani menanam padi di sawah"', "<footer>Anak contoh</footer>"]) {
  assert.ok(sample.includes(text), text);
}
assert.ok(!sample.includes("https://example.test/ignored.jpg"), "Sample uses illustration, not CMS cover");
console.log("PASS: news validation limits/categories/response URLs, adminRequest JSON/multipart/401/server errors/network isolation, NewsArticle text escaping/paragraphs/sample content.");
