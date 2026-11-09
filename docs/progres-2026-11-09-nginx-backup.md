# Progres 9 November 2026 — Nginx, backup terenkripsi, persiapan server

Branch `chore/deploy-nginx-backup`, dibuat dari `chore/deploy-scripts` (D1, belum di `main`) agar `deploy/crontab.txt` ditambah, bukan bentrok. Merge D1 lebih dulu.

## Berkas

- `deploy/nginx/watuagung.conf`: 80 → 301 HTTPS; 443 dengan sertifikat certbot placeholder `example.id`; root `WEB_ROOT`, `try_files $uri $uri/ $uri.html =404`, `error_page 404 /404.html`; `^~ /api/` → `SCRIPT_FILENAME` tetap `backend/public/index.php`; `^~ /storage/` alias `backend/storage/app/public/` (PHP/dotfile ditolak, cache 7 hari); dotfile ditolak kecuali ACME; `client_max_body_size 12m`; gzip; `/_next/static/` immutable; HTML `no-cache` (rsync `--delete` menghapus chunk lama).
- `deploy/nginx/watuagung-headers.conf`: HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, CSP **Report-Only**. Dipisah karena `add_header` di location menghapus warisan dari server; snippet di-include ulang per location.
- Access log `$uri` tanpa query string dan Referer untuk **seluruh** server, bukan hanya `/api/`: URL halaman admin (`?q=`), cek status (`?id=`) dan verifikasi (`?kode=`) juga membawa data.
- `deploy/backup.sh`: `pg_dump -Fc` + tar `storage/app/private` dan `public`, digabung, `gpg --symmetric` AES256 dengan `PASSPHRASE_FILE` (mode 600/400 wajib), uji dekripsi tiap selesai, `flock`, rotasi 14 harian + 8 mingguan (hardlink Minggu), rclone dikomentari. Tanpa `.env`/`APP_KEY`.
- `deploy/crontab.txt`: baris backup 02.00 WIB ditambahkan, keluaran ke `logger -t watuagung-backup`.
- `deploy/restore.md`, `deploy/server-setup.md`, `deploy/README.md`, `deploy/test-scripts.sh` (uji backup), `deploy/.gitattributes` (`nginx/*.conf` LF), `docs/deploy-plan.md` Fase 3–5.

## CSP

Pemeriksaan `out/` (build 9 Nov 13.02): 58 HTML, 140 `<script>` inline tanpa `src` (payload RSC `self.__next_f.push`, `$RB/$RV`), 104 atribut `style="`, tanpa `<style>`, tanpa `eval(`/`new Function(` di bundle. Maka `script-src 'self' 'unsafe-inline'` dan `style-src 'self' 'unsafe-inline'`; nonce butuh server, hash berubah tiap build. Tambahan di luar spesifikasi: `img-src blob:` (pratinjau foto berita/UMKM via `URL.createObjectURL`), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. PDF surat dibuka di tab baru lewat URL blob (navigasi), bukan frame.

## Verifikasi

- Docker dan distribusi WSL tidak tersedia. Pengganti: Nginx 1.30.6 resmi build Windows (zip nginx.org di folder temp, bukan dependensi proyek), sertifikat dummy OpenSSL, path diganti ke folder temp. `nginx -t`: **syntax is ok, test is successful**; dua peringatan `listen ... http2` deprecated (sengaja, kompatibel Nginx 1.24 Ubuntu 24.04; komentar di berkas).
- Uji perilaku di port 8080/8443 dengan salinan `out/` asli dan php-cgi 8.3 + `index.php` tiruan: HTTP 301 ke HTTPS dengan query; `/` dan `/pelayanan/` 200; `/pelayanan` 301 ke trailing slash; halaman tidak ada 404 dengan isi `404.html`; `/.env` 403; `/storage/posts/a.webp` 200; `/storage/x.php` 403; `/storage/` 403 (tanpa listing); `/storage/../app/private/secret.pdf` (`--path-as-is`) 404; `/api/other.php` dan `/api/../backend/public/other.php` tetap ke `index.php`/404, `other.php` tidak tereksekusi. Header keamanan + CSP Report-Only ada pada HTML, `/_next/static/`, `/storage/`, API 404 dan halaman 404; cache sesuai; gzip aktif. Log memuat `GET /api/v1/verify/xxx` tanpa `?q=Budi`.
- `bash -n deploy/*.sh` dan `bash deploy/test-scripts.sh` (Git Bash, GnuPG 2.4.9): lulus. Uji backup memakai gpg/tar asli, stub `pg_dump`/`flock`/`stat` (mode file 600 tidak didukung Git Bash Windows).
- Tidak diuji: Nginx 1.24 Ubuntu, PHP-FPM sungguhan, `pg_dump`/`pg_restore` PostgreSQL sungguhan, certbot, CSP di browser, unggah 10 MiB, pemulihan penuh `restore.md`. Lint/tsc/build frontend tidak dijalankan: tidak ada kode aplikasi yang berubah.
