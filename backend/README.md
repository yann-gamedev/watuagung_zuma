# Backend Laravel — Desa Watuagung

Backend ini terpisah dari frontend Next.js/React di direktori induk. Laravel 13, Sanctum, dan SQLite untuk pengembangan. Tidak ada data warga contoh yang di-seed.

## Menjalankan

Dari folder `backend`: `composer install` (jika Composer tersedia), salin `.env.example` menjadi `.env`, jalankan `php artisan key:generate`, buat file `database/database.sqlite`, lalu `php artisan migrate` dan `php artisan serve --host=127.0.0.1 --port=8000`. Untuk pengujian: `php artisan test`. Jika Composer belum ada di PATH, gunakan `php ../composer.phar install` jika file lokal Composer tersedia. Jangan bagikan `.env`, database SQLite, atau kredensial petugas.

Buat akun petugas secara manual, **jangan** melalui endpoint registrasi publik. Misalnya `php artisan tinker`, lalu `App\Models\User::create(['name'=>'Petugas','email'=>'petugas@example.test','password'=>'password-kuat-unik','role'=>'staff']);`. Ganti email dan kata sandi contoh sebelum menjalankannya. Saat produksi gunakan HTTPS, `APP_DEBUG=false`, database server dengan backup terenkripsi, dan pengelolaan kunci aplikasi yang aman; perubahan APP_KEY setelah ada data akan membuat field terenkripsi tidak bisa dibaca.

## API v1

Kirim `Accept: application/json` dan `Content-Type: application/json`. Endpoint berada di `/api/v1`.

| Metode | Path | Akses | Keterangan |
| --- | --- | --- | --- |
| POST | `/applications` | Publik, rate limit 5/menit | Buat pengajuan; respons 201 `{success,request_id,status,lookup_secret}` |
| POST | `/applications/status` | Publik, rate limit 10/menit | Body `{request_id,lookup_secret}`; respons metadata status dan catatan |
| POST | `/staff/login` | Publik, rate limit 5/menit | Body `{email,password}`; respons bearer token |
| POST | `/staff/logout` | Bearer token | Cabut token saat ini |
| GET | `/staff/applications?status=SUBMITTED` | Bearer token | Daftar paginasi tanpa NIK/KK/alamat |
| PATCH | `/staff/applications/{request_id}/status` | Bearer token | Body `{status,catatan?}`; audit perubahan |

Form submit memakai field dalam `types/pelayanan.ts`. `nama_usaha`, `jenis_usaha`, dan `alamat_usaha` wajib untuk `SKU`. Respons validasi adalah HTTP 422 dengan `errors`. Status: `SUBMITTED → VERIFIED → PROCESSING → WAITING_APPROVAL → APPROVED`, dengan cabang `REJECTED` dan `NEED_REVISION` yang mewajibkan catatan. `APPROVED` saat ini **belum** menghasilkan surat atau PDF; jangan dipakai sebagai bukti dokumen siap tanpa menambahkan proses dokumen.

`lookup_secret` hanya ditampilkan sekali pada submit. Pengguna harus menyimpannya bersama `request_id`; jangan simpan token akses petugas di localStorage atau memasukkan kode rahasia ke URL/log. NIK, KK, nomor telepon, dan alamat tersimpan terenkripsi oleh APP_KEY; endpoint publik tidak mengembalikannya. Endpoint admin saat ini hanya memberi daftar ringkas, bukan akses detail PII.

## Integrasi frontend saat ini

Frontend sudah menggunakan JSON REST ketika `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1` disetel di `.env.local` pada direktori induk. Jalankan Laravel di port 8000 dan Next.js di port 3000. Kosongkan variabel itu untuk tetap menggunakan mode demo publik; panel petugas tidak aktif dalam mode demo. `FRONTEND_ORIGINS` di `.env` backend membatasi asal browser yang diizinkan (default `localhost:3000` dan `127.0.0.1:3000`); jalankan `php artisan config:clear` bila konfigurasi sebelumnya di-cache.

Halaman sukses menampilkan `lookup_secret` dari sessionStorage tab saat submit, tanpa menaruhnya di URL. Pengguna harus menyalin dan menyimpan nomor serta kode tersebut; bila tab ditutup, kode tidak dapat dipulihkan. Cek status meminta kedua nilai. Dashboard `/admin` meminta login petugas, memuat daftar paginasi, memperbarui status, dan mencabut token saat logout. Token petugas hanya disimpan di memori halaman: refresh atau pindah route mengharuskan login ulang.

## Tahap migrasi berikutnya

1. Pindahkan autentikasi petugas ke sesi cookie HttpOnly melalui deployment satu origin/BFF, tambah otorisasi granular dan detail yang dibutuhkan petugas. Hindari penyimpanan bearer token di browser secara permanen.
2. Migrasikan konten publik (profil, berita, agenda, statistik, transparansi) setelah data resmi diverifikasi. Bangun endpoint publik, editor, dan izin petugas secara terpisah.
3. Tambahkan alur dokumen/PDF dan persetujuan sebelum menganggap status `APPROVED` sebagai surat siap; tambahkan unggah privat, notifikasi, audit, backup dan retensi data.
4. Rancang pemulihan kode akses dengan verifikasi kepemilikan (misalnya OTP) sebelum menggunakan data warga sungguhan.

**Batas saat ini:** belum ada pemulihan kode, OTP, dokumen, PDF, role granular, maupun autentikasi cookie HttpOnly. Jangan memakai data pribadi nyata untuk pengujian.
