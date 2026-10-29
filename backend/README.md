# API Laravel Desa Watuagung

Backend ini melayani formulir administrasi dan panel petugas dari frontend Next.js pada direktori induk. Teknologi: PHP 8.3+, Laravel 13, Sanctum, dan SQLite untuk pengembangan. Tidak ada data warga contoh yang otomatis dimasukkan ke database.

Panduan terkait: [README utama](../README.md), [indeks dokumentasi](../docs/README.md), [kontrak integrasi](../docs/integrasi.md), dan [status roadmap](../ROADMAP.md).

## Struktur backend

| Lokasi | Isi |
| --- | --- |
| `app/Domain/` | Aturan status/peran, wilayah, kode akses, nomor surat, dan PDF |
| `app/Http/Controllers/Api/` | Endpoint pelayanan dan panel petugas |
| `app/Models/` | Model dan perlindungan data sensitif |
| `routes/` | Route API/web, CLI akun, dan jadwal pembersihan token |
| `database/` | Migration dan fixture/seeder fiktif; SQLite lokal tidak dilacak |
| `resources/views/letters/` | Template Blade surat sementara |
| `config/` | Konfigurasi aplikasi, CORS, sesi, dan penerbitan surat |
| `storage/` | Berkas privat, cache, dan log lokal; jangan dipublikasikan |
| `tests/` | Pengujian fitur dan unit |
| `vendor/` | Dependensi Composer yang dihasilkan saat install |

## Persiapan lokal

Buka terminal PowerShell di folder `backend/`. Siapkan PHP 8.3+, Composer, dan ekstensi yang diminta dependensi, termasuk SQLite dan GD untuk QR PNG:

```powershell
composer install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Hanya pada instalasi baru yang belum memiliki `APP_KEY`:

```powershell
php artisan key:generate
```

Lanjutkan tanpa menimpa database yang sudah ada:

```powershell
if (!(Test-Path database/database.sqlite)) { New-Item database/database.sqlite -ItemType File }
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Jika Composer tidak tersedia global tetapi file lokal ada, ganti `composer install` dengan `php ..\composer.phar install`. `composer.phar`, `.env`, dan database SQLite lokal tidak masuk Git. Jangan menimpa `.env` yang sudah digunakan, atau mengganti `APP_KEY` setelah ada data: field terenkripsi tidak dapat dibaca dengan kunci baru. URL pemeriksaan kesehatan: http://127.0.0.1:8000/up.

Perintah yang berguna (dijalankan dari folder `backend/`):

```powershell
php artisan test
php artisan route:list --path=api
php artisan config:clear
```

### Tes SQLite dan PostgreSQL

`phpunit.xml` tetap memakai SQLite `:memory:`. PostgreSQL 16+ dipilih untuk produksi; verifikasi lokal terakhir memakai PostgreSQL 18.6 (179 tes / 1.858 assertions) dan SQLite (179 tes / 1.856 assertions), lihat [catatan progres](../docs/progres-2026-10-24.md).

**Hanya gunakan database lokal khusus `watuagung_test`: `migrate:fresh` dan suite tes menghapus seluruh isinya.** Buat database kosong tersebut dengan user lokal yang sudah disiapkan, misalnya `createdb -h 127.0.0.1 -p 5432 -U <user-lokal> -W watuagung_test`. Jangan memakai database pengembangan/produksi berisi data yang perlu disimpan.

1. Pastikan PHP CLI memuat `pdo_pgsql` (`php -m`). Tidak perlu paket Composer tambahan.
2. Salin `.env.testing.pgsql.example` menjadi `.env.testing.pgsql` bila belum ada; isi kredensial lokal di file itu, bukan di `phpunit.xml` atau file contoh. Jangan commit file kredensial.
3. Pastikan tidak ada cache konfigurasi (`php artisan config:clear`) atau override `DB_*`/`APP_ENV` pada shell. Jangan menyimpan konfigurasi PostgreSQL di `.env.testing`, agar tes SQLite tidak memuat konfigurasi tersebut.
4. Gunakan `APP_KEY` lokal yang **sudah ada** melalui environment proses ketika menjalankan tes PostgreSQL; jangan membuat, mengganti, mencetak, atau menyalin nilainya ke file contoh. Contoh PowerShell berikut membaca baris kunci lokal tanpa menampilkannya (format `.env` satu baris standar):

```powershell
$keyLine = Get-Content .env | Where-Object { $_ -match '^APP_KEY=' } | Select-Object -First 1
if (!$keyLine) { throw 'APP_KEY lokal yang sudah ada diperlukan; jangan membuat kunci baru.' }
$env:APP_KEY = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
try {
    php artisan migrate:fresh --env=testing.pgsql
    if ($LASTEXITCODE -ne 0) { throw 'migrate:fresh gagal' }
    php artisan test --env=testing.pgsql
    if ($LASTEXITCODE -ne 0) { throw 'Tes PostgreSQL gagal' }
} finally {
    Remove-Item Env:APP_KEY
    Remove-Variable keyLine
}
php artisan migrate:rollback --env=testing.pgsql
# Ulangi rollback hingga "Nothing to rollback", lalu:
php artisan migrate --env=testing.pgsql
php artisan test
```

`--env=testing.pgsql` mempertahankan environment PostgreSQL saat Artisan menjalankan PHPUnit; tanpa opsi itu, bawaan SQLite di `phpunit.xml` berlaku. `APP_ENV=testing` di file contoh tetap diperlukan untuk perilaku lingkungan tes. `LOG_CHANNEL=null` mencegah kegagalan yang sengaja dipicu suite menulis query/fixture ke log.

Jika DLL `php_pdo_pgsql.dll` sudah tersedia di Windows tetapi belum aktif, alternatif tanpa perubahan `php.ini` global adalah membuat direktori konfigurasi sementara berisi file `pgsql.ini` dengan `extension=pdo_pgsql`, lalu set `$env:PHP_INI_SCAN_DIR` ke direktori itu sebelum menjalankan perintah. Ini juga berlaku pada proses anak PHPUnit; `php -d extension=pdo_pgsql artisan test` saja tidak meneruskan ekstensi ke proses anak. Pulihkan environment shell setelah selesai.

Suite menguji trigger kegagalan transaksi dan SQL penguncian sesuai driver. Ini **bukan** bukti konkurensi multiproses atau kesiapan produksi; uji simultan M3a dijalankan terpisah di bawah.

