# Hostinger Web Hosting Premium — panduan deploy

Keputusan 12 November 2026: produksi memakai **Hostinger Web Hosting Premium** (shared hosting, hPanel), bukan VPS. Panduan VPS lama ([server-setup.md](server-setup.md), `nginx/`, `deploy.sh`) disimpan untuk bila kelak pindah ke VPS, tetapi **tidak dipakai** di sini.

Perbedaan dengan rencana VPS:

| Hal | VPS (lama) | Web Hosting Premium |
|---|---|---|
| Web server | Nginx (`nginx/watuagung.conf`) | LiteSpeed + [hostinger/.htaccess](hostinger/.htaccess) |
| `/api/` | Nginx → PHP-FPM | `.htaccess` → [hostinger/laravel.php](hostinger/laravel.php) → `backend/public/index.php` |
| `/storage/` | alias Nginx | symlink `public_html/storage` → `backend/storage/app/public` |
| Database | PostgreSQL 16 | MySQL/MariaDB dari hPanel (driver Laravel `mysql`) |
| Deploy | `deploy.sh` (sudo reload FPM) | [hostinger-deploy.sh](hostinger-deploy.sh), tanpa sudo |
| Frontend | build di VPS atau laptop | **selalu build di laptop**, unggah arsip |
| Cron | crontab, WIB | hPanel Cron Jobs, **jam UTC** |
| Firewall, fail2ban, SSH hardening | diatur sendiri | dikelola Hostinger |
| Access log | tanpa query string | **tidak bisa diatur**, query string tercatat (lihat § K) |

Semua langkah server dikerjakan manusia. Nama menu hPanel bisa berubah; cari menu dengan fungsi yang sama. Contoh memakai `example.id`, user hosting `u123456789`, dan port SSH `65002`; ganti dengan nilai di hPanel.

> **Status MySQL (13 November 2026):** suite `php artisan test` (411 tes) dan uji penomoran multiproses ([tests/Concurrency/letter-number-mysql.php](../backend/tests/Concurrency/letter-number-mysql.php), 3× lulus) **lulus pada MariaDB 11.4.8 lokal**. Versi server Hostinger belum diketahui: bila berbeda jenis/versi mayor (mis. MySQL 8 atau MariaDB 10.x), ulangi kedua uji dengan versi itu sebelum menerima data warga. Cara menjalankan: `backend/README.md` § Tes MySQL/MariaDB.

## Pemeriksaan pra-rilis (`app:preflight`)

`php artisan app:preflight --production` (dari `backend/`, biner PHP produksi § C) hanya **membaca** konfigurasi, database, folder, dan jadwal; tidak mengubah apa pun. Setiap baris berlabel OK / PERINGATAN / GAGAL, diakhiri ringkasan; exit 1 bila ada GAGAL. Rahasia (`APP_KEY`, kata sandi database/SMTP) hanya ditulis "terisi"/"kosong".

GAGAL antara lain: `APP_ENV` bukan production, `APP_DEBUG=true`, `APP_KEY` kosong; `APP_URL`/`SITE_URL`/`LETTER_VERIFY_URL`/`FRONTEND_ORIGINS` bukan https, berisi localhost/placeholder/`example`, atau beda host (origin `FRONTEND_ORIGINS` boleh subdomain langsung host `APP_URL`, mis. panel § N; `desa.id.evil.test` atau subdomain dua tingkat ditolak); `LETTER_VERIFY_URL` tidak berakhiran `/verifikasi/`; URL media bukan https/tidak sehost; database tidak tersambung atau ada migration tertunda; folder `storage`/`bootstrap/cache` tidak dapat ditulis; GD tidak ada; `QUEUE_CONNECTION` bukan `database` atau tabel `jobs` tidak ada; `upload_max_filesize` < 6M atau `post_max_size` < 20M; tidak ada admin aktif. PERINGATAN (tidak memblokir, tetap dibaca): GD tanpa WebP, masa unduh/berlaku bukan 7, RT/RW aktif, `MAIL_MAILER=log`, alamat pengirim beda domain, kepala desa tanpa email terverifikasi/PIN, job gagal, tugas jadwal hilang.

Batas unggah yang diperiksa milik **PHP CLI**; PHP web diatur terpisah di hPanel (§ C). Pemeriksaan jadwal membaca `routes/console.php`, bukan cron hPanel: cocokkan tabel § H secara manual.

Jalankan: (1) setelah mengisi/mengubah `.env` (§ G langkah 3, § I, § M), (2) setelah `migrate`, dan (3) setelah deploy, sebelum membuka layanan dan cron. Bila `.env` diubah, jalankan `php artisan config:clear` (atau `config:cache`) dulu agar yang diperiksa sama dengan yang dipakai aplikasi. **Jangan buka situs ke warga selama ada GAGAL.** Sebelum migration pertama, GAGAL migration/tabel `jobs`/admin memang wajar; semua GAGAL lain diperbaiki dulu.

## A. Akun dan paket

1. Akun Hostinger memakai **email resmi desa**, 2FA aktif sebelum membeli. Akun hPanel bisa membuka file manager, database, backup, dan `.env` berisi `APP_KEY`: siapa pun yang menguasai akun ini menguasai seluruh data warga. Penanggung jawab teknis diberi akses lewat fitur akses/delegasi bila tersedia, bukan berbagi kata sandi.
2. Paket **Premium**. Pastikan saat membeli: SSH, cron, MySQL, dan PHP 8.3 tersedia. Sumber pihak ketiga menyebut Premium punya SSH dan cron, tetapi dokumentasi Hostinger tidak seragam: cek di halaman paket.
3. Lokasi server: **Indonesia** bila ada di daftar. Data pribadi warga yang dikelola pemerintah desa sebaiknya disimpan di Indonesia (lihat ketentuan PSE lingkup publik, PP 71/2019; konfirmasi ke desa/Diskominfo, dokumen ini bukan nasihat hukum). Bila Indonesia tidak tersedia, berhenti dan tanyakan Tech Lead.
4. Minta desa menyetujui **harga perpanjangan**, bukan harga promo tahun pertama. Catat tanggal perpanjangan hosting dan domain di dokumen serah terima (K8).

## B. Website, domain, SSL

