# Rencana Deploy Produksi — Watuagung

> Disusun 24 Oktober 2026 terhadap `main` @ `afc373d`. Dokumen ini melengkapi `ROADMAP.md` (modul M0–M8) dan `backend/README.md` § "Sebelum produksi". Bila bertentangan, keputusan pengguna terbaru yang tercatat di `docs/progres-*.md` yang berlaku.
>
> `[ ]` belum, `[x]` selesai **dengan bukti verifikasi tercatat**. Jangan mencentang tanpa menjalankan verifikasinya.

## Aturan untuk agent

1. Kerjakan fase berurutan. Butir bertanda **(BLOKIR)** wajib selesai sebelum fase berikutnya.
2. Satu butir = satu branch/PR. Catat hasil di `docs/progres-YYYY-MM-DD.md` seperti biasa.
3. Dependensi baru (composer/npm) wajib persetujuan pengguna.
4. Jangan pernah membuat, mengganti, mencetak, atau meng-commit `APP_KEY` produksi. Jangan meng-commit `.env` apa pun.
5. Jangan memasukkan data warga asli ke repo, tes, fixture, atau log. Gunakan data fiktif.
6. Tugas di server (SSH, DNS, pembelian) dikerjakan manusia. Agent hanya menyiapkan berkas konfigurasi dan skrip di `deploy/` lalu meminta pengguna menjalankannya.
7. Klaim "siap" hanya berdasarkan verifikasi yang benar-benar dijalankan (lihat `PRODUCT.md`).

## Keputusan arsitektur

| # | Keputusan | Pilihan | Status |
|---|---|---|---|
| K2 | Hosting | **Hostinger Web Hosting Premium** (shared, hPanel): LiteSpeed menyajikan static export di `public_html` dan `/api/v1` → Laravel lewat `.htaccess` + `laravel.php`, origin sama. Repo Laravel di luar `public_html`. Vercel tetap untuk demo/preview saja. Panduan `deploy/hostinger.md`. Rencana VPS lama (Nginx) disimpan di `deploy/` untuk migrasi kelak. | Dipilih pengguna 12 November 2026, menggantikan usulan satu VPS; catat juga di `ROADMAP.md` |
| K3 | Database | **MySQL/MariaDB** dari Hostinger (driver Laravel `mysql`), karena Web Hosting tidak menyediakan PostgreSQL. SQLite tetap untuk pengembangan; PostgreSQL tetap didukung kode. | Diubah 12 November 2026 mengikuti K2 (keputusan PostgreSQL 24 Oktober tidak berlaku untuk produksi). **Belum diuji pada MySQL/MariaDB** |
| K4 | Pengelola konten desa | Nama orang/jabatan di desa | Belum |
| K6 | Lingkup rilis pertama | Lihat "Lingkup rilis 1" | Usulan, tunggu persetujuan |
| K7 | Domain | Domain `.id` umum (tanpa dokumen) atas nama/email desa; `.desa.id` dibatalkan karena waktu | Belum dibeli |
| K8 | Pembiayaan dan pemilik akun | Siapa membayar VPS + domain setelah kepanitiaan selesai; akun penyedia memakai email desa | Belum |

### Alasan K3 — PostgreSQL, bukan SQLite atau MySQL

- Penomoran surat (`App\Domain\LetterNumber`) dan perubahan status memakai `lockForUpdate()`. **SQLite mengabaikan penguncian baris ini**; keamanan nomor bergantung pada kunci seluruh database. PostgreSQL menjalankan `SELECT … FOR UPDATE` sebenarnya; uji konkurensi multiproses M3a lulus tiga kali pada PostgreSQL 18.6 lokal (24 Oktober 2026), lihat Fase 2.
- Kode sudah ditulis kompatibel PostgreSQL (`LOWER(...) LIKE ? ESCAPE '!'` di `StaffController`).
- Backup konsisten saat aplikasi berjalan dengan `pg_dump`; dokumentasi proyek sejak awal menargetkan PostgreSQL.
- MySQL tidak memberi keuntungan tambahan untuk kasus ini, dan menambah satu variasi lagi yang perlu diuji.
- Managed database (Neon/Supabase) tidak dipilih: tambahan biaya/latensi lintas negara, dan satu VPS lebih mudah diserahterimakan.