### Uji penomoran PostgreSQL multiproses (M3a)

`tests/Concurrency/letter-number.php` adalah skrip CLI mandiri, **tidak ikut `php artisan test`** (`phpunit.xml` hanya memuat Unit/Feature). Lokasi ini menjaga bootstrap dan fixture dekat backend tanpa menambah command aplikasi atau dependensi. Memakai Symfony Process yang sudah terpasang; PHP CLI harus mengaktifkan `proc_open` dan `pdo_pgsql` pada induk **serta proses anak**.

Siapkan `.env.testing.pgsql`, database lokal `watuagung_test`, dan pewarisan kunci lokal sesuai bagian sebelumnya. User PostgreSQL perlu hak membuat schema dan kapasitas minimal 31 koneksi bebas. Skrip menolak selain `APP_ENV=testing`, koneksi PostgreSQL lokal, database `watuagung_test`, atau konfigurasi yang masih di-cache; `DB_URL` harus kosong. Jangan menjalankan suite lain bersamaan.

Dari `backend/`, pada blok `try` pewarisan kunci di atas, **ganti perintah fresh/test** dengan:

```powershell
foreach ($run in 1..3) {
    Write-Output "Run $run/3"
    php tests/Concurrency/letter-number.php
    if ($LASTEXITCODE -ne 0) { throw 'Uji konkurensi gagal; berhenti dan minta persetujuan sebelum mengubah penomoran.' }
}
```

- Setiap jalan membuat schema acak `concurrency_<hex>`, menjalankan migration dan membuat 30 permohonan fiktif `PROCESSING` lintas empat jenis surat, serta 30 petugas. Cast terenkripsi model tetap dipakai. Tabel `public` tidak dihapus/diubah; tidak memakai `migrate:fresh`.
- Menjalankan **30 proses PHP terpisah** yang memanggil `StaffController::update()` asli. Bukan salinan algoritma `LetterNumber`, bukan simulasi transaksi berurutan. Autentikasi HTTP/middleware tidak dicakup skrip ini.
- Induk menahan lock tabel counter yang awalnya kosong; `pg_locks` harus membuktikan **30 sesi PostgreSQL menunggu bersamaan** sebelum lock dilepas. Ini menguji perebutan pembuatan counter pertama sekaligus urutan berikutnya. Tidak menyisipkan counter awal atau menambah retry di skrip; retry transaksi bawaan controller tetap berlaku.
- Tanggal fiktif dibekukan ke 24 Oktober 2026 pukul 12.00 WIB pada semua proses agar tidak melintasi tahun. Memeriksa 30 nomor unik, urutan tepat 1..30, satu counter tahun 2026 bernilai 30, satu nomor per permohonan, serta 30 status dan event beserta petugas penerbitnya.
- Batas waktu barrier 45 detik, SQL/lock 60 detik, dan proses anak 90 detik. Gagal/timeout → exit 1; output exception/worker tidak dicetak agar SQL, data sensitif, dan rahasia tidak bocor. Schema dibersihkan dalam `finally`, juga saat gagal. Bila proses induk dihentikan paksa, schema sementara mungkin tertinggal; periksa secara manual, jangan menghapus schema lain.
- Tiga hasil PASS adalah bukti skenario lokal tersebut, bukan pembuktian matematis untuk semua beban, uji server produksi, atau uji HTTP end-to-end. Jika satu jalan gagal, hentikan rangkaian dan laporkan sebelum mengubah `LetterNumber`.

### Akun petugas

Jalankan `php artisan migrate` terlebih dahulu untuk menambahkan kolom username unik. Akun lama tetap tersimpan dengan username null dan login email melalui API masih didukung. Form admin sekarang menggunakan username; tetapkan username unik pada akun lama sebelum memakainya. Format: 1–64 karakter huruf kecil/angka, `_`, atau `-`, diawali huruf kecil/angka. Tidak ada akun/kata sandi bawaan.

Tidak ada endpoint pendaftaran publik. Panel menerima lima peran: `rt_head` (ketua RT), `rw_head` (ketua RW), `staff` (petugas), `village_head` (kepala desa), dan `admin`. Buat akun lokal dengan perintah berikut; kata sandi (minimal 12 karakter) diminta dua kali secara tersembunyi, jadi tidak tersimpan di riwayat terminal maupun repositori:

```powershell
php artisan staff:create rt-lokal --role=rt_head --rt=1 --rw=2 --name="Ketua RT Lokal"
php artisan staff:create rw-lokal --role=rw_head --rw=2 --name="Ketua RW Lokal"
php artisan staff:create petugas-lokal --role=staff --name="Petugas Lokal"
php artisan staff:create kades-lokal --role=village_head --name="Kepala Desa Lokal"
php artisan staff:create admin-lokal --role=admin --name="Admin Lokal"
```

`--email` opsional (bawaan `<username>@example.test`). `rt_head` wajib `--rt` dan `--rw`; `rw_head` wajib `--rw`; isinya 1–3 digit dan disimpan sebagai 3 digit (`1` → `001`). Kolom `rt`/`rw` pada `users` nullable untuk peran lain. Ketua RT/RW tanpa wilayah lengkap tidak bisa masuk panel. Nama, username, dan nomor wilayah di atas hanya contoh, **bukan** akun bawaan. Buat admin pertama melalui CLI; untuk pengelolaan berikutnya gunakan panel **Akun** (`/admin/akun`) agar validasi wilayah, perlindungan admin, dan audit diterapkan.

Sejak migration `2026_10_22_000000_add_staff_account_fields_to_users_table`, admin dapat mengelola akun dari panel **Akun**. Email menjadi nullable; akun baru wajib memakai username. Kolom baru: `is_active` (default true), `must_change_password` (default false), dan `last_login_at`. Kata sandi sementara dari panel minimal 10 karakter (CLI tetap 12) dan wajib diganti saat login pertama. Akun nonaktif ditolak dengan pesan yang sama seperti kredensial salah; menonaktifkan akun mencabut semua tokennya. Satu wilayah hanya boleh punya satu `rt_head` aktif (RT+RW) dan satu `rw_head` aktif (RW); nonaktifkan ketua lama sebelum membuat pengganti. Admin tidak dapat menonaktifkan atau menurunkan perannya sendiri, dan sistem selalu menyisakan minimal satu admin aktif. Audit mencatat `user.created`, `user.updated`, dan `user.password_reset` di `audit_logs`.

