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
| K2 | Hosting | Satu VPS: Nginx menyajikan static export Next.js **dan** Laravel pada origin yang sama (`/api/v1` → Laravel). Vercel tetap untuk demo/preview saja. | Usulan, tunggu persetujuan |
| K3 | Database | **PostgreSQL 16+** di VPS yang sama, hanya mendengarkan `127.0.0.1`. | Usulan, tunggu persetujuan |
| K4 | Pengelola konten desa | Nama orang/jabatan di desa | Belum |
| K6 | Lingkup rilis pertama | Lihat "Lingkup rilis 1" | Usulan, tunggu persetujuan |
| K7 | Domain | Domain `.id` umum (tanpa dokumen) atas nama/email desa; `.desa.id` dibatalkan karena waktu | Belum dibeli |
| K8 | Pembiayaan dan pemilik akun | Siapa membayar VPS + domain setelah kepanitiaan selesai; akun penyedia memakai email desa | Belum |

### Alasan K3 — PostgreSQL, bukan SQLite atau MySQL

- Penomoran surat (`App\Domain\LetterNumber`) dan perubahan status memakai `lockForUpdate()`. **SQLite mengabaikan penguncian baris ini**; keamanan nomor bergantung pada kunci seluruh database, dan uji konkurensi multiproses M3a belum dijalankan. PostgreSQL menjalankan `SELECT … FOR UPDATE` sebenarnya.
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
- [ ] **(BLOKIR)** Konten profil: alamat kantor, jam layanan, kontak, visi-misi, perangkat desa, foto berizin.
- [ ] Masa retensi data pemohon dan surat (disetujui desa).
- [ ] Prosedur bantuan kode akses di kantor (siapa melayani, dokumen yang diperiksa).

## Fase 2 — Perubahan kode wajib

### Database
- [ ] **(BLOKIR)** Jalankan seluruh `php artisan test` terhadap PostgreSQL lokal (`DB_CONNECTION=pgsql`), perbaiki yang gagal. Tambahkan langkah ini ke `backend/README.md`.
- [ ] **(BLOKIR)** Uji penomoran simultan multiproses pada PostgreSQL (butir M3a): banyak permintaan `PROCESSING → WAITING_APPROVAL` paralel tidak boleh menghasilkan nomor ganda atau loncat.
- [ ] Pastikan semua migration berjalan bersih dari nol di PostgreSQL (`migrate:fresh`) dan `migrate:rollback` tidak merusak.

### Privasi dan enkripsi
- [ ] Enkripsi `tempat_lahir` dan `tanggal_lahir` di `applications` (cast `encrypted`, kolom `text`), dengan migration yang mengenkripsi baris lama. `nama` tetap teks biasa untuk pencarian (keputusan 18 Okt 2026).
- [ ] Tinjau ulang respons API dan `audit_logs`: tidak ada NIK/KK/telepon/alamat/kode akses/token pada respons daftar, log, maupun pesan error.
- [ ] Halaman `/kebijakan-privasi/`: data yang dikumpulkan, tujuan, siapa yang mengakses, masa simpan, kontak desa. Tautkan dari footer dan formulir pengajuan.
- [ ] Perintah artisan retensi terjadwal sesuai masa yang disetujui desa (hapus/anonimkan permohonan lama dan file surat), dengan tes.

### Konfigurasi
- [x] **(BLOKIR)** `config/app.php` membaca `APP_TIMEZONE` dengan bawaan `Asia/Jakarta`; `.env.example` memuat nilai tersebut. Reset tahunan mengikuti pukul 00.00 WIB 1 Januari. Dua tes batas tahun WIB lulus; `php artisan test`: 179 tes / 1.856 assertions (24 Oktober 2026, `docs/progres-2026-10-24.md`).
- [ ] `backend/.env.production.example` (tanpa rahasia): `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL`, `DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `LOG_CHANNEL=daily` (level `warning`), `FRONTEND_ORIGINS=https://<domain>`, `LETTER_VERIFY_URL=https://<domain>/verifikasi/`, `SANCTUM_EXPIRATION=480`, `FILESYSTEM_DISK=local`.
- [ ] Frontend produksi: `NEXT_PUBLIC_DEMO_MODE=false`, `NEXT_PUBLIC_API_URL=https://<domain>/api/v1`, `NEXT_PUBLIC_SITE_URL=https://<domain>`. Pastikan build produksi tidak memuat teks/tanda demo atau "konten contoh" yang sudah diganti data resmi.
- [ ] Ganti semua placeholder surat dengan data Fase 1; periksa visual 4 PDF.

