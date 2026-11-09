# Deploy satu VPS — static export + Laravel

**Manusia menjalankan seluruh perintah server.** Berkas ini tidak memasang Nginx, PHP-FPM, PostgreSQL, HTTPS, backup atau firewall. Agent tidak menjalankan SSH, push atau deploy. Satu domain: frontend statis di `/`, Laravel di `/api/v1`.

## Persiapan sekali

1. Ikuti [first-deploy.md](first-deploy.md) sebelum deploy rutin. Siapkan checkout rilis, dependensi, `.env`, izin runtime, kunci, migration, impor konten dan admin pertama. Jangan membuka penerimaan data warga selama bootstrap.
2. Ganti `<domain>` pada kedua contoh env. Salin frontend `.env.production.example` menjadi `.env.production` **hanya bila file tujuan belum ada**, lalu isi domain sebenarnya. `NEXT_PUBLIC_*` dibekukan saat build, tidak boleh berisi rahasia. Empat nama env sesuai pembaca kode; `NEXT_PUBLIC_SITE_URL` tidak dibaca kode sehingga tidak ditambahkan. Jangan gunakan `build:demo` untuk produksi.
3. Jangan biarkan `.env.local`, `.env.production.local` atau environment shell warisan mengubah build: Next.js memprioritaskan environment proses dan file lokal di atas `.env.production`. Skrip mengunci API URL ke `APP_URL/api/v1` dan kedua flag ke `false`; URL pengaduan tetap dari env build yang Anda siapkan. Build di laptop wajib memakai konfigurasi produksi, bukan API localhost.
4. Siapkan Nginx: root hanya `WEB_ROOT`, `index.html`/trailing slash sesuai static export; gunakan `out/404.html` untuk 404 (tautan berita lama melakukan redirect browser). `/api/` diteruskan ke `APP_DIR/backend/public/index.php` lewat PHP-FPM, dengan path API tetap utuh dan `HTTPS=on` untuk HTTPS langsung. Jangan gunakan fallback frontend 200 untuk galat API. Tolak dotfile, `/backend/`, `.git`, PHP di luar front controller, dan akses file repo lainnya. Jangan jadikan root repo sebagai document root.
5. Pasang `Strict-Transport-Security` dan `X-Content-Type-Options: nosniff` dengan `always` pada respons frontend **dan API, termasuk 4xx/5xx**; redirect HTTP ke HTTPS. Siapkan CSP/peta/YouTube, batas unggah 11m pada Nginx, PHP `upload_max_filesize` minimal 10M dan `post_max_size` 12M, serta access log tanpa query string API sesuai [rencana infrastruktur](../docs/deploy-plan.md). Uji konfigurasi sebelum reload Nginx.
6. Keputusan sesi ini mengganti rencana lama prefix `/media`: `MEDIA_URL` kosong memakai `APP_URL/storage`. Konfigurasikan alias Nginx terbatas ke direktori `backend/storage/app/public/posts`, `businesses`, `site/structure` (hanya UUID `.webp`/`.jpg`) dan `site/documents` (hanya UUID `.pdf`), masing-masing pada `/storage/<direktori>/`. Tanpa listing, eksekusi PHP, atau fallback PHP-FPM; selain daftar ini 404. Jangan mengekspos seluruh `storage/`, file privat, log atau `.env`. Symlink `backend/public/storage` saja tidak membuat media tersedia pada root frontend terpisah. Uji gambar/PDF ada, hilang, ekstensi terlarang dan unggah sebelum rilis.
7. Pasang cron [crontab.txt](crontab.txt) sebagai user deploy; pastikan `php` pada PATH cron versi benar (atau ganti dengan path absolut). Belum ada job sehingga `QUEUE_CONNECTION=sync`, tidak perlu worker. `MAIL_MAILER=log`: R11 belum aktif, tidak mengirim email. `RETENTION_APPLICATION_DAYS` kosong: anonimisasi otomatis mati sampai keputusan desa.

## Deploy rutin

Sebelum tiap rilis: buat backup PostgreSQL dan seluruh storage persisten (privat **dan** publik), uji prosedur pemulihan, dan pertahankan `.env`/`APP_KEY`. Tinjau migration; migration ability 8 November mencabut semua token petugas sehingga perlu login ulang. Jadwalkan jeda layanan bila perubahan tidak kompatibel. Deploy ini **in-place, bukan atomik**; gagal build/smoke test tidak otomatis memulihkan kode/database. Jangan menjalankan dua deploy bersamaan.

Variabel di awal skrip bisa diubah lewat environment:

| Variabel | Bawaan | Fungsi |
| --- | --- | --- |
| `APP_DIR` | `/srv/watuagung` | Root checkout Git, di luar web root |
| `WEB_ROOT` | `/var/www/watuagung` | Direktori khusus hasil export; isinya dihapus/diselaraskan oleh `rsync --delete` |
| `PHP_FPM_SERVICE` | `php8.3-fpm` | Nama service systemd FPM yang terpasang |
| `PHP_BIN` | `php` | PHP CLI; samakan PHP pada PATH Composer dan cron |

User deploy harus bisa menulis checkout/WEB_ROOT dan runtime Laravel melalui grup bersama PHP-FPM. Atur izin sudo **hanya** untuk reload service FPM yang dipilih; `sudo -n` gagal, bukan meminta kata sandi interaktif. Jangan menjalankan seluruh skrip sebagai root. Node **24.x** sesuai `package.json`, `npm ci` harus menyertakan devDependencies untuk build; jangan set `NODE_ENV=production`/`omit=dev` saat instalasi frontend.

```bash
APP_DIR=/srv/watuagung WEB_ROOT=/var/www/watuagung \
PHP_FPM_SERVICE=php8.3-fpm PHP_BIN=/usr/bin/php8.3 \
bash deploy/deploy.sh v1.0.0
```

Tag diutamakan bila tag dan branch bernama sama. Checkout server hanya untuk rilis dari `origin`: fetch memangkas branch/tag yang dihapus di origin (termasuk tag lokal khusus server). Branch selalu diambil dari `origin`, bukan branch lokal usang; checkout detached pada commit hasil fetch. Skrip tidak melakukan reset/clean atau menghapus storage. `config:clear` sebelum migration memastikan `.env` terbaru dibaca; sesudah migration, konfigurasi/route/view di-cache lagi. `storage:link` dilewati hanya bila symlink benar; path salah membuat deploy berhenti. Composer memakai PHP dari PATH: cocokkan dengan `PHP_BIN`.

Frontend dibangun di laptop (konfigurasi produksi yang sama), lalu **isi** `out/` diunggah manual ke `WEB_ROOT` dan file lama dibersihkan secara terkontrol:

```bash
APP_DIR=/srv/watuagung WEB_ROOT=/var/www/watuagung \
PHP_FPM_SERVICE=php8.3-fpm PHP_BIN=/usr/bin/php8.3 \
bash deploy/deploy.sh v1.0.0 --skip-frontend
```

Opsi ini melewati instalasi/build/salin frontend, bukan reload FPM atau smoke test. Frontend manual harus sesuai commit backend; jangan unggah `.env`, repo, `node_modules`, atau `backend/` ke WEB_ROOT.

## Pemeriksaan

```bash
for script in deploy/*.sh; do bash -n "$script" || exit 1; done
bash deploy/test-scripts.sh
bash deploy/smoke-test.sh desa.example.id
```

`bash -n` memeriksa satu file per pemanggilan; untuk seluruh skrip gunakan `for script in deploy/*.sh; do bash -n "$script" || exit 1; done`. ShellCheck opsional: `shellcheck deploy/*.sh` bila tersedia. `test-scripts.sh` memakai stub HTTP/perintah lokal, tidak menghubungi VPS dan tidak menjalankan migration sungguhan.

Smoke test butuh curl dan PHP CLI (JSON parser bawaan); HTTPS diverifikasi tanpa `-k`, tanpa mengikuti redirect. Memeriksa 200 frontend/posts, JSON 404 verifikasi, JSON 422 login kosong, penolakan akses env termasuk traversal `--path-as-is`, kedua header keamanan dan pola stack trace/path server pada galat API. Semua kegagalan diringkas, exit 1 bila ada yang gagal. Tidak mencetak body galat agar potensi rahasia tidak ikut log. Satu kali tes login memakai kuota rate limit; jangan menjalankan berulang cepat. Pencarian path bersifat heuristik, bukan audit kebocoran menyeluruh.

**APP_KEY dibuat SEKALI di server. Cadangkan di luar server, terpisah dari backup database. JANGAN pernah dibuat ulang — data terenkripsi akan hilang.** Skrip rutin tidak membuat kunci. Saat gagal: hentikan rilis, periksa langkah yang disebut, lakukan pemulihan terkontrol dengan kunci asli; jangan menjalankan migration destruktif atau membuat kunci pengganti.

Hasil verifikasi lokal dan temuan grep build: [catatan sesi](../docs/progres-2026-11-09-deploy.md). Kelulusan lokal tidak membuktikan Nginx/FPM/HTTPS produksi benar atau seluruh syarat M8 terpenuhi.