## Integrasi frontend

Di `.env.local` pada direktori induk, isi `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`. Jalankan frontend dengan `npm run dev` dari direktori induk dan buka http://127.0.0.1:3000. Gunakan dua terminal supaya Laravel dan Next.js berjalan bersamaan.

`FRONTEND_ORIGINS` di `.env` backend mengatur origin yang boleh memanggil API dari browser. Nilai lokal default adalah `http://localhost:3000,http://127.0.0.1:3000`. Untuk deployment, ganti dengan origin HTTPS frontend yang benar, lalu jalankan `php artisan config:clear` bila konfigurasi sudah di-cache. Tidak ada cookie lintas-origin pada integrasi ini.

## Endpoint API v1

Semua path pada tabel diawali `/api/v1`. Permintaan JSON memakai `Accept: application/json` dan `Content-Type: application/json`.

| Metode | Path | Akses | Kegunaan |
| --- | --- | --- | --- |
| POST | `/applications` | Publik, 5 permintaan/menit | Mengajukan layanan; mengembalikan `request_id`, `status`, `jenis_surat`, dan `lookup_secret` (HTTP 201) |
| POST | `/applications/status` | Publik, 10 permintaan/menit; 5 kode salah per nomor → 429 selama 15 menit | Body: `request_id` dan `lookup_secret`; mengembalikan `jenis_surat`, status, dan catatan (penolakan RT/RW diberi awalan "Ditolak oleh Ketua RT/RW") |
| POST | `/staff/login` | Publik, 5 permintaan/menit | Body: `username` dan `password` (atau `email` untuk klien lama); mengembalikan bearer token |
| POST | `/staff/logout` | Token petugas | Mencabut token aktif |
| GET | `/staff/me` | Token petugas | Mengembalikan `{ name, username, role, rt, rw, must_change_password }`; `username`, `rt`, `rw` bisa `null`. Peran di luar lima peran panel, akun nonaktif, atau ketua RT/RW tanpa wilayah lengkap mendapat 403 |
| GET | `/staff/users` | Admin | Daftar akun `{ id, name, username, role, rt, rw, is_active, must_change_password, last_login_at }` dan `warnings` wilayah tanpa ketua aktif |
| POST | `/staff/users` | Admin | Body `name`, `username`, `role`, `password` (min. 10); `rt` wajib untuk `rt_head`, `rw` wajib untuk `rt_head`/`rw_head`. Akun baru aktif dan wajib ganti kata sandi |
| PATCH | `/staff/users/{id}` | Admin | Body `name`, `role`, `is_active`, `rt`, `rw`; menonaktifkan akun mencabut semua tokennya |
| POST | `/staff/users/{id}/reset-password` | Admin | Body `password` (min. 10); menandai wajib ganti kata sandi dan mencabut semua token akun itu |
| POST | `/staff/me/password` | Token petugas | Body `old_password` dan `password` (min. 10); token lain dicabut, token aktif tetap |
| GET | `/staff/letter-register` | Staff, admin, village_head aktif | Register nomor terbit/batal; filter `year`, `jenis_surat`, `page`; 20 per halaman |
| GET | `/staff/summary` | Token lima peran, ability `applications:manage` | Hitungan per status, antrean tindakan peran, masuk hari ini, lima antrean tertua; scope sama dengan daftar |
| GET | `/staff/applications` | Token petugas | Daftar paginasi 20 per halaman, dibatasi wilayah untuk ketua RT/RW; filter `status` atau `statuses[]`, `q`, `jenis_surat`, dan `sort` (kontrak di bawah) |
| POST | `/staff/applications/{request_id}/lookup-secret` | Staff, admin, rt_head, rw_head (10/menit) | Membuat ulang kode akses; hanya untuk status non-COMPLETED. Kode lama langsung tidak berlaku. Kode baru hanya ada di respons ini. |
| GET | `/staff/applications/{request_id}` | Token lima peran panel | Detail data pemohon, `allowed_transitions`, dan `history`; ketua RT/RW hanya wilayahnya dengan field terbatas; setiap akses berhasil dicatat di `audit_logs` |
| PATCH | `/staff/applications/{request_id}/status` | Token petugas | Body `status` dan `catatan` opsional; respons memuat `status`, `catatan`, dan `allowed_transitions` baru |
| GET | `/staff/applications/{request_id}/letter.pdf` | Staff, admin, village_head (30/menit) | Draf (PROCESSING/WAITING_APPROVAL) atau surat final (sejak APPROVED); diaudit |
| POST | `/staff/applications/{request_id}/letter.pdf` | Staff, admin (10/menit) | Multipart `file` PDF ≤ 5 MB; mengganti PDF otomatis dengan surat hasil pindaian |
| GET | `/staff/applications/{request_id}/letter-qr.png` | Staff, admin | Gambar QR verifikasi untuk ditempel pada surat manual |
| GET | `/verify/{kode}` | Publik, 30 permintaan/menit | Metadata surat tersamar untuk halaman verifikasi QR |
| GET | `/posts` | Publik, 60 permintaan/menit | Berita terbit, 10 per halaman, `Cache-Control: public, max-age=60` |
| GET | `/posts/{slug}` | Publik, 60 permintaan/menit | Detail berita terbit + `body`; draf/terhapus 404 |
| GET | `/staff/posts` | Admin, staff | Daftar berita semua status kecuali terhapus; filter `status`, `q` (judul), `page`; 20 per halaman |
| POST | `/staff/posts` | Admin, staff | Body `title`, `category`, `summary`, `body`, `status`; 201 |
| GET | `/staff/posts/{id}` | Admin, staff | Detail berita termasuk draf |
| PATCH | `/staff/posts/{id}` | Admin, staff | Ubah sebagian field yang sama |
| DELETE | `/staff/posts/{id}` | Admin, staff | Soft delete (baris dan sampul tetap ada, pemulihan lewat database) |
| POST/DELETE | `/staff/posts/{id}/cover` | Admin, staff, berbagi 10/menit per akun | Multipart `file` / hapus sampul; 200 detail berita terbaru |

Field formulir mengikuti [tipe frontend](../types/pelayanan.ts). Untuk SKU, `nama_usaha`, `jenis_usaha`, dan `alamat_usaha` wajib diisi. Validasi yang gagal mengembalikan HTTP 422 dengan objek `errors`.