### Alasan K2 — satu VPS, satu origin

- Laravel memerlukan disk persisten (`storage/app/private` untuk PDF surat terenkripsi) dan cron scheduler. Serverless (Vercel) tidak cocok.
- Origin sama menghilangkan masalah CORS; `FRONTEND_ORIGINS` tetap diisi domain produksi sebagai lapisan kedua.
- Frontend tetap `output: "export"`. Konten CMS (M5, nanti) diambil di browser dari API, sehingga tidak perlu Next.js server.

### Lingkup rilis 1 (usulan)

- **Masuk:** halaman informasi dengan data resmi desa (diperbarui lewat build ulang), pengajuan 4 jenis surat, cek status, alur RT → RW → petugas → kepala desa, panel admin dan akun, register nomor, PDF/QR atau unggah surat manual, verifikasi QR, kebijakan privasi.
- **Pengaduan (M4):** dialihkan ke Google Form milik desa (keputusan 24 Okt 2026); website hanya menautkan. Lihat sesi F5 di `PROMPTS-FINALISASI.md`.
- **Ditunda ke rilis berikutnya:** M5 CMS, M6 Lampiran persyaratan (warga membawa berkas ke kantor desa).

## Fase 0 — Keputusan dan administrasi

- [ ] **(BLOKIR)** Pengguna menyetujui K2, K3, K6; catat di `ROADMAP.md` tabel keputusan.
- [ ] **(BLOKIR)** K8: kesepakatan tertulis dengan desa soal biaya tahunan, pemilik akun, dan penanggung jawab teknis setelah kepanitiaan selesai.
- [ ] K7: pilih nama domain dan beli atas akun/email desa.
- [ ] Tetapkan penanggung jawab data (pengendali data = pemerintah desa) untuk kebijakan privasi.

## Fase 1 — Data dari desa

Daftar lengkap ada di `ROADMAP.md` § "Data yang harus diminta ke desa". Yang memblokir rilis 1:

- [ ] **(BLOKIR)** Contoh surat asli tiap jenis, kop surat, kode klasifikasi, kode desa, format nomor, nama dan jabatan penandatangan (mengganti semua `[PLACEHOLDER]` di `backend/config/letters.php` dan `resources/views/letters/`).
- [ ] **(BLOKIR)** Persyaratan resmi dan estimasi waktu tiap jenis surat.
- [ ] **(BLOKIR)** Daftar RT/RW dan nama ketua yang berwenang, nama petugas desa, kepala desa, admin.
- [ ] **(BLOKIR)** Konten profil: alamat kantor, jam layanan, kontak, visi-misi, perangkat desa, foto berizin. Sebagian: alamat kantor dan identitas wilayah dari RKP Desa 2027 sudah tampil (`content/profile-contact`, `docs/progres-2026-10-24.md`); perangkat desa dan BPD dari Tabel 2.9/2.10 sudah tampil tanpa foto (`content/officials`); sejarah, daftar kepala desa, dan tema RKP 2027 sudah tampil (`content/history-direction`); visi-misi sudah tampil tanpa periode (lihat subbutir berikut); jam layanan, kontak, dan foto berizin masih menunggu.
  - [x] Visi dan tiga misi Kepala Desa dari dokumen yang diterima 25 Oktober 2026; tema pembangunan 2027 tetap. Alamat beranda/footer memakai sumber yang sama dengan `/kontak`, BUMDes beranda berisi nama/status/unit usaha resmi. Lint, tsc, build, build:demo, test:demo serta visual beranda, `/visi-misi`, `/kontak` dan footer 390px/1440px lulus (`docs/progres-2026-10-25.md`). Periode visi-misi menunggu konfirmasi; butir induk tetap terbuka.