1. hPanel → Websites → tambah website **kosong** untuk domain desa (jangan pasang WordPress atau builder). Domain `.id` boleh dibeli di Hostinger atau registrar lain; pemiliknya akun desa (K7).
2. Domain di registrar lain: arahkan nameserver ke Hostinger, atau buat record A `@` dan `www` ke IP hosting dari hPanel.
3. hPanel → Security → SSL: pasang SSL untuk `example.id` dan `www.example.id`. Website baru Hostinger sudah memakai SSL lifetime dengan redirect HTTPS platform menyala (12 November 2026); biarkan menyala, aman berdampingan dengan redirect `.htaccess`. Platform juga menambah header `Content-Security-Policy: upgrade-insecure-requests`.
4. Bila ada CDN Hostinger, biarkan mati dulu sampai seluruh uji § J lulus (cache CDN dapat menyimpan respons API atau HTML lama).

## C. PHP

hPanel → Advanced → PHP Configuration:

1. Versi **PHP 8.3** (`backend/composer.json` meminta `^8.3`).
2. Ekstensi aktif: `pdo_mysql`, `mysqli`, `mbstring`, `xml`/`dom`, `gd` (JPEG, PNG, WebP), `intl`, `bcmath`, `zip`, `curl`, `fileinfo`, `openssl`, `sodium`.
3. Opsi: `upload_max_filesize` dan `post_max_size` minimal 20M (Web Hosting Premium hanya menawarkan 1024M/1536M dan sudah 1536M saat dicek 20 November 2026; cukup) (pengajuan surat membawa 3 lampiran ≤ 5 MB per file; foto berita/UMKM ≤ 10 MB per file dan diperkecil server ke sisi terpanjang 2.000 px; 12M tidak cukup bahkan untuk 3 × 4 MB + overhead multipart, lihat `docs/integrasi.md` § Lampiran), `memory_limit = 256M` (foto 6000×6000 butuh ±170 MB saat diolah), `max_execution_time` minimal 60, `display_errors = Off`, `expose_php = Off` bila ada.

PHP **CLI** lewat SSH bisa berbeda versi dari PHP web. Cek setelah SSH aktif (§ E):

```bash
php -v
ls /opt/alt/ 2>/dev/null   # bila php CLI bukan 8.3, cari biner PHP 8.3 (mis. /opt/alt/php83/usr/bin/php)
php -m | grep -Ei '^(pdo_mysql|mbstring|dom|gd|intl|bcmath|zip|curl)$'
php -r 'var_dump(function_exists("imagejpeg"), function_exists("imagewebp"));'
```

Pakai biner yang sama untuk `PHP_BIN`, Composer, dan cron. Cek GD web dengan mengunggah satu foto fiktif dari panel admin setelah deploy.

## D. Database

hPanel → Databases → MySQL Databases:

1. Buat database dan user, misalnya `u123456789_watuagung`. Kata sandi panjang acak, langsung disimpan di password manager desa.
2. **Jangan** aktifkan Remote MySQL. Host untuk aplikasi biasanya `localhost` (lihat hPanel).
3. Catat versi server (phpMyAdmin → beranda, atau `mysql --version` lewat SSH). Tulis versinya di `docs/progres-*.md`; uji lokal harus memakai jenis dan versi yang sama.
4. Buat `~/.my.cnf` untuk backup (§ H), mode 600, dengan editor (`nano ~/.my.cnf`), bukan `echo`:

   ```ini
   [client]
   user=u123456789_watuagung
   password=<KATA_SANDI_DATABASE>
   host=localhost
   ```

   `chmod 600 ~/.my.cnf`.

## E. SSH

1. hPanel → Advanced → SSH Access: aktifkan. Catat IP, port (biasanya `65002`), dan username.
2. Tambahkan **kunci publik** SSH (`.pub`) di menu yang sama. Jangan unggah kunci privat. Setelah login kunci berhasil, ganti kata sandi SSH/hPanel menjadi acak panjang dan simpan di password manager.
3. Uji: `ssh -p 65002 u123456789@<IP>`.
4. Cek alat yang dibutuhkan:

   ```bash
   command -v git composer rsync tar curl mysqldump gpg openssl flock
   composer -V   # Composer 2
   ```

   Bila `rsync` tidak ada, `hostinger-deploy.sh` tidak bisa dipakai: hentikan dan laporkan ke Tech Lead. Bila `gpg` tidak ada, backup memakai `ENCRYPTOR=openssl` (§ H).

## F. Susunan folder

```text
/home/u123456789/
├── watuagung/                       # repo (APP_DIR), DI LUAR public_html
│   └── backend/.env                 # rahasia, mode 600
├── backups/watuagung/               # BACKUP_DIR
├── .config/watuagung/backup-passphrase
├── .my.cnf
└── domains/example.id/public_html/  # PUBLIC_HTML, dikelola hostinger-deploy.sh
    ├── index.html, _next/, ...      # isi out/
    ├── .htaccess                    # dari deploy/hostinger/.htaccess
    ├── laravel.php                  # penghubung /api/
    ├── storage -> /home/u123456789/watuagung/backend/storage/app/public
    └── panel/                       # ADMIN_PUBLIC_HTML bila docroot subdomain bersarang (§ N)
        ├── admin/, _next/, ...      # isi out/ yang sama
        └── .htaccess                # dari deploy/hostinger/admin.htaccess; TANPA laravel.php/storage
```

Docroot subdomain boleh juga sejajar (mis. `domains/example.id/panel_html/`); bila bersarang harus anak langsung `public_html` dan namanya tidak bentrok dengan isi `out/` (§ N). Tidak ada file `backend/` lain di `public_html`. `storage/app/private` (PDF surat) dan log tidak terjangkau dari web. `hostinger-deploy.sh` menolak repo yang berada di dalam `public_html`.

## G. Bootstrap pertama

Hanya untuk instalasi baru. Jangan menerima data warga selama bootstrap.