### Berita

Kontrak lengkap di [docs/integrasi.md § Berita](../docs/integrasi.md). Hak kelola satu tempat: `User::canManageContent()` (`admin`/`staff` aktif); peran lain 403, tanpa token 401. Kategori di `App\Domain\PostCategory`. Isi teks biasa, HTML disimpan apa adanya dan tidak pernah dirender server. Slug tetap setelah terbit pertama. Audit `post.*` hanya aksi dan ID, tanpa judul/isi. `cover_url` berisi URL publik sampul atau `null`; `cover_path` tidak dikirim.

**Foto sampul (C2):** POST `/staff/posts/{id}/cover` memakai multipart field `file`; DELETE pada path yang sama menghapus sampul. Keduanya berbagi throttle 10/menit per akun, hak kelola sama dengan C1, respons 200 berupa detail berita terbaru (`cover_url` null setelah hapus), `Cache-Control: private, no-store`. Validasi 422: JPG/JPEG/PNG/WebP ≤ 3.072 KiB, lebar 600–6.000 px, tinggi 400–6.000 px; isi rusak ditolak. Klien FormData tidak menetapkan `Content-Type` sendiri agar boundary benar.

GD menggambar ulang piksel, memperkecil lebar maksimal 1.600 px tanpa memperbesar gambar kecil, mempertahankan rasio, membuang metadata EXIF/GPS. Output WebP kualitas 80 jika didukung; selain itu JPEG kualitas 82 (transparansi menjadi putih). Nama `posts/<uuid>.webp` atau `.jpg` di disk `public` (`storage/app/public/posts`). GD tidak tersedia → 503. Produksi memerlukan `php-gd` dengan JPEG/PNG/WebP; tes memberi pesan skip bila GD/WebP tidak tersedia.

Konfigurasi `MEDIA_URL` adalah **URL dasar absolut**, tanpa `/posts`: bawaan kosong/tidak diisi memakai `${APP_URL}/storage`; lokal jalankan `php artisan storage:link`. Untuk produksi isi `MEDIA_URL=https://[DOMAIN]/media`, sesuai `APP_URL`, lalu cache ulang konfigurasi. URL sampul menjadi `https://[DOMAIN]/media/posts/<uuid>.webp`. Nginx menyajikan hanya folder `storage/app/public/posts` di `/media/posts/`, bukan seluruh storage; lihat `docs/deploy-plan.md`.

File baru disimpan sebelum transaksi penggantian dan audit `post.updated`; bila transaksi gagal, file baru dibersihkan dan sampul lama tetap. Baris dikunci saat penggantian; file lama dihapus setelah commit. Gagal hapus file lama → 500 dengan pesan bahwa sampul sudah diperbarui; perlu pembersihan administrator. Soft delete berita **tidak** menghapus file agar bisa dipulihkan. File sampul bersifat publik, termasuk sampul draf/berita terhapus bila URL diketahui; jangan unggah dokumen pribadi. Pembersihan berkala file sisa belum dibuat dan tidak termasuk retensi permohonan F10. Backup harus mencakup folder media.

### Kontrak manajemen akun

- `GET /staff/users` hanya untuk `admin`; peran lain dan tamu mendapat 403/401. Tidak ada endpoint hapus akun: gunakan `is_active=false` agar riwayat status tetap merujuk ke akun itu.
- `warnings` berisi `{ role, rt, rw, pending }` untuk permohonan `SUBMITTED` di RT/RW tanpa `rt_head` aktif atau `RT_APPROVED` di RW tanpa `rw_head` aktif. Angka `pending` adalah jumlah permohonan yang tertahan.
- `PATCH` mengikuti aturan: admin tidak bisa menonaktifkan/menurunkan dirinya sendiri; admin aktif terakhir tidak bisa dihapus; satu RT hanya satu `rt_head` aktif dan satu RW hanya satu `rw_head` aktif. Melanggar aturan → 422 dengan `errors`.
- Login akun nonaktif → 401 `Kredensial tidak valid.` (pesan sama dengan kata sandi salah). Login berhasil mengisi `last_login_at` dan mengembalikan `must_change_password`.
- `POST /staff/me/password` memverifikasi kata sandi lama, menyimpan kata sandi baru (min. 10), menghapus `must_change_password`, dan mencabut token lain. Token yang sedang dipakai tetap berlaku.
- Audit akun memakai `subject_type=user` dan `subject_id` = ID akun target. Tidak ada email, kata sandi, atau token di audit.

### Daftar pengajuan

`GET /api/v1/staff/applications` menerima parameter query berikut (semuanya opsional):

| Parameter | Validasi / perilaku |
| --- | --- |
| `q` | String maksimal 100 karakter; spasi luar dibuang, kosong berarti tanpa pencarian. Mencocokkan potongan literal `request_id` **atau** `nama`, bukan NIK/KK/telepon/alamat. `%`, `_`, dan `!` dianggap teks literal, bukan wildcard. Tidak peka huruf besar/kecil (`LOWER()` di kedua sisi, berlaku sama di SQLite dan PostgreSQL; untuk huruf ASCII) |
| `jenis_surat` | Salah satu `SKU`, `DOMISILI`, `SKTM`, `KTP_KK` |
| `sort` | `terbaru` (bawaan) atau `terlama`; urutan `created_at` kemudian ID internal, keduanya menurun atau menaik. ID hanya pemecah urutan waktu yang sama, tidak dikirim ke klien |
| `status` | Satu status dari alur di bawah; tidak boleh bersama `statuses` |
| `statuses[]` | Array tidak kosong, maksimal jumlah status yang tersedia, setiap status valid dan tidak duplikat; tidak boleh bersama `status` |
| `page` | Bilangan bulat ≥ 1; 20 item per halaman |
| `my_queue`, `today` | Boolean opsional (`0`/`1`); antrean tindakan peran dan/atau permohonan masuk hari ini; digabung AND |

Nama pencarian di parameter `q` adalah pengecualian URL yang disetujui pengguna (18 Oktober 2026). Jangan memasukkan NIK/KK/telepon/alamat ke pencarian. Query URL dapat tersimpan di riwayat browser/access log server; sebelum produksi, redaksi query pada log proxy/web server perlu dikonfigurasi. Audit aplikasi tidak merekam pencarian.

