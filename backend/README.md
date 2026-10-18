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

Tidak ada endpoint pendaftaran publik. Panel menerima tiga peran: `staff` (petugas), `village_head` (kepala desa), dan `admin`. Buat akun lokal dengan perintah berikut; kata sandi (minimal 12 karakter) diminta dua kali secara tersembunyi, jadi tidak tersimpan di riwayat terminal maupun repositori:

```powershell
php artisan staff:create petugas-lokal --role=staff --name="Petugas Lokal"
php artisan staff:create kades-lokal --role=village_head --name="Kepala Desa Lokal"
php artisan staff:create admin-lokal --role=admin --name="Admin Lokal"
```

`--email` opsional (bawaan `<username>@example.test`). Nama dan username di atas hanya contoh, **bukan** akun bawaan. Untuk mengubah peran akun lama, gunakan `php artisan tinker`, lalu `App\Models\User::where('username', 'nama-akun')->update(['role' => 'village_head']);`. Perubahan peran berlaku seketika pada token yang sudah aktif.

## Integrasi frontend

Di `.env.local` pada direktori induk, isi `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`. Jalankan frontend dengan `npm run dev` dari direktori induk dan buka http://127.0.0.1:3000. Gunakan dua terminal supaya Laravel dan Next.js berjalan bersamaan.

`FRONTEND_ORIGINS` di `.env` backend mengatur origin yang boleh memanggil API dari browser. Nilai lokal default adalah `http://localhost:3000,http://127.0.0.1:3000`. Untuk deployment, ganti dengan origin HTTPS frontend yang benar, lalu jalankan `php artisan config:clear` bila konfigurasi sudah di-cache. Tidak ada cookie lintas-origin pada integrasi ini.

## Endpoint API v1

Semua path pada tabel diawali `/api/v1`. Permintaan JSON memakai `Accept: application/json` dan `Content-Type: application/json`.

| Metode | Path | Akses | Kegunaan |
| --- | --- | --- | --- |
| POST | `/applications` | Publik, 5 permintaan/menit | Mengajukan layanan; mengembalikan `request_id`, `status`, dan `lookup_secret` (HTTP 201) |
| POST | `/applications/status` | Publik, 10 permintaan/menit | Body: `request_id` dan `lookup_secret`; mengembalikan status dan catatan |
| POST | `/staff/login` | Publik, 5 permintaan/menit | Body: `username` dan `password` (atau `email` untuk klien lama); mengembalikan bearer token |
| POST | `/staff/logout` | Token petugas | Mencabut token aktif |
| GET | `/staff/me` | Token petugas | Mengembalikan `{ name, username, role }`; `username` bisa `null` untuk akun lama. Peran selain `staff`/`village_head`/`admin` mendapat 403 |
| GET | `/staff/applications` | Token petugas | Daftar paginasi (20 per halaman, `?page=N`). Filter opsional: satu status `?status=SUBMITTED` **atau** beberapa status `?statuses[]=APPROVED&statuses[]=READY_FOR_PICKUP` (tidak boleh keduanya). Setiap item memuat `allowed_transitions` untuk peran pengguna |
| PATCH | `/staff/applications/{request_id}/status` | Token petugas | Body `status` dan `catatan` opsional; respons memuat `status`, `catatan`, dan `allowed_transitions` baru |

Field formulir mengikuti [tipe frontend](../types/pelayanan.ts). Untuk SKU, `nama_usaha`, `jenis_usaha`, dan `alamat_usaha` wajib diisi. Validasi yang gagal mengembalikan HTTP 422 dengan objek `errors`.

### Alur status dan wewenang

Alur normal: `SUBMITTED` → `VERIFIED` → `PROCESSING` → `WAITING_APPROVAL` → `APPROVED` → `READY_FOR_PICKUP` → `COMPLETED`. Aturan dipusatkan di `app/Domain/ApplicationStatus.php`; controller tidak menyimpan salinan tabel ini.

| Dari | Ke | Peran |
| --- | --- | --- |
| `SUBMITTED` | `VERIFIED`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `NEED_REVISION` | `VERIFIED`, `REJECTED` | staff, admin |
| `VERIFIED` | `PROCESSING`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `PROCESSING` | `WAITING_APPROVAL`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `WAITING_APPROVAL` | `APPROVED`, `REJECTED`, `NEED_REVISION` | **hanya** village_head |
| `APPROVED` | `READY_FOR_PICKUP` | staff, admin |
| `READY_FOR_PICKUP` | `COMPLETED` | staff, admin |

- Perpindahan yang tidak ada di tabel (melompat, mundur, atau dari `REJECTED`/`COMPLETED`) → **422** `Transisi status tidak valid.`
- Perpindahan yang ada di tabel tetapi bukan wewenang peran → **403** `Peran Anda tidak berwenang melakukan perubahan status ini.` Admin tidak dapat menyetujui.
- `NEED_REVISION` dan `REJECTED` wajib memakai `catatan` (422 dengan `errors.catatan`).
- Status dibaca ulang dengan kunci baris di dalam transaksi, sehingga klien dengan data usang tidak bisa mengulang transisi. Setiap perubahan dicatat di `application_events` beserta `user_id`.
- Semua peran memakai satu ability token `applications:manage`; peran diperiksa ulang pada setiap permintaan.

`APPROVED` **belum** berarti surat/PDF telah dibuat; `READY_FOR_PICKUP` ditandai petugas setelah surat fisik siap.

## Penanganan data dan batas saat ini

- `lookup_secret` diberikan sekali setelah pengajuan. Warga harus menyimpan kode itu bersama nomor pengajuan; saat ini belum tersedia pemulihan kode.
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
