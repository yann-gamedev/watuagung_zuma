# Sistem Informasi dan Pelayanan Digital Desa Watuagung

Website desa dan prototipe pelayanan administrasi. Proyek ini terdiri dari frontend Next.js/React dan API Laravel dalam satu repositori. Konten, angka statistik, dan contoh layanan saat ini belum merupakan data resmi desa.

## Fitur saat ini

- Informasi publik: beranda, profil, sejarah, visi-misi, struktur pemerintahan, berita, pengumuman, agenda, potensi, statistik, transparansi, dan kontak.
- Empat formulir pelayanan: SKU, domisili, SKTM, serta pengantar KTP/KK.
- Pengajuan dan cek status melalui API Laravel. Warga menerima nomor pengajuan dan kode akses rahasia yang diperlukan untuk melihat status.
- Panel petugas di `/admin`: login, daftar pengajuan, filter status, perubahan status, dan logout. Dokumen surat/PDF belum dibuat.

## Teknologi dan struktur

| Bagian | Teknologi | Lokasi |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript | `app/`, `components/`, `features/`, `services/` |
| Backend | Laravel 13, Sanctum, PHP 8.3+ | `backend/` |
| Database pengembangan | SQLite | `backend/database/database.sqlite` (tidak masuk Git) |

Panduan endpoint dan persiapan Laravel terdapat di [backend/README.md](backend/README.md).

## Menjalankan di komputer lokal

Siapkan Node.js 22.13+ dan PHP 8.3+. Jalankan backend dan frontend dalam **dua terminal terpisah**. Perintah berikut ditulis untuk PowerShell di Windows.

### 1. Backend Laravel

Di folder `backend/`, pasang dependensi. Jika Composer belum ada di PATH, gunakan `php ..\composer.phar install` apabila file Composer lokal tersedia. Lalu siapkan aplikasi:

```powershell
php ..\composer.phar install
Copy-Item .env.example .env
php artisan key:generate
New-Item database/database.sqlite -ItemType File -Force
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Jika Composer tersedia global, ganti baris pertama dengan `composer install`. Jangan menjalankan `key:generate` ulang setelah ada data terenkripsi. Cek backend di http://127.0.0.1:8000/up. Terminal server ini perlu tetap berjalan.

### 2. Frontend Next.js

Di **folder utama repositori**, siapkan `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

Isi `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1` dalam `.env.local`, kemudian jalankan:

```powershell
npm ci
npm run dev
```

Buka http://127.0.0.1:3000. Setelah mengubah `.env.local`, hentikan dan jalankan ulang `npm run dev`. Pastikan alamat frontend sama dengan salah satu origin yang diizinkan oleh backend (lihat [panduan CORS](backend/README.md#integrasi-frontend-saat-ini)).

Jika `NEXT_PUBLIC_API_URL` dibiarkan kosong, formulir publik memakai mode simulasi di browser dan panel petugas tidak aktif. Gunakan **data fiktif saja** untuk pengujian.

## Cara mencoba alur utama

1. Buka `/pelayanan`, pilih layanan, lalu isi dan kirim formulir dengan data fiktif.
2. Di halaman berhasil, **salin nomor pengajuan dan kode akses**. Kode akses tidak dimasukkan ke URL dan tidak dapat dipulihkan bila hilang.
3. Buka `/pelayanan/status`, masukkan keduanya, lalu lihat status pengajuan.
4. Untuk mencoba `/admin`, buat akun petugas lokal terlebih dahulu melalui langkah di [panduan backend](backend/README.md#akun-petugas), lalu login. Ubah status sebuah pengajuan dan periksa kembali statusnya sebagai warga.

Untuk menjalankan tes API, gunakan `php artisan test` dari folder `backend/`. Untuk memeriksa frontend dari folder utama, gunakan `npx tsc --noEmit` dan `npm run build`.

## Preview dan deployment

Frontend dapat dipreview di Vercel dengan root directory repositori ini. Laravel **tidak** otomatis ikut berjalan di Vercel: alur API memerlukan backend HTTPS dan database persisten yang di-host terpisah. Set `NEXT_PUBLIC_API_URL` pada environment Preview di Vercel ke `https://alamat-backend/api/v1`, lalu redeploy. Izinkan domain preview frontend melalui `FRONTEND_ORIGINS` di backend.

Tanpa backend publik, kosongkan `NEXT_PUBLIC_API_URL` pada Vercel agar halaman publik tetap dapat didemokan. Panel petugas tidak tersedia pada mode tersebut. Jangan memakai URL `127.0.0.1` untuk preview online karena hanya merujuk ke perangkat pengunjung.

## Batas prototipe dan langkah berikutnya

Data publik masih contoh dan situs sengaja belum diindeks sampai informasi resmi diverifikasi. Belum ada pembuatan PDF, unggah dokumen, pemulihan kode akses/OTP, atau pengelolaan konten melalui backend. Token petugas hanya disimpan dalam memori halaman; login ulang diperlukan setelah refresh. Sebelum digunakan warga, diperlukan pengamanan dan uji produksi, autentikasi yang lebih kuat, kebijakan retensi data, serta verifikasi seluruh konten resmi.