Filter digabung dengan AND; pasangan pencarian nomor/nama dikelompokkan dengan OR. Respons tetap objek paginator Laravel (`data`, `current_page`, `last_page`, `per_page`, `total`, metadata/tautan pagination). Setiap item `data` **hanya** berisi `request_id`, `nama`, `jenis_surat`, `status`, `created_at`, `allowed_transitions`. **Perubahan kontrak:** `catatan` tidak lagi dikirim dalam daftar karena teks bebas dapat memuat data pribadi; baca catatan melalui endpoint detail. NIK, KK, alamat, telepon, data usaha, keperluan, hash kode akses, dan ID internal tidak disertakan. Daftar tidak mencatat audit akses detail.

### Ringkasan dashboard

`GET /api/v1/staff/summary` memerlukan bearer token `applications:manage` dan akun panel aktif (`staff`, `village_head`, `admin`, `rt_head`, `rw_head`). Tanpa token 401; ability/peran/akun tidak berwenang 403. Respons sukses dan gagal memakai `Cache-Control: private, no-store`.

- `by_status`: objek seluruh nilai `ApplicationStatus` → jumlah integer, termasuk nol. Query agregat `GROUP BY status`, bukan memuat seluruh permohonan.
- `my_queue`: jumlah permohonan dengan transisi yang tersedia untuk peran tersebut menurut `ApplicationStatus::allowedFor()` **dan jenis suratnya**. Tidak ada tabel status duplikat di controller/frontend; `NEED_REVISION` ikut bila peran memiliki transisi.
- `today`: jumlah yang dibuat sejak 00.00 hari ini sampai sebelum 00.00 besok sesuai zona waktu aplikasi (`APP_TIMEZONE`, bawaan `Asia/Jakarta`), tanpa membatasi status.
- `oldest`: maksimal lima permohonan dalam `my_queue`, urut `created_at` lalu ID internal menaik; setiap item tepat sama dengan daftar (`request_id`, `nama`, `jenis_surat`, `status`, `created_at`, `allowed_transitions`). Tidak ada ID internal, catatan bebas, identitas sensitif, atau kode akses.
- Seluruh hitungan/antrean memakai `Application::forUser()` yang sama dengan daftar. Ketua RT/RW hanya wilayah dan jenis surat yang memerlukan persetujuan RT/RW; peran kantor melihat seluruh wilayah.
- Daftar menerima filter boolean opsional `my_queue` dan `today` (`0`/`1`, bawaan tidak aktif), digabung AND dengan filter lama. Filter dan summary memakai scope yang sama agar angka kartu cocok dengan total daftar. Input tidak valid mendapat 422. Frontend memakai `my_queue=1`, `today=1`, `status=WAITING_APPROVAL`, dan `status=READY_FOR_PICKUP`; kartu Siap diambil **tidak** menghitung APPROVED.
- Ringkasan dihitung saat diminta (bukan live/polling). Muat ulang untuk memperbarui; perubahan data atau pergantian hari di antara dua permintaan dapat mengubah total.

### Register dan nomor surat

`GET /api/v1/staff/letter-register` memerlukan token dengan ability `applications:manage` dan akun aktif berperan `staff`, `admin`, atau `village_head`. Tanpa token → 401; peran lain (termasuk RT/RW), akun nonaktif, atau ability salah → 403. Respons dan kegagalan GET memakai `Cache-Control: private, no-store`.

- Filter opsional: `year` bilangan bulat 1000–9999 (bawaan tahun saat ini), `jenis_surat` dari enum `LetterType` (`SKU`, `DOMISILI`, `SKTM`, `KTP_KK`), dan `page` bilangan bulat ≥ 1. Nilai kosong/tidak valid → 422. Filter digabung AND.
- Paginator Laravel, 20 item per halaman, urutan nomor urut menurun. Item `data` **hanya** `{ number, issued_at, jenis_surat, nama, status }`; `status` adalah `issued` atau `void`, bukan status pengajuan. `issued_at` ISO 8601 UTC. Register tetap memuat nomor batal; tidak mengirim alasan batal, catatan bebas, atau identitas sensitif.
- Nomor dialokasikan saat `PROCESSING → WAITING_APPROVAL`, dalam transaksi yang sama dengan perubahan status dan `application_events`. `WAITING_APPROVAL → REJECTED/NEED_REVISION` membatalkan nomor (`void`) dan menyimpan catatan wajib sebagai `void_reason`. Setelah perbaikan dan diajukan lagi, nomor baru dialokasikan; nomor batal tidak dipakai ulang.
- Tabel `letter_numbers`: `id`, `application_id`, `year`, `sequence`, `number` (unik), `status`, `void_reason` nullable, `issued_by`, `issued_at`. Pasangan `(year, sequence)` unik; foreign key restrict-on-delete menjaga riwayat aplikasi dan penerbit. `letter_number_counters` menyimpan urutan global per tahun, **bersama semua jenis surat**, mulai 1 dan berganti pada tahun penerbitan.
- SQLite mengambil write lock **sebelum** membaca ulang pengajuan/counter; database lain mengunci baris pengajuan dan counter dengan `FOR UPDATE`. Seluruh transaksi dicoba maksimal 3 kali untuk konflik konkurensi; kegagalan penerbitan atau event membatalkan seluruh perubahan, termasuk counter.
- `config/letters.php` mengatur format `{kode_klasifikasi}/{urut}/{kode_desa}/{bulan_romawi}/{tahun}`. `urut` angka tanpa padding, bulan I–XII, tahun dari waktu penerbitan server sesuai `config/app.php` (env `APP_TIMEZONE`, bawaan `Asia/Jakarta`); urutan tahunan reset pukul 00.00 WIB tanggal 1 Januari. Serialisasi tanggal API tetap ISO 8601 UTC. `kode_desa` dan `kode_klasifikasi` (bersumber dari `LetterType::classificationCode()`) masih **`[PLACEHOLDER]`**, bukan kode resmi. Tetapkan kode yang disahkan sebelum penggunaan nyata. Nomor tersimpan tidak berubah bila konfigurasi kemudian diubah.
- Detail pengajuan menambah `letter_numbers: [{ number, status, void_reason, issued_at }]` hanya untuk tiga peran kantor, berurutan kronologis berdasarkan ID. RT/RW tidak menerima field ini. Pengajuan tanpa nomor menerima array kosong.
- Cek status publik menambah `letter_number: string | null`: hanya nomor `issued` saat `APPROVED`, `READY_FOR_PICKUP`, atau `COMPLETED`. Status lain, nomor batal, dan pengajuan lama tanpa nomor menghasilkan `null`; riwayat nomor tidak dikirim ke publik.
- Jalankan `php artisan migrate` untuk migration `2026_10_23_000000_create_letter_numbers`. **Tidak ada backfill** untuk pengajuan lama yang sudah menunggu persetujuan/disetujui; alur lama tetap dapat dilanjutkan tanpa nomor. Modul register tidak membuat PDF sendiri; penerbitan PDF tersedia melalui modul di bawah. TTE tersertifikasi, stempel digital, dan notifikasi belum tersedia.

