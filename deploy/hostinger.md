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
3. Opsi: `upload_max_filesize = 12M`, `post_max_size = 12M`, `memory_limit = 256M` (foto 6000×6000 butuh ±170 MB saat diolah), `max_execution_time` minimal 60, `display_errors = Off`, `expose_php = Off` bila ada.

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
    └── storage -> /home/u123456789/watuagung/backend/storage/app/public
```

Tidak ada file `backend/` lain di `public_html`. `storage/app/private` (PDF surat) dan log tidak terjangkau dari web. `hostinger-deploy.sh` menolak repo yang berada di dalam `public_html`.

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
3. **`.env`.** `cp .env.production.example .env` hanya bila `.env` belum ada. Isi domain dan kredensial database (§ D) dengan `nano`. `chmod 600 .env`. Jangan menyalin `.env` dari laptop.
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
| Backup 02.00 WIB | `0 19 * * *` | `/home/u123456789/bin/watuagung-backup.sh >> /home/u123456789/backups/watuagung/backup.log 2>&1` |

**Jangan pakai `schedule:run`.** Hostinger mematikan `proc_open` (juga di PHP CLI) dan scheduler Laravel menjalankan tiap tugas sebagai proses anak, sehingga tugas terjadwal gagal. Dua tugas harian di `routes/console.php` dipasang langsung sebagai cron di atas; bila menambah `Schedule::` baru, tambahkan juga cron-nya. `applications:purge` tidak mengubah apa pun selama `RETENTION_APPLICATION_DAYS` kosong. Perintah cron dibatasi **255 karakter**, sehingga backup memakai skrip pembungkus.

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

**Salinan ke luar Hostinger wajib sebelum go-live.** Backup di akun yang sama hilang bersama akun. Pilih salah satu:

- `rclone` (biner statis) di `~/bin`, remote ke penyimpanan milik akun desa, lalu buka komentar rclone di `backup.sh`; atau
- komputer desa/penanggung jawab menarik `~/backups/watuagung/daily/` lewat `scp`/`rsync` terjadwal. Berkas sudah terenkripsi.

Backup otomatis Hostinger (mingguan pada Premium; cek di hPanel → Files → Backups) boleh dipakai sebagai pelengkap, tetapi **bukan pengganti**: isinya memuat `.env` dengan `APP_KEY` bersama database, dan pemulihannya menimpa file/database seluruhnya.

## I. Deploy rutin

Sebelum tiap rilis: jalankan backup manual, tinjau migration, jadwalkan di luar jam layanan. Deploy in-place, **bukan atomik**.

```bash
cd ~/watuagung
APP_DIR=$HOME/watuagung PUBLIC_HTML=$HOME/domains/example.id/public_html \
PHP_BIN=/opt/alt/php83/usr/bin/php COMPOSER_BIN=$HOME/bin/composer-cli \
bash deploy/hostinger-deploy.sh v1.0.0 --frontend ~/watuagung-web.tar.gz
```

Tanpa `--frontend`, hanya backend yang diperbarui dan `.htaccess`/`laravel.php`/symlink dipasang ulang; frontend lama di `public_html` harus cocok dengan commit backend. Dengan `--frontend`, `public_html` diselaraskan penuh (`rsync --delete`, kecuali `.well-known/`): file lain yang ditaruh manual di sana terhapus.

Urutan skrip: validasi (repo di luar `public_html`, arsip berisi isi `out/` tanpa API localhost), fetch tag, `composer install --no-dev`, validasi `.env` produksi (`APP_ENV`, `APP_DEBUG=false`, `APP_KEY`, `DB_CONNECTION=mysql|mariadb`, `APP_URL` https), `migrate --force`, cache config/route/view, pasang `public_html`, smoke test. Tidak ada reload PHP; bila perubahan kode tidak terlihat, tunggu beberapa menit (opcache) atau restart PHP dari hPanel bila ada menunya. Hapus arsip setelah selesai: `rm ~/watuagung-web.tar.gz`.

## J. Uji setelah deploy

Dari laptop:

```bash
bash deploy/smoke-test.sh example.id
curl -sI https://example.id/ | grep -Ei 'strict-transport|content-security|x-frame|cache-control'
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
3. **`backend/.env` di server** (edit dengan `nano`, lalu `php artisan config:clear`):

   | Kunci | Nilai baru |
   |---|---|
   | `APP_URL` | `https://<domain-baru>` |
   | `FRONTEND_ORIGINS` | `https://<domain-baru>` |
   | `LETTER_VERIFY_URL` | `https://<domain-baru>/verifikasi/` |

4. **Frontend di laptop:** build ulang dengan `NEXT_PUBLIC_API_URL=https://<domain-baru>/api/v1` (§ G langkah 7), lalu buat arsip baru. URL API dibekukan di arsip, jadi arsip lama tidak bisa dipakai.
5. **Deploy:** `PUBLIC_HTML=$HOME/domains/<domain-baru>/public_html bash deploy/hostinger-deploy.sh <tag> --frontend <arsip-baru>`. Skrip membaca domain smoke test dari `APP_URL`.
6. **Yang tidak berubah:** `.htaccess`, `laravel.php`, cron (path repo), backup, database, `APP_KEY`. **Jangan** menjalankan `key:generate`.
7. Catat domain baru di `docs/deploy-plan.md` (K7) dan dokumen serah terima, lalu jalankan uji § J untuk domain baru.

## Daftar periksa

- [ ] Akun Hostinger email desa, 2FA, Premium, lokasi Indonesia, harga perpanjangan disetujui desa.
- [ ] Website kosong, domain, SSL; CDN mati sampai uji § J lulus.
- [ ] PHP 8.3 web dan CLI, ekstensi dan opsi § C, GD JPEG/WebP.
- [ ] Database dan user khusus, Remote MySQL mati, versi tercatat.
- [ ] **Tes backend dan uji penomoran lulus pada MySQL/MariaDB versi Hostinger** (lulus di MariaDB 11.4.8 lokal 13 November 2026; versi Hostinger belum dicocokkan).
- [ ] SSH dengan kunci; `rsync`, `git`, `composer`, `mysqldump`, `gpg`/`openssl` tersedia.
- [ ] Bootstrap § G; `APP_KEY` di password manager.
- [ ] Deploy § I dan uji § J lulus.
- [ ] Cron scheduler dan backup (UTC); backup manual dan uji dekripsi lulus; salinan ke luar Hostinger aktif.
- [ ] Uji pemulihan § L lulus.
- [ ] Keputusan § K dicatat.