### Tuntaskan verifikasi yang tertunda di ROADMAP
- [ ] M1: verifikasi halaman berita; review visual 390px/1440px yang tertunda.
- [ ] M2a, M3, M3a, M7: uji manual end-to-end dengan Laravel (bukan API tiruan), termasuk pindai QR dengan ponsel.
- [ ] M8: uji bantuan kode akses.

## Fase 3 — Infrastruktur (dikerjakan manusia, agent menyiapkan berkas)

Agent membuat folder `deploy/` berisi: `nginx/watuagung.conf`, `deploy.sh`, `backup.sh`, `restore.md`, `crontab.txt`, dan `server-setup.md`.

- [ ] VPS: Ubuntu 24.04 LTS, minimal 2 vCPU / 2 GB RAM / 40 GB SSD, lokasi data center Indonesia bila memungkinkan.
- [ ] Paket: Nginx, PHP 8.3+ FPM dengan ekstensi `pgsql`, `mbstring`, `xml`, `dom`, `gd`, `zip`, `intl`, `bcmath`; Composer; PostgreSQL 16+; Node 22.13+ (hanya untuk build, boleh di mesin lain).
- [ ] Keamanan server: login SSH hanya kunci (password dan root login dimatikan), user deploy terpisah, `ufw` hanya 22/80/443, `fail2ban`, `unattended-upgrades`.
- [ ] PostgreSQL: user dan database khusus aplikasi dengan kata sandi kuat, `listen_addresses = 'localhost'`.
- [ ] DNS: A record domain (dan `www`) ke IP VPS. HTTPS dengan Let's Encrypt (certbot) dan perpanjangan otomatis.
- [ ] `APP_KEY` produksi dibuat **sekali** di server (`php artisan key:generate`), langsung disalin ke penyimpanan kunci desa (password manager), terpisah dari backup database.

### Konfigurasi Nginx (isi `deploy/nginx/watuagung.conf`)
- [ ] Root = hasil `out/` Next.js; `location /api/` → `backend/public/index.php` via PHP-FPM. Tidak ada akses langsung ke `backend/` selain `public/`.
- [ ] Tolak `/.env`, `/.git`, file tersembunyi, dan `storage/`.
- [ ] Redirect HTTP → HTTPS; header: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, `Content-Security-Policy` yang diuji terhadap build.
- [ ] `client_max_body_size 6m` (unggah PDF ≤ 5 MB).
- [ ] Format access log tanpa query string untuk `/api/` (parameter `q` berisi nama; lihat `backend/README.md`).

## Fase 4 — Prosedur deploy (`deploy/deploy.sh`)

Urutan setiap rilis:
1. `git pull` pada tag rilis.
2. `composer install --no-dev --optimize-autoloader` di `backend/`.
3. `php artisan migrate --force`.
4. `php artisan config:cache && php artisan route:cache && php artisan view:cache`.
5. Build frontend dengan env produksi (`npm ci && npm run build`), salin `out/` ke root Nginx.
6. Reload PHP-FPM; jalankan smoke test (beranda 200, `GET /api/v1/verify/xxx` 404 JSON, login gagal 401).

- [ ] Cron: `* * * * * php /path/backend/artisan schedule:run` (prune token Sanctum + retensi). Queue worker tidak diperlukan saat ini karena tidak ada job yang di-dispatch; tinjau ulang bila ada.
- [ ] Hak akses: `storage/` dan `bootstrap/cache/` hanya dapat ditulis user PHP-FPM.

## Fase 5 — Backup dan pemulihan

- [ ] `backup.sh` harian: `pg_dump` terkompresi + arsip `backend/storage/app/private` (PDF surat), dienkripsi sebelum dikirim ke penyimpanan di luar VPS. Simpan 14 harian + 8 mingguan.
- [ ] `APP_KEY` **tidak** ikut dalam arsip backup yang sama.
- [ ] **(BLOKIR)** Uji pemulihan ke server/VM kosong: restore database + file + `APP_KEY`, lalu pastikan NIK pada satu permohonan uji dapat didekripsi dan PDF dapat diunduh. Catat langkahnya di `deploy/restore.md`.

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
- Blind index NIK (HMAC) bila perlu deduplikasi atau pencarian NIK; jangan membuka pencarian NIK publik.
- Rotasi `APP_KEY` hanya dengan prosedur `APP_PREVIOUS_KEYS` + re-enkripsi data, diuji di salinan database lebih dulu.