### Surat PDF dan verifikasi QR

Dependensi: `barryvdh/laravel-dompdf` (PDF dari Blade) dan `bacon/bacon-qr-code` (QR PNG lewat ekstensi GD). Jalankan `php artisan migrate` untuk `2026_10_24_000000_create_letters`. Atur `LETTER_VERIFY_URL` di `.env` ke URL frontend `/verifikasi/` yang dapat dijangkau pemindai; localhost komputer tidak dapat diakses langsung dari ponsel lain.

- Template Blade di `resources/views/letters/` (`layout` + `sku`, `domisili`, `sktm`, `ktp_kk`). Kop, kabupaten, kecamatan, alamat kantor, dan nama Kepala Desa dari `config/letters.php` `desa` masih **`[PLACEHOLDER]`**; footer "Format sementara" dihapus setelah template resmi diterapkan.
- **Draf:** `GET …/letter.pdf` saat `PROCESSING`/`WAITING_APPROVAL` membuat PDF bertanda **DRAF** tanpa QR, tidak disimpan. Audit `letter.draft_viewed`.
- **Persetujuan:** `WAITING_APPROVAL → APPROVED` oleh Kepala Desa menyisipkan baris `letters` (`approved_by`, `approved_at`, `verification_code` 32 karakter acak, unik) dalam transaksi yang sama. Setelah commit PDF final dibuat dari template dengan QR `LETTER_VERIFY_URL?kode=<kode>`; bila gagal, persetujuan tetap tersimpan dan PDF dibuat saat unduhan pertama.
- **Final:** sejak `APPROVED` (juga `READY_FOR_PICKUP`, `COMPLETED`). Berkas disimpan di disk privat `local` (`storage/app/private/letters/`), **dienkripsi dengan APP_KEY** karena memuat NIK/alamat; `sha256` adalah hash PDF asli. Setiap unduhan → audit `letter.downloaded`. Status lain → 404.
- **Unggah manual:** staff/admin, saat `APPROVED`/`READY_FOR_PICKUP`. Field `file`, ≤ 5 MB, isi wajib diawali `%PDF-`. Menggantikan PDF otomatis (file lama dihapus), kode QR tidak berubah, `source=uploaded`, `uploaded_by`, audit `letter.uploaded`. Status lain → 422.
- **QR:** `GET …/letter-qr.png` (staff/admin) untuk ditempel pada surat yang disusun manual.
- Peran lain (RT/RW) → 403; tanpa token → 401; nomor tidak valid → 422.
- Detail kantor menambah `letter: { approved_at, source, sha256, file_updated_at, file_purged_at } | null`; kode verifikasi dan path tidak dikirim. RT/RW tidak menerima field ini. `file_purged_at` terisi bila PDF dihapus oleh retensi; `GET …/letter.pdf` lalu → **410** tanpa membuat ulang PDF dari data anonim.
- **Verifikasi publik** `GET /verify/{kode}`: hanya `{ number, jenis_surat, issued_at, nama, status }`. `nama` disamarkan (`Siti Wulandari` → `S*** W********`); `status` `valid`, atau `revoked` bila nomor surat terakhir dibatalkan. Tanpa NIK, KK, alamat, telepon, isi surat, atau nomor pengajuan. Kode tidak ditemukan/format salah → 404. `Cache-Control: no-store`.
- QR **bukan** Tanda Tangan Elektronik tersertifikasi (lihat `PRODUCT.md`). Mengganti `APP_KEY` membuat PDF tersimpan tidak terbaca.

### Detail pengajuan dan audit akses

`GET /api/v1/staff/applications/{request_id}` memerlukan bearer token Sanctum dengan ability `applications:manage` **dan** peran panel aktif. Kelima peran boleh melihat detail; wewenang perubahan status tetap mengikuti tabel di bawah.

**Batas wilayah ketua RT/RW** (`Application::forUser()` dan `isInTerritory()`): keduanya hanya melihat jenis surat dengan `requiresNeighborhoodApproval` (bukan SKU); `rt_head` hanya pengajuan dengan `rt` **dan** `rw` sama dengan akunnya; `rw_head` hanya pengajuan dengan `rw` sama. Daftar otomatis disaring; detail di luar wilayah → **404** (tidak membocorkan keberadaan); PATCH status di luar wilayah → **403**. Kode wilayah dibandingkan setelah dinormalkan ke 3 digit.

**Detail untuk ketua RT/RW:** `nik` dan `no_kk` dikirim utuh untuk verifikasi; `telepon`, `tempat_lahir`, `tanggal_lahir`, dan `jenis_kelamin` tidak dikirim sama sekali. Audit akses sama dengan peran lain. Otorisasi dilakukan sebelum data pengajuan dimuat/dekripsi, tanpa implicit model binding pada endpoint detail.

- Format nomor: `REQ-` + empat digit tahun + `-` + satu atau lebih huruf kapital/angka, maksimal 64 karakter (`/^REQ-\d{4}-[A-Z0-9]+$/`). Format ini menerima ULID server dan nomor pendek fixture. Nomor tidak sesuai format → **422** dengan `errors.request_id`; nomor valid tetapi tidak ditemukan → **404**.
- Tanpa token/token tidak valid → **401**; peran atau ability salah → **403**, termasuk sebelum memvalidasi/mencari nomor.
- Respons sukses **200** berupa objek detail langsung (tanpa pembungkus `data`/`success`), dengan field eksplisit:
  - `request_id`, `jenis_surat`, `nama`, `nik`, `no_kk`, `alamat`, `rt`, `rw`, serta `tempat_lahir`, `tanggal_lahir` (`YYYY-MM-DD`), `jenis_kelamin`, `telepon` (empat terakhir tidak ada untuk ketua RT/RW);
  - `nama_usaha`, `jenis_usaha`, `alamat_usaha` (masing-masing dapat `null`), `keperluan`, `status`, `catatan` (dapat `null`);
  - `created_at`, `updated_at` (ISO 8601 UTC), `allowed_transitions` (array status untuk peran aktif), `history` (array, dapat kosong).
