# Progres 21 November 2026 — deploy panel di subdomain (A2)

Branch `feat/admin-subdomain-deploy`, dibuat dari `chore/preflight-check` (PR #109, belum di-merge), karena tugas 1 mengubah `app:preflight` yang hanya ada di PR itu. Rencana: `docs/PROMPTS-ADMIN-SUBDOMAIN.md`; prompt sesi mengalahkan rencana bila bertentangan. `docs/integrasi.md` tidak disunting (Z3).

## Lingkup

- **Preflight:** host `FRONTEND_ORIGINS` boleh sama dengan host `APP_URL` atau subdomain langsungnya (https wajib). `APP_URL`/`SITE_URL`/`LETTER_VERIFY_URL` tetap satu host. Ditolak: `desa.test.evil.test`, `evil.test`, subdomain dua tingkat, `evildesa.test`, panel http.
- **`deploy/hostinger-sync.sh` (baru):** logika pemasangan dipisah dari `hostinger-deploy.sh` agar bisa diuji. Isinya resolusi mode L/P/S, validasi path/origin, render kedua `.htaccess`, dan sinkronisasi. Di-source sebelum checkout. Urutan langkah deploy tidak berubah.
- **`.htaccess` utama:** blok `# BEGIN/END admin-subdomain` sebelum `/api/`. Aturannya ditulis sebagai komentar `#@nested`/`#@redirect` yang diaktifkan skrip, sehingga salinan mentah oleh skrip lama di server tetap aman. Mode L menghapus blok beserta baris kosong sesudahnya; hasilnya **byte-identik** dengan `.htaccess` sebelum fitur (dicek `cmp`).
- **`deploy/hostinger/admin.htaccess` (baru):** `RewriteEngine On` sendiri; HTTPS/ACME/dotfile/PHP diulang; **tolak host selain panel**; `^api` → 403; `^$` → `/admin/` (302); non-panel → situs utama (302, query ikut); header ditimpa `always set` (HSTS, nosniff, Referrer-Policy same-origin, XFO DENY, X-Robots-Tag noindex/nofollow, CSP Report-Only); `unset Content-Security-Policy`; Basic Auth dikomentari.
- **`hostinger-deploy.sh`:** `ADMIN_PUBLIC_HTML`/`ADMIN_ORIGIN` opsional, divalidasi sebelum maintenance. Validasi PHP konfigurasi kini juga menolak `ADMIN_ORIGIN` yang tidak ada di `FRONTEND_ORIGINS`. Smoke test dipanggil dengan `--admin`/`--admin-dir`.
- **`smoke-test.sh`:** `--admin <host>` dan `--admin-dir <folder>` dengan pemeriksaan § 5.3 no. 4 rencana, ditambah: tepat satu CSP Report-Only, folder bersarang 403/404, query redirect, CORS preflight origin panel/asing. Diperbaiki juga: `header_value` tanpa header tidak lagi mematikan skrip di bawah `pipefail`.
- **Tes:** `PanelOriginCorsTest` (preflight dan request nyata; origin panel diizinkan; empat origin asing tanpa ACAO); `AppPreflightTest` +8 kasus; `deploy/test-scripts.sh` diperluas (rincian di bawah).
- **Dokumen:** `backend/.env.production.example` (`FRONTEND_ORIGINS` dua origin), `deploy/hostinger.md` (§ N baru, § F/I/J, pra-rilis, § M, daftar periksa; baris `SITE_URL` di tabel § M yang rusak dari PR #109 ikut diperbaiki), `docs/deploy-plan.md` (D1–D7).

## Penyimpangan dari prompt (perlu persetujuan)

1. **CSP panel `connect-src 'self' __SITE_ORIGIN__`**, bukan hanya `__SITE_ORIGIN__`. Navigasi static export Next.js mengambil payload `*.txt` dari origin sendiri; tanpa `'self'`, laporan Report-Only akan penuh dan penegakan di A4 merusak navigasi.
2. **Blok folder bersarang memakai `[F]` (403)**, bukan `R=404`. Dukungan `R=404` di LiteSpeed tidak pasti; `ErrorDocument 403 /404.html` tetap menampilkan halaman 404.
3. **Mode S mengisi subdomain lebih dulu**, lalu situs utama, agar redirect `/admin` baru aktif setelah panel ada. Prompt menulis urutan utama → subdomain.
4. Tambahan: mode S tanpa `--frontend` memasang ulang `admin.htaccess` saja dan tidak menghapus `admin/` utama (redirect tetap aktif). Arsip mode S wajib berisi `admin/index.html`.

## Diff `.htaccess` utama per mode (terhadap sebelum fitur)

- **L:** tidak ada perbedaan (byte-identik).
- **P bersarang (`public_html/panel`):** blok komentar + `RewriteRule ^panel(/|$) - [F]`.
- **P sejajar:** blok komentar saja, tanpa aturan aktif.
- **S bersarang:** `RewriteRule ^panel(/|$) - [F]` + `RewriteRule ^admin(/.*)?$ https://panel.desawatuagung.com/admin$1 [R=302,L]`.
- **S sejajar:** hanya aturan redirect.

Semua aturan berada setelah blok PHP dan sebelum `RewriteRule ^api/ laravel.php [L]`.

## Verifikasi yang dijalankan

| Perintah | Hasil |
|---|---|
| `bash -n` semua `deploy/*.sh` | lulus |
| `shellcheck` | tidak tersedia di mesin ini; tidak dijalankan |
| `bash deploy/test-scripts.sh` | LULUS: sinkronisasi L/P/S bersarang+sejajar, mode L identik dengan logika lama (`diff -r`), 20 validasi path/origin, smoke `--admin` lulus + 9 fault ditolak + 4 argumen salah, deploy penuh mode S (dua rsync, urutan tetap), 3 penolakan sebelum maintenance, origin luar domain gagal tertutup, semua tes lama |
| `php artisan test` (SQLite) | 571 lulus, 25.613 assertions |
| `php artisan test --env=testing.mysql` (MariaDB lokal) | 571 lulus, 25.615 assertions |
| Frontend (`lint`, `tsc`, `build`, `build:demo`, `test:demo`, `test:no-sample`) | lint 0 error (1 warning lama), tsc, build, test:demo, test:no-sample lulus; build:demo gagal sekali karena unduhan font Google (module-not-found `next/font/google`), lulus saat diulang tanpa perubahan |

**Batas uji:** rsync tidak ada di Git Bash lokal. Tes sinkronisasi memakai emulator kecil di `test-scripts.sh` (hanya `-a`, `--delete`, `--exclude=/<nama>/`), dan rsync asli dipakai otomatis bila tersedia. Uji symlink-ke-docroot dilewati karena `ln -s` di Git Bash menyalin. Aturan `.htaccess` (LiteSpeed) dan perilaku header bersarang **belum** diuji di server; smoke test `--admin` di A3 adalah bukti pertamanya. PostgreSQL tidak dijalankan (service lokal berhenti).

## Sisa dan keputusan

- D5 (halaman persetujuan tetap di domain utama) belum dikonfirmasi Tech Lead; prompt tidak membahasnya.
- Setelah subdomain dibuat, deploy mode L menghapus docroot bersarang. Operator wajib memakai `ADMIN_PUBLIC_HTML`, dan ini tertulis tebal di § I/§ N.
- PR ini bertumpuk di atas PR #109; merge #109 lebih dulu.
- Sesi A1 (tautan lintas origin di frontend) belum ada di branch ini.
