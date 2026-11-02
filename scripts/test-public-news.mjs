import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Compile real sources recursively; mode tags isolate every data URL from ESM's cache.
async function source(mode, entry = "services/posts.ts") {
  const modules = new Map();
  function url(path) {
    if (modules.has(path)) return modules.get(path);
    let code = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: path,
    }).outputText;
    code = code.replace(/(["'])(@\/[^"']+|zod|react\/jsx-runtime)\1/g, (_match, _quote, name) => {
      if (!name.startsWith("@/")) return JSON.stringify(import.meta.resolve(name));
      const path = name.slice(2);
      return JSON.stringify(url(existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`));
    });
    const result = `data:text/javascript;base64,${Buffer.from(`${code}\n//# sourceURL=${path}?mode=${mode}\n`).toString("base64")}`;
    modules.set(path, result);
    return result;
  }
  return import(url(entry));
}

const envKeys = ["NEXT_PUBLIC_DEMO_MODE", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SHOW_SAMPLE_CONTENT"];
const savedEnv = envKeys.map((key) => process.env[key]);
const savedGlobals = { fetch: globalThis.fetch, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const apiBase = "https://api.example.test/api/v1";
const slug = "contoh /?&#é";
const post = {
  slug, title: "Berita uji fiktif", category: "kegiatan_desa", category_label: "Kegiatan Desa",
  summary: "Ringkasan uji", published_at: "2026-10-31T18:00:00+00:00", cover_url: "https://media.example.test/cover.webp",
};
const detail = { ...post, body: "Paragraf satu.\n\nParagraf dua." };
const page = { data: [post], current_page: 2, last_page: 3, total: 3 };
const timers = new Map();
const calls = [];
function reply(body, status = 200) {
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.cache, "no-store");
    assert.deepEqual(options.headers, { Accept: "application/json" });
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
}
function mode(demo, sample, api = apiBase) {
  process.env.NEXT_PUBLIC_DEMO_MODE = demo;
  process.env.NEXT_PUBLIC_SHOW_SAMPLE_CONTENT = sample;
  process.env.NEXT_PUBLIC_API_URL = api;
}
const zodError = (error) => error.name === "ZodError" && error.issues.length > 0;

try {
  globalThis.fetch = () => { throw new Error("Demo must not call fetch"); };
  mode("true", "true");
  const demo = await source("demo-stale-api");
  assert.ok(demo.initialNewsPage.data.length > 0);
  assert.deepEqual(await demo.listPosts(), demo.initialNewsPage);
  for (const item of demo.initialNewsPage.data) {
    assert.equal(item.sample, true);
    assert.equal(item.coverUrl, null);
    assert.deepEqual(await demo.getPost(item.slug), item);
    assert.ok(item.body.length > 0);
  }
  assert.deepEqual((await demo.listPosts(2)).data, []);
  assert.equal((await demo.listPosts(2)).current_page, 2);
  assert.equal(await demo.getPost("tidak-ada"), null);
  assert.equal(await demo.getPost("  "), null);
  assert.equal(demo.newsHref(slug), `/berita/${encodeURIComponent(slug)}/`);

  mode("true", "false");
  const empty = await source("demo-no-sample");
  assert.deepEqual(empty.initialNewsPage, { data: [], current_page: 1, last_page: 1, total: 0 });
  assert.deepEqual(await empty.listPosts(), empty.initialNewsPage);
  assert.equal(await empty.getPost(demo.initialNewsPage.data[0].slug), null);
  mode("false", "false", "  ");
  assert.deepEqual((await (await source("no-api-no-sample")).listPosts()).data, []);

  // No wall-clock wait: capture and fire only the service's 20-second timeout.
  globalThis.setTimeout = (callback, delay) => {
    assert.equal(delay, 20000);
    const timer = {};
    timers.set(timer, callback);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { assert.ok(timers.delete(timer), "Request must clear its timer"); };
  mode("false", "false", ` ${apiBase}/ `);
  const api = await source("api-no-sample");
  assert.equal(api.initialNewsPage, null);
  assert.equal(api.newsHref(slug), `/berita/baca/?slug=${encodeURIComponent(slug)}`);
  reply(page);
  const result = await api.listPosts(2);
  assert.deepEqual(result, {
    ...page, data: [{ slug, title: post.title, category: post.category_label, summary: post.summary,
      date: "1 November 2026", coverUrl: post.cover_url, sample: false }],
  });
  assert.equal(calls.at(-1).url, `${apiBase}/posts?page=2`);
  reply({ ...page, current_page: 1 });
  assert.equal((await api.listPosts()).current_page, 1);
  assert.equal(calls.at(-1).url, `${apiBase}/posts?page=1`);
  reply(detail);
  assert.deepEqual(await api.getPost(slug), { ...result.data[0], body: detail.body });
  assert.equal(calls.at(-1).url, `${apiBase}/posts/${encodeURIComponent(slug)}`);
  for (const cover_url of [null, "http://media.example.test/cover.jpg"]) {
    reply({ ...detail, cover_url });
    assert.equal((await api.getPost(slug)).coverUrl, cover_url);
  }
  const beforeInvalid = calls.length;
  for (const invalid of [0, -1, 1.5, NaN, Infinity, "1", null, false]) {
    await assert.rejects(api.listPosts(invalid), zodError);
    await assert.rejects(demo.listPosts(invalid), zodError);
  }
  assert.equal(await api.getPost(" \n "), null);
  assert.equal(calls.length, beforeInvalid, "Invalid input must not fetch");

  for (const bad of [null, {}, { ...post, slug: "" }, { ...post, title: "" },
    { ...post, category: "unknown" }, { ...post, published_at: "yesterday" },
    { ...post, summary: 5 }, { ...post, category_label: "" },
    ...["javascript:alert(1)", "data:image/png;base64,AAAA", "file:///cover.jpg"].map((cover_url) => ({ ...post, cover_url }))]) {
    reply({ ...page, data: [bad] });
    await assert.rejects(api.listPosts(), zodError);
    reply(bad === null ? null : { ...bad, body: detail.body });
    await assert.rejects(api.getPost(slug), zodError);
  }
  // Malformed URLs fail through Zod, without URL constructor exceptions.
  for (const cover_url of ["//evil.test/a", "/cover.jpg", "not a URL"]) {
    reply({ ...page, data: [{ ...post, cover_url }] });
    await assert.rejects(api.listPosts(), zodError);
    reply({ ...detail, cover_url });
    await assert.rejects(api.getPost(slug), zodError);
  }
  for (const bad of [null, {}, { ...page, data: {} }, { ...page, current_page: 0 },
    { ...page, last_page: 1.5 }, { ...page, total: -1 }]) {
    reply(bad);
    await assert.rejects(api.listPosts(), zodError);
  }
  for (const bad of [post, { ...detail, body: 42 }]) {
    reply(bad);
    await assert.rejects(api.getPost(slug), zodError);
  }
  reply(null, 404);
  assert.equal(await api.getPost(slug), null);
  await assert.rejects(api.listPosts(), /Berita belum dapat dimuat/);
  for (const status of [401, 403, 429, 500]) {
    reply({ message: "Internal error must not leak" }, status);
    await assert.rejects(api.listPosts(), /^Error: Berita belum dapat dimuat$/);
    await assert.rejects(api.getPost(slug), /^Error: Berita belum dapat dimuat$/);
  }
  const networkError = new TypeError("Network unavailable");
  globalThis.fetch = async () => { throw networkError; };
  await assert.rejects(api.listPosts(), (error) => error === networkError);
  await assert.rejects(api.getPost(slug), (error) => error === networkError);
  assert.equal(timers.size, 0);
  for (const load of [() => api.listPosts(), () => api.getPost(slug)]) {
    let signal;
    globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
      signal = options.signal;
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
    const pending = load();
    const rejected = assert.rejects(pending, /^Error: Waktu tunggu habis\. Coba lagi\.$/);
    assert.equal(timers.size, 1);
    assert.equal(signal.aborted, false);
    [...timers.values()][0]();
    await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(timers.size, 0);
  }
  mode("false", "true");
  const withSamples = await source("api-with-sample-flag");
  assert.equal(withSamples.initialNewsPage, null);
  reply({ ...page, data: [], total: 0 });
  assert.deepEqual((await withSamples.listPosts()).data, [], "API empty response must not fall back to samples");
  reply(detail);
  assert.equal((await withSamples.getPost(slug)).sample, false);
  assert.equal(timers.size, 0);
  const { NewsArticle } = await source("render-article", "features/news/news-article.tsx");
  const { NewsCover } = await source("render-cover", "components/news-cover.tsx");
  const title = 'Judul <uji> & "foto"';
  const escapedTitle = "Judul &lt;uji&gt; &amp; &quot;foto&quot;";
  const articleProps = { title, summary: "Ringkasan <b>uji</b>", coverUrl: post.cover_url };
  for (const newline of ["\n", "\r\n"]) {
    const body = `${newline} \t${newline}<script>alert("uji")</script>${newline} \t${newline}Paragraf & dua${newline}baris lanjut${newline}${newline} \t${newline}${newline}`;
    const html = renderToStaticMarkup(createElement(NewsArticle, { ...articleProps, body }));
    assert.doesNotMatch(html, /<script\b/i, "Article body must render text, never script elements");
    assert.match(html, /&lt;script&gt;alert\(&quot;uji&quot;\)&lt;\/script&gt;/);
    assert.match(html, /Ringkasan &lt;b&gt;uji&lt;\/b&gt;/);
    const copy = html.match(/<div class="article-copy">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(copy, "Article must render its body");
    assert.deepEqual([...copy.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((match) => match[1]), [
      "&lt;script&gt;alert(&quot;uji&quot;)&lt;/script&gt;", `Paragraf &amp; dua${newline}baris lanjut`,
    ], "LF/CRLF whitespace-only blank lines split paragraphs; empty paragraphs disappear");
  }
  for (const sample of [undefined, false, true]) {
    const html = renderToStaticMarkup(createElement(NewsArticle, { ...articleProps, body: "Isi uji", sample }));
    assert.equal(html.includes("article-sample-notice"), sample === true);
    assert.equal(html.includes("Konten contoh"), sample === true);
    assert.equal(html.includes("Bukan laporan kegiatan resmi"), sample === true);
    assert.match(html, /class="news-cover article-image-frame"/);
    assert.ok(html.includes(`<img src="${post.cover_url}" alt="${escapedTitle}" loading="lazy"/>`));
    assert.doesNotMatch(html, /data-nimg|srcSet=|\/_next\/image/, "Cover must use native lazy img");
  }
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.news-cover\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9\s*;/, "Cover class must preserve 16:9 ratio");
  const cover = renderToStaticMarkup(createElement(NewsCover, { title, url: post.cover_url }));
  assert.match(cover, /class="news-cover /);
  assert.ok(cover.includes(`<img src="${post.cover_url}" alt="${escapedTitle}" loading="lazy"/>`));
  for (const index of [0, 1, 2, 3]) {
    const pattern = renderToStaticMarkup(createElement(NewsCover, { title, url: null, index, className: "article-image-frame" }));
    assert.equal(pattern, `<div class="news-cover news-art art-${index % 3} article-image-frame" aria-hidden="true"></div>`);
    assert.doesNotMatch(pattern, /<img\b|placeholder|FOTO|Judul/i);
  }
  const noCoverArticle = renderToStaticMarkup(createElement(NewsArticle, { title, summary: "Ringkasan", body: "Isi uji" }));
  assert.match(noCoverArticle, /class="news-cover news-art art-0 article-image-frame" aria-hidden="true"/);
  assert.doesNotMatch(noCoverArticle, /<img\b|placeholder|\[FOTO/i);
  console.log("PASS: public news demo/API isolation, sample flags, Zod validation, safe covers, pagination, encoded slugs, no-store, HTTP/network errors, 404, 20s timeout cleanup, escaped article paragraphs, sample notice, native lazy covers and decorative patterns.");
} finally {
  Object.assign(globalThis, savedGlobals);
  envKeys.forEach((key, index) => {
    if (savedEnv[index] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[index];
  });
}
