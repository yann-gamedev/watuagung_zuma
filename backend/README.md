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

Tidak ada endpoint pendaftaran publik. Untuk mencoba panel petugas secara lokal, jalankan `php artisan tinker`, lalu masukkan perintah berikut dengan email dan kata sandi kuat milik Anda sendiri:

```php
App\Models\User::create([
    'name' => 'Petugas Desa',
    'email' => 'petugas@example.test',
    'password' => 'ganti-dengan-kata-sandi-kuat',
    'role' => 'staff',
]);
```

Ketik `exit` untuk keluar dari Tinker. Kredensial contoh di atas **bukan** akun bawaan; ubah sebelum dijalankan. Jangan simpan kata sandi pada repositori.

## Integrasi frontend

Di `.env.local` pada direktori induk, isi `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`. Jalankan frontend dengan `npm run dev` dari direktori induk dan buka http://127.0.0.1:3000. Gunakan dua terminal supaya Laravel dan Next.js berjalan bersamaan.

`FRONTEND_ORIGINS` di `.env` backend mengatur origin yang boleh memanggil API dari browser. Nilai lokal default adalah `http://localhost:3000,http://127.0.0.1:3000`. Untuk deployment, ganti dengan origin HTTPS frontend yang benar, lalu jalankan `php artisan config:clear` bila konfigurasi sudah di-cache. Tidak ada cookie lintas-origin pada integrasi ini.

## Endpoint API v1

Semua path pada tabel diawali `/api/v1`. Permintaan JSON memakai `Accept: application/json` dan `Content-Type: application/json`.

| Metode | Path | Akses | Kegunaan |
| --- | --- | --- | --- |
| POST | `/applications` | Publik, 5 permintaan/menit | Mengajukan layanan; mengembalikan `request_id`, `status`, dan `lookup_secret` (HTTP 201) |
| POST | `/applications/status` | Publik, 10 permintaan/menit | Body: `request_id` dan `lookup_secret`; mengembalikan status dan catatan |
| POST | `/staff/login` | Publik, 5 permintaan/menit | Body: `email` dan `password`; mengembalikan bearer token |
| POST | `/staff/logout` | Token petugas | Mencabut token aktif |
| GET | `/staff/applications` | Token petugas | Daftar paginasi; filter opsional `?status=SUBMITTED` |
| PATCH | `/staff/applications/{request_id}/status` | Token petugas | Mengubah status dengan `status` dan `catatan` opsional |

Field formulir mengikuti [tipe frontend](../types/pelayanan.ts). Untuk SKU, `nama_usaha`, `jenis_usaha`, dan `alamat_usaha` wajib diisi. Validasi yang gagal mengembalikan HTTP 422 dengan objek `errors`.

Alur normal status: `SUBMITTED` → `VERIFIED` → `PROCESSING` → `WAITING_APPROVAL` → `APPROVED`. Status `NEED_REVISION` dan `REJECTED` memerlukan catatan petugas; setiap perubahan status dicatat. `APPROVED` **belum** berarti surat/PDF telah dibuat.

## Penanganan data dan batas saat ini

- `lookup_secret` diberikan sekali setelah pengajuan. Warga harus menyimpan kode itu bersama nomor pengajuan; saat ini belum tersedia pemulihan kode.
- NIK, nomor KK, telepon, dan alamat disimpan terenkripsi memakai `APP_KEY`. Endpoint publik hanya mengembalikan metadata status; daftar petugas tidak menampilkan field sensitif itu.
- Token petugas di frontend hanya disimpan dalam memori halaman. Refresh atau pindah route meminta login ulang. Jangan simpan token dalam URL atau localStorage.
- Belum ada PDF, unggah dokumen, OTP, pengelolaan konten, atau otorisasi petugas yang lebih terperinci. Jangan menguji dengan data pribadi nyata.

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