1. **Kode.** Repo publik: `git clone https://github.com/<pemilik>/<repo>.git ~/watuagung`. Repo privat: buat deploy key **read-only** di GitHub untuk server ini. Checkout tag rilis: `cd ~/watuagung && git checkout --detach <tag>`.
2. **Composer.** Composer butuh `proc_open`, yang dimatikan `disable_functions` Hostinger. Buat pembungkus yang mengaktifkannya **hanya untuk CLI** (PHP web tetap dibatasi), lalu pasang dependensi:

   ```bash
   mkdir -p ~/bin
   printf '#!/bin/sh\nexec php -d disable_functions= /usr/local/bin/composer "$@"\n' > ~/bin/composer-cli
   chmod 700 ~/bin/composer-cli
   cd ~/watuagung/backend && ~/bin/composer-cli install --no-dev --optimize-autoloader --no-interaction
   ```
3. **`.env`.** `cp .env.production.example .env` hanya bila `.env` belum ada. Isi domain dan kredensial database (§ D) dengan `nano`. `MEDIA_URL` **dibiarkan kosong**: URL media menjadi `https://<domain>/storage/...` lewat symlink `public_html/storage` (§ F). `chmod 600 .env`. Jangan menyalin `.env` dari laptop.
4. **Izin.** PHP berjalan sebagai user hosting yang sama, jadi tidak perlu grup bersama:

   ```bash
   chmod 700 storage/app/private storage/logs
   chmod 755 storage/app/public
   ```

5. **Kunci, hanya bila `APP_KEY` kosong pada instalasi baru:**

   ```bash
   php artisan config:clear
   php artisan key:generate --force
   ```

   **`APP_KEY` dibuat SEKALI. Salin segera ke password manager desa, terpisah dari backup. JANGAN pernah dibuat ulang: NIK/KK/telepon/alamat dan PDF surat akan hilang permanen.** Jangan `--show`, jangan tempel ke chat (termasuk asisten AI Kodee di hPanel).

6. **Database dan admin:**

   ```bash
   php artisan migrate --force
   php artisan site:import-defaults
   php artisan staff:create '<USERNAME_ADMIN>' --role=admin --name='<NAMA_ADMIN>'
   ```

   Jangan menjalankan seeder, `migrate:fresh`, atau `migrate:refresh` di produksi.

   Lalu `php artisan app:preflight --production` (§ Pemeriksaan pra-rilis; setelah langkah 5 juga sekali, sebelum migration). Setelah migration dan admin dibuat, hasilnya harus **0 GAGAL**.

7. **Frontend, di laptop** (dari root repo, commit yang sama dengan tag server):

   ```bash
   NEXT_PUBLIC_API_URL=https://example.id/api/v1 \
   NEXT_PUBLIC_DEMO_MODE=false \
   NEXT_PUBLIC_SHOW_SAMPLE_CONTENT=false \
   npm run build
   tar -C out -czf watuagung-web.tar.gz .
   scp -P 65002 watuagung-web.tar.gz u123456789@<IP>:~/
   ```

   Variabel proses mengalahkan `.env.local` laptop yang berisi API localhost. `NEXT_PUBLIC_COMPLAINT_FORM_URL` diambil dari `.env.production` (README § Persiapan). Jangan pakai `build:demo`. Skrip deploy menolak arsip yang memuat API localhost.

8. **Deploy pertama** (§ I), lalu cron (§ H) dan uji (§ J).

## H. Cron dan backup

hPanel → Advanced → Cron Jobs → Custom. **Jadwal cron Hostinger memakai UTC** (WIB = UTC+7). Gunakan path absolut; ganti biner PHP sesuai § C.

| Tugas | Jadwal (UTC) | Perintah |
|---|---|---|
| Prune token 00.00 WIB | `0 17 * * *` | `cd /home/u123456789/watuagung/backend && /opt/alt/php83/usr/bin/php artisan sanctum:prune-expired --hours=24 >/dev/null 2>&1` |
| Retensi 00.05 WIB | `5 17 * * *` | `cd /home/u123456789/watuagung/backend && /opt/alt/php83/usr/bin/php artisan applications:purge >/dev/null 2>&1` |
| Retensi lampiran 00.10 WIB | `10 17 * * *` | `cd /home/u123456789/watuagung/backend && /opt/alt/php83/usr/bin/php artisan attachments:purge >/dev/null 2>&1` |
| Masa unduh surat 00.15 WIB | `15 17 * * *` | `cd /home/u123456789/watuagung/backend && /opt/alt/php83/usr/bin/php artisan letters:expire-downloads >/dev/null 2>&1` |
| Antrean email tiap menit | `* * * * *` | `cd /home/u123456789/watuagung/backend && /opt/alt/php83/usr/bin/php artisan queue:work --stop-when-empty --max-time=50 --tries=3 >/dev/null 2>&1` |
| Backup 02.00 WIB | `0 19 * * *` | `/home/u123456789/bin/watuagung-backup.sh >> /home/u123456789/backups/watuagung/backup.log 2>&1` |

**Antrean email** (E1): `--max-time=50` membuat worker berhenti sebelum cron berikutnya; bila sesekali tumpang tindih, antrean database mengunci job per baris sehingga satu job tidak diproses dua kali. Pasang cron ini baru setelah § Email notifikasi selesai; tanpa job, perintah langsung keluar.

**Jangan pakai `schedule:run`.** Hostinger mematikan `proc_open` (juga di PHP CLI) dan scheduler Laravel menjalankan tiap tugas sebagai proses anak, sehingga tugas terjadwal gagal. Tugas harian di `routes/console.php` dipasang langsung sebagai cron di atas; bila menambah `Schedule::` baru, tambahkan juga cron-nya. `applications:purge` tidak mengubah apa pun selama `RETENTION_APPLICATION_DAYS` kosong. `attachments:purge` **aktif bawaan** (`ATTACHMENT_RETENTION_DAYS=30`): menghapus file lampiran permohonan `COMPLETED`/`REJECTED` setelah 30 hari; `0` mematikannya. (`media:prune` belum dipasang sebagai cron; di luar lingkup perubahan ini.) Perintah cron dibatasi **255 karakter**, sehingga backup memakai skrip pembungkus.

Backup:

```bash
mkdir -p ~/backups/watuagung ~/.config/watuagung && chmod 700 ~/backups ~/.config/watuagung
(umask 077; openssl rand -base64 48 > ~/.config/watuagung/backup-passphrase)
```

Salin passphrase ke password manager desa (terpisah dari `APP_KEY`). Skrip pembungkus `~/bin/watuagung-backup.sh` (mode 700), dipanggil cron:

```sh
#!/bin/sh
export APP_DIR=/home/u123456789/watuagung
export BACKUP_DIR=/home/u123456789/backups/watuagung
export PASSPHRASE_FILE=/home/u123456789/.config/watuagung/backup-passphrase
export DB_DRIVER=mysql DB_NAME=u123456789_watuagung
exec bash "$APP_DIR/deploy/backup.sh"
```

`~/.my.cnf` (§ D) dapat dibuat tanpa menampilkan kata sandi dengan menyalin dari konfigurasi Laravel di server: `umask 077; php artisan tinker --execute='$c = config("database.connections.mysql"); file_put_contents(getenv("HOME")."/.my.cnf", "[client]\nuser={$c["username"]}\npassword=\"{$c["password"]}\"\nhost=localhost\n");'`. Tambahkan `ENCRYPTOR=openssl` bila `gpg` tidak tersedia. Jalankan sekali manual lewat SSH sebelum memasang cron. Backup: `mysqldump --single-transaction` + seluruh `storage/app` (private dan public), dienkripsi, diuji dekripsi, rotasi 14 harian dan 8 mingguan. `.env`/`APP_KEY` tidak ikut.

**Lampiran persyaratan dan backup.** File KTP/KK/pengantar RT/RW ada di `storage/app/private/attachments/`, jadi ikut backup. Di dalam arsip isinya **tetap terenkripsi** dengan `APP_KEY` (selain enkripsi arsip backup); memulihkan backup tanpa `APP_KEY` yang sama berarti lampiran, surat PDF, dan field terenkripsi tidak dapat dibaca. Lampiran yang sudah dihapus retensi tetap ada di backup lama sampai rotasinya habis (±8 minggu).

**Perkiraan kuota disk lampiran.** Isi ±2–4 MB per permohonan (3 file; foto di-encode ulang ≤ 2.000 px biasanya jauh di bawah 1 MB, PDF hingga 5 MB). Enkripsi Laravel menyimpan isi sebagai base64 di dalam base64, sehingga file di disk ±1,8× isinya: ±3,5–7 MB per permohonan, terburuk ±27 MB (3 × 5 MB). Contoh: 150 permohonan/bulan dengan retensi 30 hari setelah selesai → kira-kira 1–2 GB aktif di `storage/app/private`, ditambah salinan di setiap backup harian/mingguan (arsip terkompresi; base64 terkompresi kembali sebagian). Pantau di hPanel → Files → Disk usage dan sesuaikan rotasi backup bila perlu.

**Salinan ke luar Hostinger wajib sebelum go-live.** Backup di akun yang sama hilang bersama akun. Pilih salah satu:

- `rclone` (biner statis) di `~/bin`, remote ke penyimpanan milik akun desa, lalu buka komentar rclone di `backup.sh`; atau
- komputer desa/penanggung jawab menarik `~/backups/watuagung/daily/` lewat `scp`/`rsync` terjadwal. Berkas sudah terenkripsi.

Backup otomatis Hostinger (mingguan pada Premium; cek di hPanel → Files → Backups) boleh dipakai sebagai pelengkap, tetapi **bukan pengganti**: isinya memuat `.env` dengan `APP_KEY` bersama database, dan pemulihannya menimpa file/database seluruhnya.

### Email notifikasi (E1, 20 November 2026)

Email status ke pemohon dikirim lewat SMTP Hostinger dari kotak surat domain sendiri. Rancangan: [docs/PROMPTS-EMAIL.md](../docs/PROMPTS-EMAIL.md); kontrak: `docs/integrasi.md` § Notifikasi email pemohon.