- [x] Konten ekonomi dan keterbukaan dari RKP Desa 2027: potensi, BUMDes Watuagung Bangkit, daftar lembaga aktif pada profil, dan program prioritas 2027 tanpa nominal. Lint, tsc, build, build:demo, test:demo serta visual `/potensi`, `/bumdes`, `/profil`, `/transparansi` pada 390px/1440px lulus (25 Oktober 2026, `docs/progres-2026-10-25.md`). APBDes resmi dan kontak/pengurus BUMDes tetap menunggu; bukan penyelesaian seluruh Fase 1.
- [ ] Masa retensi data pemohon dan surat (disetujui desa).
- [ ] Prosedur bantuan kode akses di kantor (siapa melayani, dokumen yang diperiksa).

## Fase 2 — Perubahan kode wajib

### Database
- [x] **(BLOKIR)** Jalankan seluruh `php artisan test` terhadap PostgreSQL lokal (`DB_CONNECTION=pgsql`), perbaiki yang gagal. Panduan dan `.env.testing.pgsql.example` tersedia: PostgreSQL 18.6 lulus 179 tes / 1.858 assertions; SQLite lulus 179 tes / 1.856 assertions (24 Oktober 2026, `docs/progres-2026-10-24.md`). Pengguna mengizinkan verifikasi database Fase 2 mendahului pemblokir Fase 0–1; bukan persetujuan K2/K6.
- [x] **(BLOKIR)** Uji penomoran simultan multiproses pada PostgreSQL (butir M3a): tiga kali lulus pada PostgreSQL 18.6 lokal, masing-masing 30 proses PHP / 30 sesi database menunggu bersamaan sebelum dilepas; 30 transisi `PROCESSING → WAITING_APPROVAL`, nomor unik 1..30 tanpa celah, satu counter tahunan bernilai 30. Skrip `backend/tests/Concurrency/letter-number.php`; hasil 24 Oktober 2026 di `docs/progres-2026-10-24.md`. Bukan uji server produksi.
- [x] Pastikan semua migration berjalan bersih dari nol di PostgreSQL (`migrate:fresh`) dan `migrate:rollback` tidak merusak. Seluruh 13 migration lulus fresh, rollback (panggilan kedua: `Nothing to rollback`), lalu migrate ulang pada database uji kosong PostgreSQL 18.6; tidak ada migration gagal (24 Oktober 2026).

### Privasi dan enkripsi
- [x] Enkripsi `tempat_lahir` dan `tanggal_lahir` di `applications` (cast `encrypted`, kolom `text`), dengan migration yang mengenkripsi baris lama. `nama` tetap teks biasa untuk pencarian (keputusan 18 Okt 2026). Migration `2026_10_25_000000`; SQLite 182 tes / 1.879 assertions, PostgreSQL 18.6 182 tes / 1.881 assertions, rollback/migrate PostgreSQL lulus (24 Oktober 2026, `docs/progres-2026-10-24.md`).
- [ ] Tinjau ulang respons API dan `audit_logs`: tidak ada NIK/KK/telepon/alamat/kode akses/token pada respons daftar, log, maupun pesan error.
- [x] Halaman `/kebijakan-privasi/`: data yang dikumpulkan, tujuan, siapa yang mengakses, masa simpan, kontak desa. Tautan footer dan pemberitahuan di atas tombol kirim empat formulir tersedia tanpa checkbox persetujuan wajib. Lint, tsc, build, build:demo, test:demo serta pemeriksaan 390px/1440px lulus (27 Oktober 2026, `docs/progres-2026-10-27.md`). Masa simpan masih `[MASA SIMPAN — menunggu keputusan desa]` sampai F10. Pengguna mengizinkan butir ini mendahului pemblokir Fase 0–1; bukan persetujuan deploy atau penyelesaian retensi.
- [ ] Perintah artisan retensi terjadwal sesuai masa yang disetujui desa (hapus/anonimkan permohonan lama dan file surat), dengan tes.
  - [x] Mekanisme opt-in: `applications:purge {--dry-run}` dijadwalkan harian, mati bawaan sampai `RETENTION_APPLICATION_DAYS` diisi; anonimkan `COMPLETED`/`REJECTED` lewat batas, hapus PDF, audit `application.purged`; register dan `/verify` tetap jalan. SQLite 218 tes / 2.398 assertions, PostgreSQL 18.6 218 tes / 2.400 assertions, rollback/migrate PostgreSQL lulus (27 Oktober 2026, `docs/progres-2026-10-27.md`). Butir induk menunggu masa simpan dari desa (Fase 1).