- Setiap item `history` **hanya** berisi `from_status` (nullable), `to_status`, `note` (nullable), `staff_name` (nullable untuk pengajuan awal/pengguna yang sudah dihapus), `created_at` (ISO 8601 UTC). Urutan kronologis menaik berdasarkan waktu lalu ID event. ID event, ID pengguna, email, serta metadata internal tidak dikirim.
- Data terenkripsi dibuka hanya untuk respons detail berotorisasi; encrypted casts dan field tersembunyi model tetap dipertahankan. Hash/kode akses tidak pernah dikirim melalui endpoint ini.
- Respons daftar/detail (termasuk kegagalan validasi/otorisasi) memakai `Cache-Control: private, no-store`. Frontend tidak boleh menyimpan detail ke localStorage/sessionStorage atau memasukkan identitas sensitif ke URL.
- Jalankan `php artisan migrate` sebelum memakai detail untuk membuat tabel `audit_logs`. Tabel hanya memuat primary key `id`, `user_id`, `action`, `subject_type`, `subject_id`, `created_at`; tanpa payload, IP, user agent, nomor pengajuan, atau identitas warga. Setiap detail berhasil mencatat `action=application.viewed`, `subject_type=application`, `subject_id` = ID internal pengajuan, dan pengguna aktif **sebelum** respons dikirim. Audit gagal → detail tidak diberikan. Akses 401/403/404/422 dan daftar tidak membuat audit. Audit menggunakan foreign key pengguna dengan restrict-on-delete agar riwayat tidak hilang; penghapusan akun perlu kebijakan terpisah.

### Alur status dan wewenang

Alur bergantung pada jenis surat (`app/Domain/LetterType.php::requiresNeighborhoodApproval()`; frontend mencerminkannya di `lib/letter-workflow.ts` hanya untuk tampilan):

- SKU: `SUBMITTED` → `VERIFIED` → `PROCESSING` → `WAITING_APPROVAL` → `APPROVED` → `READY_FOR_PICKUP` → `COMPLETED`.
- DOMISILI, SKTM, KTP_KK: `SUBMITTED` → `RT_APPROVED` → `RW_APPROVED` → `VERIFIED` → lanjutan sama dengan SKU.

Aturan dipusatkan di `app/Domain/ApplicationStatus.php`; controller tidak menyimpan salinan tabel ini.

**DOMISILI, SKTM, KTP_KK:**

| Dari | Ke | Peran |
| --- | --- | --- |
| `SUBMITTED` | `RT_APPROVED`, `REJECTED` | **hanya** rt_head (wilayahnya) |
| `RT_APPROVED` | `RW_APPROVED`, `REJECTED` | **hanya** rw_head (wilayahnya) |
| `RW_APPROVED` | `VERIFIED`, `NEED_REVISION`, `REJECTED` | staff, admin |

Baris berikutnya (`NEED_REVISION` dan seterusnya) sama dengan tabel SKU.

**SKU dan lanjutan semua jenis:**

| Dari | Ke | Peran |
| --- | --- | --- |
| `SUBMITTED` (hanya SKU) | `VERIFIED`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `NEED_REVISION` | `VERIFIED`, `REJECTED` | staff, admin |
| `VERIFIED` | `PROCESSING`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `PROCESSING` | `WAITING_APPROVAL`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `WAITING_APPROVAL` | `APPROVED`, `REJECTED`, `NEED_REVISION` | **hanya** village_head |
| `APPROVED` | `READY_FOR_PICKUP` | staff, admin |
| `READY_FOR_PICKUP` | `COMPLETED` | staff, admin |

- Perpindahan yang tidak ada di tabel jenis suratnya (melompat, misalnya `SUBMITTED` → `RW_APPROVED` atau DOMISILI `SUBMITTED` → `VERIFIED`; mundur; atau dari `REJECTED`/`COMPLETED`) → **422** `Transisi status tidak valid.`
- Perpindahan yang ada di tabel tetapi bukan wewenang peran → **403** `Peran Anda tidak berwenang melakukan perubahan status ini.` Admin tidak dapat menyetujui. Pengajuan di luar wilayah ketua RT/RW → **403** `Akses ditolak.`
- `NEED_REVISION` dan `REJECTED` wajib memakai `catatan` (422 dengan `errors.catatan`).
- Status dibaca ulang dengan kunci baris di dalam transaksi, sehingga klien dengan data usang tidak bisa mengulang transisi. Setiap perubahan dicatat di `application_events` beserta `user_id`.
- Semua peran memakai satu ability token `applications:manage`; peran diperiksa ulang pada setiap permintaan.

`APPROVED` mencatat persetujuan Kepala Desa dan membuat PDF final ber-QR (lihat bagian Surat PDF); `READY_FOR_PICKUP` ditandai petugas setelah surat fisik siap. `RT_APPROVED`/`RW_APPROVED` hanya catatan persetujuan di sistem: tidak ada PDF pengantar, TTE, stempel digital, atau notifikasi.

Migration `2026_10_20_000000_add_neighborhood_territories` menambah kolom `rt`/`rw` nullable di `users` dan hanya menormalkan `rt`/`rw` pengajuan lama ke 3 digit. Status pengajuan lama tidak diubah: pengajuan DOMISILI/SKTM/KTP_KK yang sudah melewati `SUBMITTED` tetap berjalan tanpa diulang dari RT/RW.

## Penanganan data dan batas saat ini