1. **Jangan aktifkan sebelum E2 ter-deploy.** Tautan berhenti berlangganan di email menuju halaman `/berhenti-email/` yang dibuat E2; sebelum itu biarkan `MAIL_MAILER=log`.
2. hPanel → Emails: buat kotak surat **`notifikasi@desawatuagung.com`** (sesuaikan bila domain diganti, § M). Kata sandi acak panjang, simpan di password manager desa. Kotak surat ini hanya untuk mengirim; balasan warga tetap diarahkan ke kontak kantor.
3. **SPF, DKIM, DMARC:** hPanel → Emails → kotak surat → bagian DNS/Email authentication. Bila DNS domain dikelola Hostinger, rekaman biasanya terpasang otomatis; pastikan ketiganya berstatus aktif. Tanpa itu email masuk spam. Bila DNS di tempat lain, salin rekaman yang ditampilkan hPanel ke pengelola DNS.
4. **Batas kirim:** cek hPanel → Emails → Mailboxes → *View limits*. Menurut halaman resmi Hostinger, Business Starter 1.000 email/hari dan Business Premium 3.000 email/hari per kotak surat (24 jam bergulir, maksimal 100 penerima per email). Satu email per perubahan status; permohonan biasa ±6–8 email. `mail()` PHP jauh lebih terbatas (10/menit, 100/hari), jadi wajib SMTP.
5. `backend/.env` (mode 600), sesuai `.env.production.example`. Nilai SMTP dari dokumentasi resmi Hostinger ([Setting Up Apps & Devices](https://docs.hostinger.com/emails/setup-devices), dicek 20 November 2026): host `smtp.hostinger.com`, port **465** dengan SSL/TLS (`MAIL_SCHEME=smtps`), username = alamat kotak surat lengkap. Cadangan bila 465 diblokir: port 587 STARTTLS (`MAIL_PORT=587`, `MAIL_SCHEME=smtp`). Nilai terbaru per kotak surat juga ada di hPanel → Emails → *Connect Apps & Devices*.

   ```dotenv
   QUEUE_CONNECTION=database
   MAIL_MAILER=smtp
   MAIL_HOST=smtp.hostinger.com
   MAIL_PORT=465
   MAIL_SCHEME=smtps
   MAIL_USERNAME=notifikasi@desawatuagung.com
   MAIL_PASSWORD=   # isi langsung di server, jangan di chat/Git
   MAIL_FROM_ADDRESS=notifikasi@desawatuagung.com
   MAIL_FROM_NAME="Pelayanan Desa Watuagung"
   SITE_URL=https://desawatuagung.com
   ```

   Lalu `php artisan config:cache` dan pasang cron *Antrean email* (§ H tabel).
6. Uji dengan data fiktif: ajukan dengan email uji milik tim, ubah status di panel, tunggu ≤ 1 menit, periksa kotak masuk (dan folder spam) serta header `SPF/DKIM: pass`. Gagal kirim tercatat di `storage/logs` sebagai `Email status pemohon gagal dikirim.` dengan alamat tersamar; status permohonan tidak terpengaruh. Job gagal permanen ada di tabel `failed_jobs`.

## I. Deploy rutin

### Rilis QR V2 (21 November 2026)

Instruksi berikut untuk operator manusia; perubahan dokumentasi tidak menghubungi atau mengubah server.

1. Ikuti maintenance, jeda seluruh penulis/cron, dan backup terverifikasi pada langkah deploy rutin di bawah. Jangan mengganti `APP_KEY`.
2. Edit **`backend/.env` yang benar-benar dipakai server**, bukan hanya `.env.production.example` di repo. Nilai lama eksplisit `LETTER_DOWNLOAD_DAYS=30` tetap mengalahkan bawaan baru sampai diubah:

   ```dotenv
   LETTER_DOWNLOAD_DAYS=7
   LETTER_VALIDITY_DAYS=7
   ```

3. Dengan kode V2 terpasang dan penulis tetap dijeda, segarkan konfigurasi agar migration/runtime membaca env baru, lalu jalankan migration dan bangun ulang cache (skrip deploy rutin juga menjalankan migration/cache):

   ```bash
   cd ~/watuagung/backend
   /opt/alt/php83/usr/bin/php artisan config:clear
   /opt/alt/php83/usr/bin/php artisan migrate --force
   /opt/alt/php83/usr/bin/php artisan config:cache
   ```

   Gunakan biner PHP produksi sesuai § C. Jangan membuka layanan/cron sebelum seluruh langkah deploy dan pemeriksaan selesai.
4. Migrasi mengisi `valid_until = ready_at + 7 hari` hanya untuk surat lama dengan `ready_at` nonnull; sumber lama `generated`/`uploaded` dipertahankan. `APPROVED` lama tidak otomatis dirilis dan PDF lama tidak dibuat ulang. Masa unduh baru 7 hari dihitung dari `ready_at` asli: jendela lama 30 hari dapat langsung tertutup saat deploy, bukan mendapat 7 hari baru. Beri tahu petugas sebelum rilis.
5. Pastikan persetujuan panel **dan** email langsung menghasilkan `READY_FOR_PICKUP`, PDF sistem terenkripsi, satu riwayat **Disetujui dan dirilis**, dan satu E1 status akhir. Upload bukan pemicu E1 lagi; `ApplicationTransition` memiliki transisi panel/email. Ganti PDF staff/admin hanya `READY_FOR_PICKUP`/`COMPLETED` selama masa berlaku, tanpa reset status/tenggat atau E1.
6. `letters:expire-downloads` tetap menutup masa unduh, **tidak menghapus PDF pada hari ke-7**. Retensi tetap melindungi PDF kedua sumber selama unduhan masih hidup. Verifikasi publik menampilkan nama lengkap melalui bearer QR, `no-store` dan throttle; `revoked` mengalahkan `expired`, kedaluwarsa hanya `now > valid_until`. QR bukan TTE tersertifikasi; keputusan desa menghapus alur wajib tanda tangan basah/scan, bukan menambahkan sertifikat TTE.

V2 mencakup backend/PDF dan kompatibilitas minimal validator respons. Pembaruan teks/layar/panel/privasi V3 terpisah; jangan menganggap deploy backend sudah memperbarui seluruh UI.

Sebelum tiap rilis (deploy in-place, **bukan atomik**):

1. Jadwalkan di luar jam layanan, tinjau migration dan uji pada salinan database target. Pastikan rilis tidak mengganti `APP_KEY`.
2. Nonaktifkan sementara seluruh cron penulis di hPanel (§ H), termasuk cron *Antrean email*, dan scheduler jika ada. Dengan kode lama masih terpasang, jalankan `php artisan down --retry=60` dari `backend/` memakai biner PHP produksi (§ C); tunggu request HTTP dan proses CLI yang sedang berjalan selesai. Maintenance HTTP **tidak** menghentikan perintah CLI/cron.
3. Dalam keadaan tanpa penulis aktif, jalankan backup manual database + `storage/app`, verifikasi arsip dapat didekripsi dan `APP_KEY` asli tersimpan terpisah. Jangan lanjut bila backup gagal. Dua variabel konfirmasi di bawah adalah pernyataan operator, **bukan** pemeriksaan backup/cron otomatis.
4. Jalankan skrip berikut dari rilis yang sudah memiliki pengaman ini. Skrip lama pada server tidak menjadi aman hanya karena tag tujuan berisi versi baru: perbarui skrip yang ditinjau terlebih dahulu, tanpa mengaktifkan kode aplikasi baru.

```bash
cd ~/watuagung
APP_DIR=$HOME/watuagung PUBLIC_HTML=$HOME/domains/example.id/public_html \
PHP_BIN=/opt/alt/php83/usr/bin/php COMPOSER_BIN=$HOME/bin/composer-cli \
DEPLOY_BACKUP_CONFIRMED=1 DEPLOY_WRITERS_PAUSED=1 \
bash deploy/hostinger-deploy.sh v1.0.0 --frontend ~/watuagung-web.tar.gz
```

Tanpa `--frontend`, hanya backend yang diperbarui dan `.htaccess`/`laravel.php`/symlink dipasang ulang; frontend lama di `public_html` harus cocok dengan commit backend. Dengan `--frontend`, `public_html` diselaraskan penuh (`rsync --delete`, kecuali `.well-known/`): file lain yang ditaruh manual di sana terhapus.

**Bila subdomain panel sudah dibuat di hPanel, setiap deploy wajib menyertakan `ADMIN_PUBLIC_HTML`** (mode P atau S, § N). Tanpa itu skrip memakai mode L dan `rsync --delete` **menghapus** docroot subdomain yang bersarang di `public_html`.

Urutan skrip: validasi (repo di luar `public_html`, konfirmasi backup/penulis, arsip berisi isi `out/` tanpa API localhost), lock satu deploy, fetch/resolve tag tanpa mengganti kode, `artisan down`, tunggu request lama (bawaan **120 detik**), checkout rilis, `composer install --no-dev`, validasi `.env` produksi (`APP_ENV`, `APP_DEBUG=false`, `APP_KEY`, `DB_CONNECTION=mysql|mariadb`, `APP_URL` https), `migrate --force`, cache config/route/view, pasang `public_html`, `artisan up`, smoke test. `DEPLOY_DRAIN_SECONDS` boleh diperbesar sesuai batas waktu request server; 120 detik bukan bukti semua request selesai. Operator wajib memastikan tidak ada penulis lama tersisa sebelum checkout. Tidak ada reload PHP; bila perubahan kode tidak terlihat, tunggu beberapa menit (opcache) atau restart PHP dari hPanel bila ada menunya.

Kegagalan setelah maintenance aktif menghentikan deploy dan mempertahankan/mengaktifkan ulang maintenance; kegagalan smoke test menutup layanan kembali. Ada jendela singkat layanan terbuka untuk smoke test; ini bukan deployment atomik. Jangan otomatis rollback migration, mengganti `APP_KEY`, mengaktifkan cron, atau menjalankan `artisan up` saat gagal. Periksa tahap gagal, pulihkan backup bila diperlukan, lalu uji ulang sebelum membuka layanan. Bila maintenance gagal diaktifkan ulang, blokir HTTP lewat hPanel. Frontend statis tetap bisa dibuka saat API maintenance.

Lock `.hostinger-deploy.lock` menolak deploy bersamaan dan dilepas saat skrip keluar normal/gagal. Setelah proses dibunuh paksa atau mesin mati, lock bisa tertinggal; pastikan tidak ada proses deploy sebelum menghapus direktori lock secara manual. `SIGKILL`/listrik mati tidak dapat ditangani trap. Bila kode/vendor rusak, maintenance Laravel sendiri belum tentu dapat berjalan; pemblokiran HTTP di tingkat hosting diperlukan.

Sebelum menjalankan skrip, bila `.env` diubah untuk rilis ini, jalankan `php artisan app:preflight --production` pada kode yang terpasang (tersedia sejak rilis yang memuatnya) dan perbaiki GAGAL selain migration tertunda. Setelah skrip sukses, jalankan lagi `php artisan app:preflight --production`: harus **0 GAGAL**; bila ada GAGAL, `php artisan down` dan perbaiki dulu. Lalu lakukan uji § J, baru aktifkan kembali cron/worker yang tadi dijeda. Hapus arsip setelah selesai: `rm ~/watuagung-web.tar.gz`. Pengaman ini tidak menjamin semua migration kompatibel: campuran plaintext/ciphertext tetap harus ditinjau dan dipulihkan pada salinan database, bukan dilewati pengamannya.

## J. Uji setelah deploy

Di server: `php artisan app:preflight --production` → **0 GAGAL** (§ Pemeriksaan pra-rilis). Dari laptop:

```bash
bash deploy/smoke-test.sh example.id
# Mode S (§ N): tambahkan --admin admin.example.id, dan --admin-dir <folder> bila docroot bersarang.
# Mode P bersarang: --admin-dir <folder> saja.
curl -sI https://example.id/ | grep -Ei 'strict-transport|content-security|x-frame|cache-control'
for p in /persetujuan/ /verifikasi-email/ /berhenti-email/; do   # E4: harus no-referrer (token di URL)
  printf '%s ' "$p"; curl -sI "https://example.id$p" | grep -i '^referrer-policy'
done
for p in /.env /.htaccess /laravel.php /storage/x.php /storage/; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://example.id$p"   # semua 403/404
done
curl -s -o /dev/null -w '%{http_code}\n' http://example.id/   # 301
```

Lalu di browser (390px dan 1440px): pengajuan fiktif sampai surat dibuat, cek status, login petugas, unggah foto berita fiktif (GD), unduh PDF surat, pindai QR dengan ponsel, peta dan video YouTube tanpa pelanggaran CSP di console.

Bila `/storage/<file>` yang ada menghasilkan **403**: cek `ls -l public_html/storage` dan pemilik folder target. `.htaccess` memakai `SymLinksIfOwnerMatch` (pemilik symlink dan target harus sama). Bila tetap 403, laporkan ke Tech Lead sebelum mengganti ke `FollowSymLinks`. Uji lokal 12 November dengan Apache 2.4 Windows hanya lulus memakai `FollowSymLinks` karena junction Windows tidak lolos pemeriksaan pemilik.

## K. Batasan dan risiko yang diterima

Butuh keputusan Tech Lead sebelum go-live:

1. **Query string di access log.** Log Hostinger mencatat URL lengkap: `q=<nama warga>` dari pencarian petugas (`GET /api/v1/staff/applications?q=`), `id=REQ-…` pada halaman sukses/cek status, `kode=` pada verifikasi QR, bila halaman dimuat langsung dari server. Kode akses dan NIK tidak ada di URL. Pilihan: terima dan catat sebagai risiko (log hanya bisa dibuka lewat akun hPanel), atau tugas terpisah untuk memindahkan pencarian ke body POST.
2. **Satu user untuk PHP dan kode.** Celah di aplikasi bisa mengubah kode di `~/watuagung`. Tidak ada pemisahan seperti user deploy/PHP-FPM di VPS.
3. **Sumber daya bersama.** Batas CPU/proses shared hosting dapat memperlambat pembuatan PDF dan olah foto saat ramai. Pantau di hPanel → Resource usage.
4. **Tanpa kontrol firewall/fail2ban.** Perlindungan login bergantung pada rate limit Laravel.
5. **MySQL diuji di MariaDB 11.4.8 lokal saja**; cocokkan dengan versi Hostinger (status di atas).

## L. Pemulihan

Ke website/database **kosong** (uji wajib: subdomain uji di akun yang sama, misalnya `uji.example.id`, dengan database terpisah; hapus setelah selesai):

1. Kode tag yang sama, `composer install`, `.env` baru dengan **`APP_KEY` asli** dari password manager (tempel lewat editor). **Jangan `key:generate`.**
2. Buka backup:

   ```bash
   umask 077; mkdir ~/restore && cd ~/restore
   gpg --batch --pinentry-mode loopback --passphrase-file ~/.config/watuagung/backup-passphrase \
     --decrypt watuagung-YYYYMMDD-HHMMSS.tar.gpg | tar -xf -
   # openssl: openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass file:$HOME/.config/watuagung/backup-passphrase -in watuagung-….tar.enc | tar -xf -
   ```

3. Database kosong: `mysql <NAMA_DB_TUJUAN> < db.sql` (kredensial dari `~/.my.cnf`; buat berkas cnf terpisah bila user database tujuan berbeda, lalu `mysql --defaults-extra-file=…`).
4. File: `tar -C ~/watuagung/backend/storage -xf storage.tar`.
5. Frontend dibangun dengan domain tujuan, lalu `hostinger-deploy.sh <tag yang sama> --frontend …`.
6. Uji wajib dari [restore.md](restore.md) § Uji wajib: NIK permohonan fiktif terbaca, PDF surat terbuka, media publik tampil, smoke test lulus. Catat di `docs/progres-*.md` tanpa data pribadi.
7. `rm -rf ~/restore` (berisi dump tidak terenkripsi). Hapus subdomain dan database uji.

## M. Mengganti domain

Domain awal `desawatuagung.com` (dipilih di onboarding hPanel 12 November 2026) boleh diganti, misalnya ke `.id`. Ganti **sebelum** surat pertama diterbitkan bila bisa: QR di PDF yang sudah terbit menunjuk domain lama untuk selamanya.

1. **hPanel:** tambahkan domain baru ke website yang sama (atau ganti domain utama), pasang SSL untuk domain baru dan `www`. Catat folder `public_html` barunya, biasanya `~/domains/<domain-baru>/public_html`.
2. **Domain lama tetap aktif** dan dialihkan 301 ke domain baru, termasuk path dan query string, agar QR lama (`/verifikasi/?kode=…`) tetap jalan. Jangan biarkan domain lama kedaluwarsa selama masih ada surat yang beredar.
3. **`backend/.env` di server** (edit dengan `nano`, lalu `php artisan config:clear` dan `php artisan app:preflight --production`; `MEDIA_URL` tetap kosong):

   | Kunci | Nilai baru |
   |---|---|
   | `APP_URL` | `https://<domain-baru>` |
   | `FRONTEND_ORIGINS` | `https://<domain-baru>` (ditambah `,https://admin.<domain-baru>` bila panel di subdomain, § N) |
   | `LETTER_VERIFY_URL` | `https://<domain-baru>/verifikasi/` |
   | `SITE_URL` | `https://<domain-baru>` |

4. **Frontend di laptop:** build ulang dengan `NEXT_PUBLIC_API_URL=https://<domain-baru>/api/v1` (§ G langkah 7), lalu buat arsip baru. URL API dibekukan di arsip, jadi arsip lama tidak bisa dipakai.
5. **Deploy:** `PUBLIC_HTML=$HOME/domains/<domain-baru>/public_html bash deploy/hostinger-deploy.sh <tag> --frontend <arsip-baru>`. Skrip membaca domain smoke test dari `APP_URL`.
6. **Yang tidak berubah:** `.htaccess`, `laravel.php`, cron (path repo), backup, database, `APP_KEY`. **Jangan** menjalankan `key:generate`.
7. Catat domain baru di `docs/deploy-plan.md` (K7) dan dokumen serah terima, lalu jalankan uji § J untuk domain baru.

## N. Panel di subdomain

Panel petugas disajikan dari `https://admin.desawatuagung.com/admin/` (docroot `public_html/panel-admin`, dibuat 21 November 2026) memakai arsip `out/` yang sama; API tetap di domain utama. Rencana dan keputusan D1–D7: [docs/PROMPTS-ADMIN-SUBDOMAIN.md](../docs/PROMPTS-ADMIN-SUBDOMAIN.md), [docs/deploy-plan.md](../docs/deploy-plan.md) § Panel di subdomain. Origin terpisah membatasi pembacaan token sesi panel oleh skrip di situs publik; ini bukan penyembunyian dan tidak menggantikan kata sandi kuat, throttle login, atau CSP.

### Mode skrip

| Mode | `ADMIN_PUBLIC_HTML` | `ADMIN_ORIGIN` | Hasil |
|---|---|---|---|
| L (lama) | kosong | kosong | Persis seperti sebelumnya: satu docroot, `.htaccess` utama tanpa blok `admin-subdomain`. **Menghapus** folder lain di `public_html`, termasuk docroot subdomain bersarang. |
| P (lindungi, tahap 1) | docroot subdomain | kosong | Docroot subdomain tidak disentuh dan dikecualikan dari `rsync --delete` utama; bila bersarang, `public_html/<folder>/` ditolak (403) dari host utama. `/admin/` utama tetap disajikan, tanpa redirect. |
| S (subdomain, tahap 2) | docroot subdomain | `https://admin.<domain>` | Subdomain diisi arsip + `admin.htaccess`; `/admin` domain utama dialihkan 302 (query ikut) dan folder `admin/` utama dihapus. |

`ADMIN_ORIGIN` tanpa `ADMIN_PUBLIC_HTML` → GAGAL. Validasi sebelum maintenance: `ADMIN_PUBLIC_HTML` ada (`realpath -e`), bukan `PUBLIC_HTML`, tidak berisi `PUBLIC_HTML`, tidak di dalam/berisi repo; bila di dalam `public_html` harus **anak langsung** dengan nama yang tidak bentrok dengan isi arsip (`admin`, `_next`, `berita`, `umkm`, `pelayanan`, `storage`, `api`, dll.); symlink di `public_html` yang menunjuk docroot sejajar ditolak. `ADMIN_ORIGIN` huruf kecil `https://<sub>.<domain>` tanpa path/port; setelah konfigurasi dibaca, wajib subdomain langsung host `APP_URL` **dan** tercantum di `FRONTEND_ORIGINS` (gagal = layanan tetap maintenance). Mode S mewajibkan `admin/index.html` di arsip, atau di docroot subdomain bila tanpa `--frontend`.

Docroot bersarang membuat `.htaccess` utama ikut dibaca untuk subdomain. `admin.htaccess` karena itu memakai `RewriteEngine On` sendiri (aturan rewrite induk tidak diwarisi), mengulang HTTPS/ACME/blok dotfile/PHP, menimpa header induk dengan `Header always set`, menghapus CSP penegak, dan **menolak host selain panel**. Aturan `[F]` di `.htaccess` utama saja tidak cukup, karena tidak berlaku di bawah `RewriteEngine` milik subfolder.

### Langkah (manusia)

1. **Tahap 1, saat subdomain dibuat.** hPanel → Domains → Subdomains: buat `admin` dengan **folder kustom** `panel-admin`. **Jangan pakai folder bawaan `public_html/admin`**: itu folder panel situs utama, deploy mode S akan menghapusnya, dan subdomain tidak bisa memuat `/_next/`. Skrip menolak nama itu. Pasang SSL untuk `admin.<domain>`; cek `nslookup admin.<domain>`. **Mulai saat ini setiap deploy memakai mode P** (`ADMIN_PUBLIC_HTML=<docroot>`), atau docroot bersarang terhapus.
2. **`backend/.env`:** `FRONTEND_ORIGINS=https://<domain>,https://admin.<domain>`; `SITE_URL` tetap domain utama. `php artisan config:clear` lalu `php artisan app:preflight --production` → 0 GAGAL.
3. **Build di laptop** dengan `NEXT_PUBLIC_SITE_URL=https://<domain>` dan `NEXT_PUBLIC_ADMIN_URL=https://admin.<domain>` selain env § G langkah 7 (tautan lintas origin, sesi A1).
4. **Tahap 2, deploy mode S** (prosedur § I, termasuk maintenance, backup, dan penulis dijeda):

   ```bash
   cd ~/watuagung
   APP_DIR=$HOME/watuagung PUBLIC_HTML=$HOME/domains/example.id/public_html \
   ADMIN_PUBLIC_HTML=$HOME/domains/example.id/public_html/panel-admin ADMIN_ORIGIN=https://admin.example.id \
   PHP_BIN=/opt/alt/php83/usr/bin/php COMPOSER_BIN=$HOME/bin/composer-cli \
   DEPLOY_BACKUP_CONFIRMED=1 DEPLOY_WRITERS_PAUSED=1 \
   bash deploy/hostinger-deploy.sh <tag> --frontend ~/watuagung-web.tar.gz
   ```

   Smoke test otomatis memakai `--admin` (dan `--admin-dir` bila bersarang): redirect `/admin` + query, `panel/` → `/admin/`, panel 200 dengan `X-Robots-Tag` noindex dan tepat satu CSP Report-Only, `/api/` subdomain 403, halaman non-panel → domain utama, `laravel.php`/`.env` 403/404, folder bersarang tertutup dari host utama, preflight CORS origin panel 204 + `Access-Control-Allow-Origin`, origin asing tanpa header itu. Header `Content-Security-Policy: upgrade-insecure-requests` dari platform Hostinger dibiarkan.
5. **Uji manual** rencana § 8 (login semua peran, alur fiktif penuh, lampiran, unggah foto, `sessionStorage` hanya di origin panel), lalu umumkan alamat baru. Selama masa uji redirect tetap **302** (D6); ganti ke 301 di template `.htaccess` setelah ±1 minggu (A4).
6. **Basic Auth (D3, ditunda).** hPanel → Password Protect Directories menulis ke `.htaccess` docroot subdomain, yang **ditimpa** deploy berikutnya. Untuk mengaktifkan: buat `.htpasswd` di luar `public_html`, buka komentar bagian Basic Auth di `deploy/hostinger/admin.htaccess` dengan path absolutnya (tanpa kredensial di repo), deploy ulang. Smoke test `--admin` lalu akan GAGAL 401 pada pemeriksaan subdomain; lakukan pemeriksaan itu manual dengan kredensial.

### Rollback

- **Cepat:** deploy ulang tag sebelumnya (atau tag yang sama) dengan arsip yang masih berisi `admin/`, memakai **mode P** (`ADMIN_PUBLIC_HTML` saja): blok redirect hilang, `admin/` kembali ke domain utama, docroot subdomain tetap utuh. Jangan rollback dengan mode L selama docroot subdomain bersarang masih dipakai.
- Karena masa uji memakai 302, browser tidak menyimpan pengalihan. Setelah 301, petugas mungkin perlu membersihkan cache.
- `FRONTEND_ORIGINS` boleh tetap memuat origin panel. Tidak ada perubahan database.

## Daftar periksa

- [ ] Akun Hostinger email desa, 2FA, Premium, lokasi Indonesia, harga perpanjangan disetujui desa.
- [ ] Website kosong, domain, SSL; CDN mati sampai uji § J lulus.
- [ ] PHP 8.3 web dan CLI, ekstensi dan opsi § C, GD JPEG/WebP.
- [ ] Database dan user khusus, Remote MySQL mati, versi tercatat.
- [ ] **Tes backend dan uji penomoran lulus pada MySQL/MariaDB versi Hostinger** (lulus di MariaDB 11.4.8 lokal 13 November 2026; versi Hostinger belum dicocokkan).
- [ ] SSH dengan kunci; `rsync`, `git`, `composer`, `mysqldump`, `gpg`/`openssl` tersedia.
- [ ] Bootstrap § G; `APP_KEY` di password manager.
- [ ] `php artisan app:preflight --production` 0 GAGAL setelah `.env`, setelah migration, dan setelah deploy; PERINGATAN sudah dibaca.
- [ ] Deploy § I dan uji § J lulus.
- [ ] Panel subdomain (§ N): subdomain + SSL; sejak subdomain dibuat setiap deploy memakai `ADMIN_PUBLIC_HTML` (mode P); `FRONTEND_ORIGINS` memuat origin panel; deploy mode S dengan smoke test `--admin` lulus; uji manual dan masa 302 selesai sebelum 301.
- [ ] Cron scheduler dan backup (UTC); backup manual dan uji dekripsi lulus; salinan ke luar Hostinger aktif.
- [ ] Email notifikasi (§ H Email notifikasi) hanya setelah E2: kotak surat, SPF/DKIM/DMARC aktif, batas kirim dicatat, cron antrean, uji kirim lulus.
- [ ] Uji pemulihan § L lulus.
- [ ] Keputusan § K dicatat.