### Konfigurasi
- [x] **(BLOKIR)** `config/app.php` membaca `APP_TIMEZONE` dengan bawaan `Asia/Jakarta`; `.env.example` memuat nilai tersebut. Reset tahunan mengikuti pukul 00.00 WIB 1 Januari. Dua tes batas tahun WIB lulus; `php artisan test`: 179 tes / 1.856 assertions (24 Oktober 2026, `docs/progres-2026-10-24.md`).
- [ ] `backend/.env.production.example` (tanpa rahasia): `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `LOG_CHANNEL=daily` (level `warning`), `FRONTEND_ORIGINS=https://<domain>`, `LETTER_VERIFY_URL=https://<domain>/verifikasi/`, `SANCTUM_EXPIRATION=480`, `FILESYSTEM_DISK=local`.
- [ ] Frontend produksi: `NEXT_PUBLIC_DEMO_MODE=false`, `NEXT_PUBLIC_API_URL=https://<domain>/api/v1`, `NEXT_PUBLIC_SITE_URL=https://<domain>`. Pastikan build produksi tidak memuat teks/tanda demo atau "konten contoh" yang sudah diganti data resmi.
  - [x] `NEXT_PUBLIC_SHOW_SAMPLE_CONTENT=false` menyembunyikan berita, agenda, pengumuman contoh, dan label contoh footer; `npm run test:no-sample` membangun dengan flag false dan memastikan `out/` tidak memuat "Artikel contoh", "Agenda contoh", "Contoh pengumuman", "Konten masih contoh". Lint, tsc, build (true/false), build:demo, test:demo, visual 390px/1440px lulus (27 Oktober 2026, `docs/progres-2026-10-27.md`). Butir induk tetap terbuka: tiga env lain dan label contoh persyaratan pelayanan masih menunggu data resmi. Jadwal contoh `/kontak` diganti keputusan 2 November 2026 menjadi Hari kerja, 08.00–13.00 WIB; nama hari menunggu konfirmasi.
- [ ] Ganti semua placeholder surat dengan data Fase 1; periksa visual 4 PDF.
  - [x] Identitas wilayah, alamat kantor, dan penandatangan sesuai RKP Desa 2027 bagian 7, dapat diganti lewat empat env `LETTER_*`; empat PDF final + empat draf diperiksa visual. Tes backend 183/1.925 assertions, lint, tsc, build, build:demo, test:demo lulus (25 Oktober 2026, `docs/progres-2026-10-25.md`). Kop resmi, kode desa, dan kode klasifikasi masih menunggu F9b; butir induk belum selesai.

### Tuntaskan verifikasi yang tertunda di ROADMAP
- [ ] M1: verifikasi halaman berita; review visual 390px/1440px yang tertunda.
- [ ] M2a, M3, M3a, M7: uji manual end-to-end dengan Laravel (bukan API tiruan), termasuk pindai QR dengan ponsel.
- [ ] M8: uji bantuan kode akses.

## Fase 3 — Infrastruktur (dikerjakan manusia, agent menyiapkan berkas)

Berkas tersedia di `deploy/` (9 November 2026): `nginx/watuagung.conf` + `nginx/watuagung-headers.conf`, `deploy.sh`, `backup.sh`, `restore.md`, `crontab.txt`, `server-setup.md`. Langkah server mengikuti **`deploy/hostinger.md`** (sejak 12 November 2026 produksi memakai Hostinger Web Hosting Premium). Butir VPS/Nginx di bawah hanya berlaku bila kelak pindah ke VPS; padanan Hostinger ada di daftar periksa `deploy/hostinger.md`.

