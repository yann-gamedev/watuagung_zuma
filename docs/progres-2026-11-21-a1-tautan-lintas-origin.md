# Progres 21 November 2026 — A1 tautan lintas origin (panel di subdomain)

Branch `feat/web-cross-origin-links` dari `main` @ `e0eaf4b` (setelah PR #109, SEO, dan #111). Rencana: `docs/PROMPTS-ADMIN-SUBDOMAIN.md` § 5.1, disetujui pengguna sebelum dikerjakan.

## Lingkup

- `lib/urls.ts`: parser origin dipakai bersama oleh `siteOrigin()` (SEO, pesan peringatan tidak berubah) dan `adminOrigin()` baru (`NEXT_PUBLIC_ADMIN_URL`). Ditambah `siteHref(path)`, `adminHref(path)`, dan `isAbsoluteHref()`. Path wajib diawali satu `/` (`//host` ditolak).
- **Keputusan dalam sesi:** `siteHref` hanya absolut bila **kedua** env terisi. `NEXT_PUBLIC_SITE_URL` sudah diisi build produksi untuk SEO; tanpa aturan ini, "Lihat website" di panel akan berubah menjadi tab baru sejak deploy berikutnya padahal panel masih di domain utama.
- Lima tautan:
  - `shell.tsx` "Lihat website": bila lintas origin, `<a>` tab baru + `noopener noreferrer` + teks pembaca layar "(dibuka di tab baru)"; selain itu `Link` seperti semula;
  - `news-editor.tsx` dan `business-editor.tsx` "Lihat di website": `href` melalui `siteHref` (sudah `<a>` tab baru);
  - `approval-page.tsx` "Masuk ke panel admin" dan `verify-email.tsx` "Buka pengaturan notifikasi": `adminHref`; bila lintas origin, `<a>` biasa di tab yang sama.
- `scripts/test-urls.mjs` (baru, bagian dari `test:demo`): env kosong → relatif; SEO saja → relatif; kedua env → absolut; 8 origin tidak valid → relatif + peringatan sekali; http localhost diterima; 4 path tidak valid → error.
- `README.md` (§ Frontend: tabel dua env, aturan mode S), `.env.production.example` (`NEXT_PUBLIC_ADMIN_URL=` kosong), `deploy/hostinger.md` § N langkah 3 (build mode S saja).

Tanpa `NEXT_PUBLIC_ADMIN_URL`, tampilan dan perilaku sama seperti sebelumnya. Tidak ada perubahan route, layout, warna, atau backend.

## Verifikasi yang dijalankan

| Perintah | Hasil |
|---|---|
| `npm run lint` | 0 error, 1 warning lama (`LembagaList.tsx` `<img>`) |
| `npx tsc --noEmit` | lulus |
| `npm run build`, `npm run build:demo` | lulus |
| `npm run test:demo` (termasuk `test-urls.mjs`) | PASS |
| `npm run test:approval`, `npm run test:seo` | PASS |
| `npm run test:no-sample` | gagal sekali karena unduhan font Google (`next/font/google` module-not-found), PASS saat diulang tanpa perubahan |
| Build dengan `NEXT_PUBLIC_SITE_URL` + `NEXT_PUBLIC_ADMIN_URL` (domain fiktif) | origin admin ada di 4 file `out/`, termasuk HTML `/verifikasi-email/`; tombol persetujuan dirender klien sehingga ada di chunk JS |
| Build dengan `NEXT_PUBLIC_SITE_URL` saja | origin admin tidak muncul (0 file) |

Tidak dicek visual di browser (390/1440 px). Perubahan hanya `href`/elemen tautan; tampilan tombol memakai kelas yang sama.

## Sisa

- Deploy mode S (manusia): `FRONTEND_ORIGINS` server memuat `https://admin.desawatuagung.com`, build dengan kedua env, `ADMIN_PUBLIC_HTML=…/public_html/panel-admin`, `ADMIN_ORIGIN=https://admin.desawatuagung.com` (`deploy/hostinger.md` § N).
- Pembekuan rilis 22 November: perubahan ini tidak mengubah apa pun selama `NEXT_PUBLIC_ADMIN_URL` kosong, tetapi tetap disarankan di-merge setelah deploy 22 November.
- `docs/integrasi.md` belum mencatat `NEXT_PUBLIC_ADMIN_URL` (Z3).
