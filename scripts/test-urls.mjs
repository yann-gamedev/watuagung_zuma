import assert from "node:assert/strict";

// lib/urls.ts tanpa import dan hanya anotasi tipe: Node 24 menjalankannya langsung (type stripping).
const { adminHref, adminOrigin, isAbsoluteHref, siteHref, siteOrigin } = await import("../lib/urls.ts");

const warnings = [];
const warn = console.warn;
console.warn = (message) => warnings.push(String(message));
try {
  const site = "https://desa-fiktif.test";
  const admin = "https://admin.desa-fiktif.test";

  // Env kosong → relatif (dev lokal, demo Vercel, build tanpa subdomain).
  assert.equal(adminOrigin(""), null);
  assert.equal(adminOrigin(undefined), null);
  assert.equal(siteHref("/", null, null), "/");
  assert.equal(adminHref("/admin/", null), "/admin/");
  assert.equal(adminHref("/admin/notifikasi/", null), "/admin/notifikasi/");

  // NEXT_PUBLIC_SITE_URL sudah diisi untuk SEO: tanpa panel subdomain, tautan panel → situs tetap relatif.
  assert.equal(siteHref("/", siteOrigin(site), null), "/");

  // Kedua env terisi → absolut.
  assert.equal(adminOrigin(`${admin}/`), admin);
  assert.equal(siteHref("/", siteOrigin(site), adminOrigin(admin)), `${site}/`);
  assert.equal(siteHref("/berita/baca/?slug=a%20b", site, admin), `${site}/berita/baca/?slug=a%20b`);
  assert.equal(adminHref("/admin/", adminOrigin(admin)), `${admin}/admin/`);
  assert.equal(adminHref("/admin/notifikasi/", admin), `${admin}/admin/notifikasi/`);
  assert.ok(isAbsoluteHref(`${admin}/admin/`));
  assert.ok(!isAbsoluteHref("/admin/"));
  // Hanya panel di subdomain tanpa origin situs: relatif (admin.htaccess mengalihkan ke situs utama).
  assert.equal(siteHref("/", null, admin), "/");

  // Origin tidak valid → null + peringatan (sekali per nilai), tautan jatuh ke relatif.
  for (const bad of ["http://admin.desa-fiktif.test", "https://admin.desa-fiktif.test/admin", "https://u:p@admin.desa-fiktif.test",
    "https://admin.desa-fiktif.test/?x=1", "https://admin.desa-fiktif.test/#a", "javascript:alert(1)", "admin.desa-fiktif.test", "ftp://admin.desa-fiktif.test"]) {
    assert.equal(adminOrigin(bad), null, bad);
    assert.equal(adminHref("/admin/", adminOrigin(bad)), "/admin/", bad);
  }
  assert.ok(warnings.some((message) => message.startsWith("NEXT_PUBLIC_ADMIN_URL tidak valid")));
  const before = warnings.length;
  adminOrigin("http://admin.desa-fiktif.test");
  assert.equal(warnings.length, before, "peringatan nilai sama tidak diulang");
  // http hanya untuk localhost/127.0.0.1 (uji lokal dua port).
  assert.equal(adminOrigin("http://127.0.0.1:3011"), "http://127.0.0.1:3011");
  assert.equal(adminOrigin("http://localhost:3011"), "http://localhost:3011");

  // Path wajib diawali satu "/"; "//host" berarti origin lain.
  for (const bad of ["admin/", "", "https://evil.test/", "//evil.test/admin/"]) {
    assert.throws(() => adminHref(bad, admin), /diawali "\/"/, bad);
    assert.throws(() => siteHref(bad, site, admin), /diawali "\/"/, bad);
  }
} finally {
  console.warn = warn;
}
console.log("PASS: tautan lintas origin — env kosong relatif, SEO saja relatif, kedua env absolut, origin/path tidak valid ditolak.");