- [ ] **(BLOKIR)** Hostinger: `php artisan test` dan uji penomoran multiproses M3a lulus pada MySQL/MariaDB versi yang sama dengan Hostinger. Belum dijalankan (12 November 2026: menjalankan MariaDB lokal belum diizinkan di sesi).
- [ ] Hostinger: akun email desa + 2FA, Premium, lokasi Indonesia, PHP 8.3 + ekstensi, database khusus, SSH kunci, cron (UTC), daftar periksa `deploy/hostinger.md` lengkap.
- [ ] Hostinger: keputusan query string di access log (`deploy/hostinger.md` § K).
- [ ] `.htaccess` diuji di LiteSpeed Hostinger: header, `/api/`, `/storage/` (symlink `SymLinksIfOwnerMatch`), penolakan dotfile/PHP. Uji lokal Apache 2.4.58 lulus 12 November 2026 (`docs/progres-2026-11-12.md`).
- [ ] Paket (`server-setup.md` §1): Nginx, PHP 8.3 FPM (`composer.json` `^8.3`) dengan `pgsql`, `mbstring`, `xml`/`dom`, `gd`, `intl`, `bcmath`, `zip`, `curl`; Composer; PostgreSQL 16; certbot; Node 24.x hanya bila build di VPS. `php-gd` wajib JPEG/PNG/WebP (cek CLI dan FPM). PHP `upload_max_filesize`/`post_max_size` 12M, `memory_limit` 256M, `expose_php Off` (§5).
- [ ] Keamanan server (§2–3): login SSH hanya kunci (password dan root login dimatikan), user deploy terpisah, `ufw` hanya 22/80/443, `fail2ban`, `unattended-upgrades`, zona waktu Asia/Jakarta.
- [ ] PostgreSQL (§4): user dan database khusus aplikasi dengan kata sandi kuat, `listen_addresses = 'localhost'`.
- [ ] DNS: A record domain (dan `www`) ke IP VPS. HTTPS Let's Encrypt (`certbot certonly --nginx`, §6) dan `certbot renew --dry-run` lulus.
- [ ] `APP_KEY` produksi dibuat **sekali** di server (`php artisan key:generate`), langsung disalin ke penyimpanan kunci desa (password manager), terpisah dari backup database.

### Konfigurasi Nginx (`deploy/nginx/watuagung.conf`)

Berkas disiapkan 9 November 2026. `nginx -t` lulus pada Nginx 1.30.6 resmi (build Windows) dengan sertifikat dummy; Docker tidak tersedia. Uji perilaku lokal di port 8080/8443 dengan `out/` asli dan php-cgi + `index.php` tiruan lulus (lihat `docs/progres-2026-11-09-deploy.md`). Belum diuji pada Nginx 1.24 Ubuntu 24.04 atau PHP-FPM sungguhan; butir dicentang setelah uji di VPS.

Keputusan 9 November 2026 mengganti rencana lama prefix `/media/<folder>/`: `MEDIA_URL` kosong (URL Laravel `APP_URL/storage/...`) dan Nginx menyajikan **seluruh** `backend/storage/app/public/` di `/storage/` sebagai file statis. Folder ini hanya berisi media publik (sampul berita, foto UMKM, bagan struktur, PDF APBDes); PDF surat ada di `storage/app/private` dan tidak terjangkau. Filter nama UUID/ekstensi per folder dihapus karena hanya kode aplikasi yang menulis folder itu dan `.php` tetap ditolak.

