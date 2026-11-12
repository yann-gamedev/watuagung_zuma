# Progres 13 November 2026 — deploy pertama ke Hostinger (desawatuagung.com)

## Lingkup

- Deploy `main` @ `6f6ae04` ke Hostinger Web Hosting Premium, domain `desawatuagung.com`, untuk uji dengan **data fiktif**. Bukan go-live warga.
- Branch dokumentasi `fix/hostinger-deploy-notes`: perbaikan pola smoke test dan temuan server di `deploy/hostinger.md`.

## Dikerjakan

- **API Hostinger (plugin resmi):** website kosong `desawatuagung.com` dibuat (akun `u892368764`, order Premium). SSL lifetime sudah aktif dengan redirect HTTPS platform; CDN dimatikan sampai uji selesai; PHP 8.3.36, `expose_php` dan `display_errors` Off. Cron: `0 17` prune token, `5 17` retensi, `0 19` backup (UTC).
- **Pengguna (hPanel/SSH):** database `u892368764_watuagung`; `DB_PASSWORD` diisi; `APP_KEY` disalin; `migrate`, `site:import-defaults`, `staff:create` admin.
- **SSH (agent, dengan izin pengguna):** clone repo ke `~/watuagung`; `composer install --no-dev`; `.env` produksi dari contoh (domain, nama DB/user; kata sandi oleh pengguna), mode 600; `key:generate` sekali (tidak ditampilkan); izin `storage`; `~/bin/composer-cli`; `~/.my.cnf` disalin dari konfigurasi Laravel tanpa menampilkan kata sandi; passphrase backup acak di `~/.config/watuagung/backup-passphrase`; `~/bin/watuagung-backup.sh`; `hostinger-deploy.sh main --frontend` (arsip build `8629415`, frontend identik dengan `main`).

## Temuan server

- `disable_functions` Hostinger memuat `proc_open` (web dan CLI): Composer gagal → pembungkus `php -d disable_functions=` khusus CLI. `schedule:run` tidak dapat menjalankan tugas → dua tugas harian dipasang langsung di cron.
- Perintah cron maksimal 255 karakter → skrip pembungkus backup.
- MariaDB server **11.8.9** (uji lokal 13 November memakai 11.4.8).
- Smoke test: pola path Windows `[A-Z]:[\/]` dengan flag `i` cocok dengan `http://` pada `404.html` statis (respons 403 untuk `/api/../.env`). Diperbaiki dengan lookbehind huruf; `test-scripts.sh` tetap mendeteksi `C:\inetpub`.

## Verifikasi yang dijalankan

- Server: 20 migration `Ran`, 0 pending; 1 admin; 5 bagian situs; `db:show` MariaDB 11.8.9.
- `hostinger-deploy.sh`: semua langkah sampai pemasangan `public_html` selesai; smoke test di server 32/33 (gagal hanya false positive di atas). Setelah perbaikan: `bash deploy/smoke-test.sh desawatuagung.com` dari laptop **33/33 lulus**; `bash deploy/test-scripts.sh` lulus.
- Dari luar: HTTP → 301 HTTPS; `/`, `/pelayanan/`, `/verifikasi/`, `/admin/`, `/kebijakan-privasi/` 200; halaman tidak ada 404; `/.env`, `/.htaccess`, `/laravel.php`, `/storage/`, `/storage/x.php`, `/default.php` 403; `/backend/` 404. Header HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, CSP Report-Only ada; HTML `no-cache`; `_next/static` `immutable` + gzip; API CORS hanya `https://desawatuagung.com`.
- `/storage/` lewat symlink `SymLinksIfOwnerMatch` di LiteSpeed: berkas uji 200, `nosniff`, `max-age=604800`; berkas uji dihapus.
- `sanctum:prune-expired` dan `applications:purge --dry-run` berjalan (retensi nonaktif). Backup manual dan lewat pembungkus: 2 arsip `.tar.gpg`, uji dekripsi di skrip lulus.
- Belum diuji: alur pengajuan fiktif sampai PDF/QR di browser, login admin di browser, unggah foto (GD), tampilan 390px/1440px, CSP di console, pemulihan backup.

## Sisa pekerjaan / keputusan

- Pengguna: ganti kata sandi SSH/hPanel (tercatat di chat), pakai login kunci SSH; simpan passphrase backup terpisah dari `APP_KEY`; hapus website sementara `white-quetzal-246586.hostingersite.com` bila tidak dipakai.
- Ulangi suite + uji penomoran pada MariaDB 11.8; merge `test/mysql-hostinger` dan `fix/hostinger-deploy-notes`, lalu `git pull` di server.
- Uji browser end-to-end dengan data fiktif; nyalakan CDN setelahnya bila diinginkan.
- Go-live tetap menunggu: kop/nomor surat resmi (F9b), keputusan query string di log (§ K), salinan backup di luar Hostinger, masa retensi, K8.
