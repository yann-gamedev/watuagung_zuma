# Progres 5 November 2026 — API direktori UMKM

Branch `feat/umkm-api` dari `origin/main` `ccac530` (setelah PR #56 video).

## Lingkup

API backend untuk daftar UMKM warga dengan pola berita C1–C2. Tidak ada panel atau halaman publik baru; halaman UMKM tetap "Segera hadir".

## File

- `backend/app/Domain/BusinessCategory.php`: enum 6 kategori + label.
- `backend/app/Models/Business.php`: soft delete, scope terbit, slug unik termasuk terhapus, `owner_name`/`whatsapp` cast `encrypted`, `HAMLETS`.
- `backend/database/migrations/2026_11_05_000000_create_businesses_table.php`: kolom sesuai rencana; kontak `text` karena ciphertext.
- `backend/app/Http/Controllers/Api/BusinessController.php`, `backend/routes/api.php`: publik (60/menit, `public, max-age=60`, 12/halaman, filter kategori), petugas CRUD + foto (`canManageContent()`, `private, no-store`, foto 10/menit), audit `business.created/updated/published/deleted` tanpa isi.
- `backend/tests/Feature/BusinessesApiTest.php`: 20 tes.
- `types/business.ts` (+ ekspor ulang `types/pelayanan.ts`), `docs/integrasi.md`, `backend/README.md`, `docs/deploy-plan.md` (media `/media/businesses/`), `ROADMAP.md`.

## Keputusan yang saya ambil (mohon dikoreksi bila keliru)

- Tanpa izin, key `owner_name`/`whatsapp` dihilangkan dari respons publik (bukan null). `consent_public_contact` tidak dikirim ke publik.
- Nama pemilik dan WhatsApp dienkripsi di database dan tidak dimuat di daftar petugas, mengikuti aturan data pribadi proyek. Akses detail petugas **belum** dicatat `business.viewed`, karena tidak diminta.
- WhatsApp: `62` + 8–13 digit. Daftar publik urut nama, 12 per halaman.

## Verifikasi yang dijalankan

| Perintah | Hasil |
|---|---|
| `php artisan test --compact` (SQLite) | **339 lulus / 5.281 assertion** |
| `php artisan test --env=testing.pgsql --compact` | **339 lulus / 5.283 assertion** |
| `npm run lint`, `npx tsc --noEmit`, `npm run build` | Lulus |

Tes mencakup: publik tanpa izin tidak membocorkan nama/nomor (daftar dan detail), kontak terenkripsi di database, draf/terjadwal/terhapus 404, filter/pagination/validasi query, tanpa token 401, peran salah/nonaktif/ability salah 403 sebelum validasi, alur buat-terbit-ubah-draf-hapus dengan audit dan slug stabil, validasi field, daftar petugas tanpa kontak, audit tanpa isi, foto (encode ulang, lebar 1.600, ganti/hapus, file invalid, soft delete tidak menghapus file, throttle), throttle publik.

Catatan: middleware TrimStrings membuang NUL/kontrol di **ujung** teks sebelum validasi (perilaku sama dengan berita); kontrol di tengah teks ditolak.

## Sisa pekerjaan

- `backend/config/cors.php` belum mengizinkan `DELETE` (temuan C4); perlu sebelum panel UMKM bisa menghapus usaha/foto lintas-origin.
- Panel `/admin/umkm` dan halaman publik UMKM; kebijakan dan formulir izin pemilik (data dari desa, M5).
- Konfigurasi Nginx `/media/businesses/` belum diuji. Tidak ada push/deploy.