- [ ] Root = `WEB_ROOT` (`out/`), `try_files $uri $uri/ $uri.html =404`, `error_page 404 /404.html`. `^~ /api/` → `SCRIPT_FILENAME` tetap `backend/public/index.php` via PHP-FPM; tidak ada file lain dari `backend/` yang dapat disajikan atau dieksekusi.
- [ ] Tolak file tersembunyi (`/.env`, `/.git`) kecuali `/.well-known/acme-challenge/`.
- [ ] `^~ /storage/` → alias `backend/storage/app/public/`: `autoindex off`, `.php` dan dotfile ditolak, `Cache-Control: public, max-age=604800`, `nosniff`. Uji di VPS: file ada 200, hilang 404, `.php` 403, traversal ke `app/private` tidak 200, `MEDIA_URL` kosong. HTML pakai `no-cache`; `/_next/static/` `immutable` 1 tahun.
- [ ] Redirect HTTP → HTTPS 301. Header di `watuagung-headers.conf` (di-include ulang per location karena aturan pewarisan `add_header`): HSTS `max-age=31536000`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (menggantikan `same-origin`), `X-Frame-Options: DENY`, `Permissions-Policy` kamera/mikrofon/geolokasi mati.
- [ ] CSP ditulis lengkap sebagai **`Content-Security-Policy-Report-Only`**: `frame-src https://www.google.com https://maps.google.com https://www.youtube-nocookie.com`, `img-src 'self' data: blob: https://i.ytimg.com`, `script-src`/`style-src` `'self' 'unsafe-inline'` (static export memuat ±140 `<script>` inline dan atribut `style`; alasan di berkas). Uji di VPS: peta beranda/`/kontak/`/`/profil/`, video YouTube R8 diputar, panel admin (pratinjau foto, PDF surat) tanpa pelanggaran di console. **Ubah ke enforce setelah seminggu tanpa laporan pelanggaran.**
- [ ] `client_max_body_size 12m` (PDF APBDes ≤ 10 MB + multipart), PHP 12M. Uji unggah tepat 10 MiB dan >10 MiB di VPS.
- [ ] Access log format `watuagung_noquery` (`$uri`, tanpa query string dan Referer) untuk seluruh server: `?q=` pencarian petugas, `?id=` cek status, dan `?kode=` verifikasi tidak tercatat. Uji lokal: `?q=Budi` tidak muncul di log.
- [ ] gzip untuk text/css/js/json/svg.

## Fase 4 — Prosedur deploy (`deploy/deploy.sh`)

Skrip, bootstrap pertama dan cron tersedia: `deploy/deploy.sh`, `deploy/first-deploy.md`, `deploy/crontab.txt`, panduan `deploy/README.md`. Urutan setiap rilis:
1. `git pull` pada tag rilis.
2. `composer install --no-dev --optimize-autoloader` di `backend/`.
3. `php artisan migrate --force`.
4. `php artisan config:cache && php artisan route:cache && php artisan view:cache`.
5. Build frontend dengan env produksi (`npm ci && npm run build`), salin `out/` ke root Nginx.
6. Reload PHP-FPM; jalankan smoke test (beranda 200, `GET /api/v1/verify/xxx` 404 JSON, login gagal 401).

- [ ] Cron: `* * * * * php /path/backend/artisan schedule:run` (prune token Sanctum + retensi). Queue worker tidak diperlukan saat ini karena tidak ada job yang di-dispatch; tinjau ulang bila ada.
- [ ] Hak akses: `storage/` dan `bootstrap/cache/` hanya dapat ditulis user PHP-FPM.
- [ ] Deploy media: seluruh `backend/storage/app/public` (berita, UMKM, bagan, APBDes) persisten antar-rilis; PHP-FPM menulis, Nginx hanya membaca. Disajikan lewat alias `/storage/` di `deploy/nginx/watuagung.conf`; symlink `storage:link` dari `deploy.sh` tidak dipakai Nginx produksi.

## Fase 5 — Backup dan pemulihan

Berkas: `deploy/backup.sh` (cron 02.00 WIB di `deploy/crontab.txt`), `deploy/restore.md`. `bash deploy/test-scripts.sh` menguji backup dengan gpg/tar asli dan `pg_dump` tiruan (9 November 2026): arsip terenkripsi, dapat dibuka, berisi dump + storage private/public, tanpa `.env`, rotasi 14/8, menolak passphrase mode longgar dan `pg_dump` gagal. Belum dijalankan terhadap PostgreSQL sungguhan.

