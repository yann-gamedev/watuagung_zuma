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
if (!(Test-Path database/database.sqlite)) { New-Item database/database.sqlite -ItemType File }
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

## Preview dan deployment Vercel (demo tanpa backend)

Target deployment saat ini adalah **prototipe statis**, bukan layanan administrasi produksi. Konfigurasi `vercel.json` menjalankan `npm run build:demo`; preset Next.js menangani hasil static export secara otomatis. Script ini memaksa mode demo serta mengabaikan URL API lama, termasuk URL localhost yang mungkin masih ada di dashboard Vercel.

- Root Directory: root repositori (bukan `backend`).
- Framework Preset: Next.js; Build Command: `npm run build:demo`.
- Output Directory: **default, Override nonaktif**. Jangan isi `out`: adapter Next.js perlu membaca manifest internal dari `.next`, meskipun hasil export statis tersedia di `out`.
- Gunakan Node.js 22.x atau 24.x yang didukung Vercel. Install dengan `npm ci`.
- Hapus override build/output lama di dashboard jika berbeda dengan konfigurasi repo.
- Tidak perlu PHP, Composer, database, atau API Laravel untuk deployment ini.
- Panel petugas sengaja nonaktif. Pengajuan hanya menyimpan nomor/status simulasi di browser, bukan identitas pemohon.
- Gunakan data fiktif. Simulasi tidak menerbitkan surat dan tidak diproses pemerintah desa.
- Maksimal 50 bukti simulasi disimpan pada browser/origin yang sama; penghapusan storage menghapus riwayat. Status simulasi baru tetap diterima, tidak bergerak otomatis.

Verifikasi sebelum push:

```powershell
npm run lint
npm run test:demo
npx tsc --noEmit
npm run build:demo
```

Untuk mencoba demo lokal dengan dev server:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE="true"
npm run dev
```

Setelah deploy, uji empat formulir, autofill NIK dummy, halaman sukses, cek status, refresh URL bertingkat, tampilan mobile, dan halaman admin pada **URL Vercel sebenarnya**. Build lokal yang berhasil belum membuktikan konfigurasi hosting remote benar.

Mode API lokal tetap tersedia melalui `npm run dev`/`npm run build` jika `NEXT_PUBLIC_DEMO_MODE` bukan `true` dan `NEXT_PUBLIC_API_URL` terisi. Backend tidak termasuk cakupan kesiapan demo Vercel; jangan mengaktifkan mode API untuk warga tanpa menyelesaikan review backend dan integrasi terpisah.

## Batas prototipe dan langkah berikutnya

Data publik masih contoh dan situs sengaja belum diindeks sampai informasi resmi diverifikasi. Belum ada pembuatan PDF, unggah dokumen, pemulihan kode akses/OTP, atau pengelolaan konten melalui backend. Token petugas hanya disimpan dalam memori halaman; login ulang diperlukan setelah refresh. Sebelum digunakan warga, diperlukan pengamanan dan uji produksi, autentikasi yang lebih kuat, kebijakan retensi data, serta verifikasi seluruh konten resmi.
