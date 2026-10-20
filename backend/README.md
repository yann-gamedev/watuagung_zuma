# API Laravel Desa Watuagung

Backend ini melayani formulir administrasi dan panel petugas dari frontend Next.js pada direktori induk. Teknologi: PHP 8.3+, Laravel 13, Sanctum, dan SQLite untuk pengembangan. Tidak ada data warga contoh yang otomatis dimasukkan ke database.

## Persiapan lokal

Buka terminal PowerShell di folder `backend/`. Jika Composer tersedia global, jalankan `composer install`. Jika tidak, gunakan Composer lokal di induk proyek (`php ..\composer.phar install`) bila file tersebut tersedia. Lanjutkan dengan:

```powershell
php ..\composer.phar install
Copy-Item .env.example .env
php artisan key:generate
New-Item database/database.sqlite -ItemType File -Force
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Ganti baris pertama dengan `composer install` jika sudah terpasang global. `composer.phar`, `.env`, dan database SQLite lokal tidak masuk Git. Jangan menimpa `.env` yang sudah digunakan, atau mengganti `APP_KEY` setelah ada data: field terenkripsi tidak dapat dibaca dengan kunci baru. URL pemeriksaan kesehatan: http://127.0.0.1:8000/up.

Perintah yang berguna (dijalankan dari folder `backend/`):

```powershell
php artisan test
php artisan route:list --path=api
php artisan config:clear
```

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

`--email` opsional (bawaan `<username>@example.test`). `rt_head` wajib `--rt` dan `--rw`; `rw_head` wajib `--rw`; isinya 1–3 digit dan disimpan sebagai 3 digit (`1` → `001`). Kolom `rt`/`rw` pada `users` nullable untuk peran lain. Ketua RT/RW tanpa wilayah lengkap tidak bisa masuk panel. Nama, username, dan nomor wilayah di atas hanya contoh, **bukan** akun bawaan. Untuk mengubah peran akun lama, gunakan `php artisan tinker`, lalu `App\Models\User::where('username', 'nama-akun')->update(['role' => 'village_head']);`. Perubahan peran berlaku seketika pada token yang sudah aktif.

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
| GET | `/staff/applications` | Token petugas | Daftar paginasi 20 per halaman, dibatasi wilayah untuk ketua RT/RW; filter `status` atau `statuses[]`, `q`, `jenis_surat`, dan `sort` (kontrak di bawah) |
| POST | `/staff/applications/{request_id}/lookup-secret` | Staff, admin, rt_head, rw_head (10/menit) | Membuat ulang kode akses; hanya untuk status non-COMPLETED. Kode lama langsung tidak berlaku. Kode baru hanya ada di respons ini. |
| GET | `/staff/applications/{request_id}` | Token lima peran panel | Detail data pemohon, `allowed_transitions`, dan `history`; ketua RT/RW hanya wilayahnya dengan field terbatas; setiap akses berhasil dicatat di `audit_logs` |
| PATCH | `/staff/applications/{request_id}/status` | Token petugas | Body `status` dan `catatan` opsional; respons memuat `status`, `catatan`, dan `allowed_transitions` baru |

Field formulir mengikuti [tipe frontend](../types/pelayanan.ts). Untuk SKU, `nama_usaha`, `jenis_usaha`, dan `alamat_usaha` wajib diisi. Validasi yang gagal mengembalikan HTTP 422 dengan objek `errors`.

### Akun petugas

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

Nama pencarian di parameter `q` adalah pengecualian URL yang disetujui pengguna (18 Oktober 2026). Jangan memasukkan NIK/KK/telepon/alamat ke pencarian. Query URL dapat tersimpan di riwayat browser/access log server; sebelum produksi, redaksi query pada log proxy/web server perlu dikonfigurasi. Audit aplikasi tidak merekam pencarian.

Filter digabung dengan AND; pasangan pencarian nomor/nama dikelompokkan dengan OR. Respons tetap objek paginator Laravel (`data`, `current_page`, `last_page`, `per_page`, `total`, metadata/tautan pagination). Setiap item `data` **hanya** berisi `request_id`, `nama`, `jenis_surat`, `status`, `created_at`, `allowed_transitions`. **Perubahan kontrak:** `catatan` tidak lagi dikirim dalam daftar karena teks bebas dapat memuat data pribadi; baca catatan melalui endpoint detail. NIK, KK, alamat, telepon, data usaha, keperluan, hash kode akses, dan ID internal tidak disertakan. Daftar tidak mencatat audit akses detail.

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

`APPROVED` **belum** berarti surat/PDF telah dibuat; `READY_FOR_PICKUP` ditandai petugas setelah surat fisik siap. `RT_APPROVED`/`RW_APPROVED` hanya catatan persetujuan di sistem: tidak ada PDF pengantar, TTE, stempel digital, atau notifikasi.

Migration `2026_10_20_000000_add_neighborhood_territories` menambah kolom `rt`/`rw` nullable di `users` dan hanya menormalkan `rt`/`rw` pengajuan lama ke 3 digit. Status pengajuan lama tidak diubah: pengajuan DOMISILI/SKTM/KTP_KK yang sudah melewati `SUBMITTED` tetap berjalan tanpa diulang dari RT/RW.

## Penanganan data dan batas saat ini

- `lookup_secret` diberikan sekali setelah pengajuan dengan format `WAD-XXXX-XXXX` (8 angka acak, `App\Domain\AccessCode`). Input diterima tanpa tanda hubung, dengan spasi, atau huruf kecil. Hash memakai HMAC-SHA256 dengan `APP_KEY`, jadi **mengganti `APP_KEY` membatalkan semua kode akses**. Kode lama (48 karakter, SHA-256 polos) tetap berlaku.
- Cek status dikunci per nomor pengajuan setelah 5 kode salah selama 15 menit (HTTP 429), di samping batas 10 permintaan/menit per IP. Kode benar membuka kunci.
- **Buat ulang kode akses:** `POST /staff/applications/{request_id}/lookup-secret` oleh staff, admin, rt_head, rw_head (bukan village_head). Permohonan di luar wilayah RT/RW = 404. Status `COMPLETED` = 422. Kode lama langsung tidak berlaku. Kunci salah coba dibuka. Respons hanya berisi kode sekali; tidak ada di log. Entri riwayat dengan `action: ACCESS_CODE_RESET` dan catatan audit `application.access_code_reset`.
- NIK, nomor KK, telepon, dan alamat disimpan terenkripsi memakai `APP_KEY`. Endpoint publik hanya mengembalikan metadata status; daftar petugas tidak menampilkan field sensitif itu.
- Token petugas berlaku `SANCTUM_EXPIRATION` menit sejak login (bawaan 480 menit = 8 jam kerja; atur di `.env`, lalu `php artisan config:clear` bila konfigurasi di-cache). Token kedaluwarsa atau dicabut menghasilkan 401.
- Frontend menyimpan token di `sessionStorage` tab dan memvalidasinya lewat `/staff/me`; menutup tab menghapus sesi. Jangan simpan token dalam URL atau localStorage.
- Token kedaluwarsa dihapus dari database oleh `sanctum:prune-expired --hours=24` yang dijadwalkan harian di `routes/console.php`. Scheduler harus dijalankan: di server tambahkan cron `* * * * * php artisan schedule:run`; secara lokal gunakan `php artisan schedule:work`. Cek jadwal dengan `php artisan schedule:list`.
- Belum ada PDF, unggah dokumen, OTP, atau pengelolaan konten. Jangan menguji dengan data pribadi nyata.

## Sebelum produksi

Gunakan HTTPS, `APP_DEBUG=false`, database persisten dengan backup, dan kelola `APP_KEY` secara aman. Deploy Laravel terpisah dari Vercel frontend; atur `APP_URL` dan `FRONTEND_ORIGINS` ke domain sebenarnya, jalankan migrasi, lalu tes ulang pengajuan sampai perubahan status. Prioritas pengembangan selanjutnya adalah sesi petugas berbasis cookie HttpOnly, penerbitan dokumen/PDF, verifikasi kepemilikan untuk pemulihan kode akses, dan migrasi konten publik yang telah diverifikasi.

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