- [ ] `backup.sh` harian: `pg_dump -Fc` + tar **seluruh** `backend/storage/app` (`private`: PDF surat terenkripsi; `public`: sampul berita, foto UMKM, bagan, PDF APBDes; soft delete tetap ikut), digabung lalu `gpg --symmetric` AES256 dengan passphrase dari berkas `PASSPHRASE_FILE` (mode 600/400, di luar repo). Uji dekripsi setiap selesai. 14 harian + 8 mingguan di `BACKUP_DIR`. Salinan ke luar VPS lewat `rclone sync` (masih dikomentari) **wajib diaktifkan sebelum go-live**. Uji pemulihan juga mencocokkan `posts.cover_path`, `businesses.photo_path`, `chartImagePath` dan `budgets[].documentPath` dengan file di `/storage/…`.
- [ ] `APP_KEY` dan `.env` **tidak** ikut dalam arsip; passphrase backup dan `APP_KEY` disimpan terpisah di password manager desa.
- [ ] Hostinger: `backup.sh` dengan `DB_DRIVER=mysql` (mysqldump) lewat cron hPanel 19.00 UTC = 02.00 WIB, `ENCRYPTOR=openssl` bila gpg tidak ada, salinan ke luar Hostinger aktif. Backup otomatis Hostinger hanya pelengkap (memuat `.env`/`APP_KEY` bersama data). Uji stub mysqldump + gpg/openssl asli lulus 12 November 2026; belum dijalankan di Hostinger.
- [ ] **(BLOKIR)** Uji pemulihan ke VM kosong mengikuti `deploy/restore.md`: restore database + file + `APP_KEY`, buka satu permohonan fiktif di panel (NIK terbaca = `APP_KEY` benar) dan unduh satu PDF surat. Catat hasil di `docs/progres-*.md`.

## Fase 6 — Uji pra-rilis di server (data fiktif)

- [ ] Alur lengkap tiap jenis surat dengan akun semua peran di HTTPS produksi, termasuk ponsel 390px.
- [ ] Keamanan dasar: `APP_DEBUG=false` (error tidak menampilkan stack trace), `/.env` dan `/backend` tidak dapat diakses, rate limit login/pengajuan/cek status aktif, RT/RW tidak bisa melihat wilayah lain, respons daftar tanpa field sensitif, header keamanan terpasang.
- [ ] Laravel log dan access log tidak berisi NIK, KK, telepon, kode akses, token, atau kata sandi.
- [ ] QR pada PDF mengarah ke domain produksi dan bisa dipindai.
- [ ] Hapus semua data uji (`migrate:fresh` lalu buat akun asli), **sebelum** dipakai warga.

## Fase 7 — Go-live dan serah terima

- [ ] Buat akun admin pertama dengan `php artisan staff:create`; akun lain dibuat admin dari panel (wajib ganti kata sandi saat login pertama).
- [ ] Pelatihan singkat: admin (akun, register), petugas (alur status, unggah surat, bantuan kode akses), RT/RW, kepala desa.
- [ ] Panduan operator berbahasa sederhana (PDF/cetak) untuk tiap peran.
- [ ] Dokumen serah terima: daftar akun penyedia (VPS, domain, email), lokasi `APP_KEY`, cara deploy, cara restore, kontak teknis, tanggal perpanjangan domain/VPS.
- [ ] Monitoring uptime (layanan gratis) dengan notifikasi ke email desa dan penanggung jawab teknis.
- [ ] Umumkan ke warga hanya setelah semua butir (BLOKIR) selesai.

## Setelah rilis 1

- M5 CMS (fetch di browser dari API), M6 Lampiran (penyimpanan privat + retensi). M4 tidak dibangun; tetap Google Form.
  - [x] C2 API sampul berita: unggah/hapus, validasi, encode ulang GD tanpa EXIF/GPS, URL media, penggantian file, otorisasi dan throttle. SQLite 258 tes / 2.730 assertions; PostgreSQL 258 tes / 2.732 assertions; fallback JPEG 23 lulus / 2 skip khusus WebP; lint, tsc, build lulus (29 Oktober 2026, `docs/progres-2026-10-29.md`). Pengguna mengizinkan mendahului pemblokir deploy/K2/K4. Bukan verifikasi Nginx/FPM/backup atau persetujuan deploy.
  - [ ] Pembersihan berkala media berita: soft delete mempertahankan file untuk pemulihan; kegagalan proses/hapus file dapat meninggalkan file sisa. Tentukan kebijakan sebelum menambah pembersihan; retensi permohonan F10 tidak berlaku untuk berita.
- Blind index NIK (HMAC) bila perlu deduplikasi atau pencarian NIK; jangan membuka pencarian NIK publik.
- Rotasi `APP_KEY` hanya dengan prosedur `APP_PREVIOUS_KEYS` + re-enkripsi data, diuji di salinan database lebih dulu.