- `lookup_secret` diberikan sekali setelah pengajuan dengan format `WAD-XXXX-XXXX` (8 angka acak, `App\Domain\AccessCode`). Input diterima tanpa tanda hubung, dengan spasi, atau huruf kecil. Hash memakai HMAC-SHA256 dengan `APP_KEY`, jadi **mengganti `APP_KEY` membatalkan semua kode akses**. Kode lama (48 karakter, SHA-256 polos) tetap berlaku.
- Cek status dikunci per nomor pengajuan setelah 5 kode salah selama 15 menit (HTTP 429), di samping batas 10 permintaan/menit per IP. Kode benar membuka kunci.
- **Buat ulang kode akses:** `POST /staff/applications/{request_id}/lookup-secret` oleh staff, admin, rt_head, rw_head (bukan village_head). Permohonan di luar wilayah RT/RW = 404. Status `COMPLETED` = 422. Kode lama langsung tidak berlaku. Kunci salah coba dibuka. Respons hanya berisi kode sekali; tidak ada di log. Entri riwayat dengan `action: ACCESS_CODE_RESET` dan catatan audit `application.access_code_reset`.
- NIK, nomor KK, telepon, alamat, tempat lahir, dan tanggal lahir (string `Y-m-d`) disimpan terenkripsi memakai `APP_KEY`; kolomnya tidak dapat difilter/diurutkan di SQL. Migration `2026_10_25_000000_encrypt_application_birth_data` mengenkripsi baris lama, dan `down()` mendekripsinya kembali; keduanya butuh `APP_KEY` yang sama. Endpoint publik hanya mengembalikan metadata status; daftar petugas tidak menampilkan field sensitif itu.
- Token petugas berlaku `SANCTUM_EXPIRATION` menit sejak login (bawaan 480 menit = 8 jam kerja; atur di `.env`, lalu `php artisan config:clear` bila konfigurasi di-cache). Token kedaluwarsa atau dicabut menghasilkan 401.
- Frontend menyimpan token di `sessionStorage` tab dan memvalidasinya lewat `/staff/me`; menutup tab menghapus sesi. Jangan simpan token dalam URL atau localStorage.
- Token kedaluwarsa dihapus dari database oleh `sanctum:prune-expired --hours=24` yang dijadwalkan harian di `routes/console.php`. Scheduler harus dijalankan: di server tambahkan cron `* * * * * php artisan schedule:run`; secara lokal gunakan `php artisan schedule:work`. Cek jadwal dengan `php artisan schedule:list`.
- **Retensi (mati bawaan):** `config/retention.php` membaca `RETENTION_APPLICATION_DAYS` (kosong = mati; isi hanya setelah desa menetapkan masa simpan). `php artisan applications:purge --dry-run` menampilkan target tanpa mengubah apa pun; tanpa opsi, permohonan `COMPLETED`/`REJECTED` dengan `updated_at` lebih tua dari N hari dianonimkan dalam transaksi per permohonan:
  - `nama` → inisial (`Siti Wulandari` → `S. W.`); `nik`, `no_kk`, `telepon`, `alamat`, `tempat_lahir`, `tanggal_lahir`, `keperluan` → string kosong (terenkripsi); `alamat_usaha`, `catatan` → `null`; `purged_at` diisi. `updated_at` asli tidak berubah.
  - Tetap: `request_id`, `jenis_surat`, `status`, `rt`/`rw`, `jenis_kelamin`, data usaha selain alamat, tanggal, `letter_numbers`, `application_events`, `audit_logs`, serta baris `letters` (kode verifikasi, SHA-256).
  - PDF final dihapus dari disk privat setelah commit; `letters.path` → `null`, `letters.file_purged_at` diisi.
  - Satu audit `application.purged` per permohonan dengan `user_id = null` (aksi sistem; migration `2026_10_27_000000` membuat kolom ini nullable dan rollback sengaja membiarkannya nullable). Tanpa isi data.
  - Idempoten: permohonan yang sudah memiliki `purged_at` dilewati. Nilai bukan bilangan bulat ≥ 1 → keluar dengan error tanpa perubahan.
  - Dijadwalkan harian di `routes/console.php`; aman karena mati bawaan. Backup lama tetap berisi data sebelum anonimisasi sampai rotasinya habis.
- Belum ada unggah dokumen persyaratan, OTP, TTE, atau pengelolaan konten. Jangan menguji dengan data pribadi nyata.

## Sebelum produksi

Belum siap menerima data warga nyata. Putuskan hosting/database sesuai K2/K3 pada [roadmap](../ROADMAP.md), lalu siapkan HTTPS, `APP_DEBUG=false`, backup dan uji pemulihan, kebijakan privasi/retensi, scheduler, serta pengelolaan `APP_KEY` yang aman. Demo Vercel tidak menjalankan Laravel.

Atur `APP_URL`, `FRONTEND_ORIGINS`, dan `LETTER_VERIFY_URL` ke alamat lingkungan target; jalankan migration dan uji alur lengkap beserta pembatasan peran/wilayah. PDF dan bantuan buat ulang kode akses sudah diimplementasikan, tetapi template/nomor resmi, prosedur pemeriksaan identitas, uji browser Laravel, dan pemindaian QR masih perlu dituntaskan. Autentikasi saat ini memakai bearer token dan `sessionStorage`; perubahan ke cookie HttpOnly bukan fitur yang sudah tersedia atau keputusan arsitektur yang telah ditetapkan.

## Fondasi penduduk dummy

Tabel `residents` menyimpan NIK, nama, tempat lahir, dan tanggal lahir dengan encrypted casts. Identitas disembunyikan dari serialisasi JSON. `dummy_reference` adalah penanda fixture unik, bukan indeks NIK. Jangan mengganti APP_KEY setelah ada data terenkripsi.

Seeder hanya berjalan di local/testing, aman diulang, dan menolak menimpa record non-dummy. Tidak dipanggil otomatis oleh DatabaseSeeder. Jalankan dari folder backend:

```powershell
php artisan migrate --path=database/migrations/2026_09_29_160000_create_residents_table.php
php artisan db:seed --class=DummyResidentSeeder
php artisan test --filter=ResidentsFoundationTest
```

Tiga NIK fiktif: `0000000000000001`, `0000000000000002`, `0000000000000003`. Awalan wilayah sengaja tidak valid. Jangan masukkan data asli pada tahap ini.

Belum ada endpoint pencarian penduduk atau integrasi autofill API: frontend tetap memakai fixture lokal. Mode coba pada frontend dengan API aktif memblokir pengiriman ke server. Sebelum data asli, siapkan verifikasi kepemilikan, otorisasi, audit akses, retensi, indeks pencarian aman, dan deduplikasi NIK. Kolom terenkripsi tidak dapat dicari langsung dengan query NIK. Jangan membuka lookup publik hanya berdasarkan NIK.
