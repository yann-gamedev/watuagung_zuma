# Integrasi pelayanan Watuagung

## Arsitektur saat ini

Frontend menggunakan Next.js App Router, React, TypeScript, dan Tailwind CSS. Form menggunakan React Hook Form dan Zod. Backend pelayanan menggunakan Laravel 13 dan Sanctum. Petunjuk Google Apps Script sebelumnya sudah tidak berlaku; tidak ada migrasi backend dalam pembaruan layout ini.

- `components/`: komponen bersama.
- `features/`: formulir, hasil pengajuan, cek status, dan panel petugas.
- `services/pelayanan.ts`: transport JSON API dan simulasi browser.
- `lib/validation.ts` dan `types/pelayanan.ts`: validasi dan kontrak frontend.
- `backend/routes/api.php`: endpoint Laravel.

## Mode simulasi dan API

Tanpa `NEXT_PUBLIC_API_URL`, pelayanan publik memakai simulasi. localStorage menyimpan maksimal 50 receipt (nomor, status, penanda sukses), bukan identitas formulir. Contoh status tersedia di adapter pelayanan. Panel petugas tidak aktif dalam mode ini. Gunakan data fiktif.

Untuk API lokal, isi `.env.local` dengan:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

Jangan menimpa konfigurasi lokal yang sudah digunakan. Variabel NEXT_PUBLIC disertakan dalam bundle browser dan tidak boleh berisi kredensial. Restart server frontend setelah perubahan konfigurasi, atau build ulang untuk hosting statis.

Jalankan Laravel sesuai [README backend](../backend/README.md). Atur `FRONTEND_ORIGINS` backend sesuai origin frontend. Integrasi memakai bearer token, bukan cookie lintas-origin.

## Kontrak API

Path berikut relatif terhadap `/api/v1`. Transport menggunakan `Accept: application/json` dan `Content-Type: application/json`, tanpa field `action`.

| Metode | Path | Permintaan / kegunaan |
| --- | --- | --- |
| POST | `/applications` | Field sesuai [Submission](../types/pelayanan.ts); SKU memerlukan informasi usaha |
| POST | `/applications/status` | `request_id` dan `lookup_secret` |
| POST | `/staff/login` | `email` dan `password`; respons bearer token |
| POST | `/staff/logout` | Mencabut token petugas aktif |
| GET | `/staff/applications` | Daftar paginasi; parameter `page` dan filter `status` opsional |
| PATCH | `/staff/applications/{request_id}/status` | `status` dan `catatan` |

Pengajuan berhasil mengembalikan HTTP 201 dengan `success`, `request_id`, `status`, dan `lookup_secret`. Cek status mengembalikan metadata status serta catatan, bukan identitas sensitif. Respons validasi gagal menggunakan HTTP 422. Frontend membatasi waktu tunggu API menjadi 20 detik dan memvalidasi respons pelayanan dengan Zod.

## Kode akses dan autentikasi

- Kode akses diberikan setelah pengajuan API dan disimpan pada sessionStorage tab untuk halaman berhasil. Simpan nomor serta kode di tempat aman; pemulihan belum tersedia.
- Kode akses dikirim pada body POST untuk cek status, tidak dimasukkan ke URL.
- Backend menyimpan hash kode akses; NIK, KK, telepon, dan alamat dienkripsi dengan APP_KEY.
- Token petugas hanya berada di memori halaman. Refresh atau perpindahan route dapat meminta login ulang. Jangan memindahkan token ke URL atau localStorage.
- Jangan mengganti APP_KEY pada database berisi data terenkripsi tanpa prosedur migrasi yang benar.

## Status dan batas fitur

Alur normal: `SUBMITTED` -> `VERIFIED` -> `PROCESSING` -> `WAITING_APPROVAL` -> `APPROVED`.

`NEED_REVISION` dan `REJECTED` memerlukan catatan. Backend membatasi transisi status dan mencatat perubahan. `APPROVED` berarti disetujui, **bukan PDF tersedia**.

Login, daftar permohonan, filter, pagination, perubahan status, dan logout sudah diimplementasikan. PDF, unggah dokumen/revisi, pemulihan kode akses, OTP, notifikasi, dan pengelolaan konten publik belum tersedia. Menu konten admin masih prototipe.

## Menjalankan dan memeriksa

```powershell
npm ci
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

Build menghasilkan static export pada `out/`; hosting harus mendukung direktori index.html dan halaman 404. Rute dinamis publik menggunakan generateStaticParams. Laravel dijalankan terpisah.

ESLint mengecualikan dependensi Composer dan output/cache generasi secara spesifik; kode aplikasi tetap diperiksa. Pengujian PHP terpisah dijelaskan pada README backend.

Uji menggunakan data fiktif: formulir kosong, NIK/KK tidak valid, tanggal masa depan, SKU tanpa informasi usaha, pengajuan valid, salin receipt, kode akses salah, perubahan status, filter dan pagination, serta logout. Jangan mengklaim alur API lulus hanya berdasarkan build frontend.

## Konten publik dan produksi

Konten, statistik, anggaran, jadwal, dan informasi BUMDES masih prototipe atau menunggu verifikasi. Foto persawahan adalah ilustrasi Thomas Fuhrmann dari Wikimedia Commons, CC BY-SA 4.0, dipotong pada tampilan; atribusi di footer. Jangan mengklaimnya sebagai dokumentasi desa.

Noindex prototipe dipertahankan. Sebelum produksi, verifikasi data resmi, domain, HTTPS, CORS, backup, retensi data, dan keamanan backend. Jangan mengaktifkan indeks pencarian sebelum konten dan kesiapan layanan disetujui.
