# Progres 5 November 2026 — Layar UMKM (panel + publik)

Branch `feat/umkm-web` dari `origin/main` `b055ff5` (setelah PR #57 API UMKM).

## Lingkup

Perangkat desa menambah UMKM dari panel; warga melihat daftar dan detail UMKM di website. Satu perubahan kecil backend diperlukan agar beranda bisa menampilkan "3 UMKM terbaru".

## File

- **Panel**: `features/admin/business-data.ts` (Zod, batas sama dengan server), `business-list.tsx` dan `business-editor.tsx` (pola `news-list`/`news-editor`: filter, tabel/kartu, draf/terbit, foto setelah teks tersimpan, dialog hapus, peringatan keluar), `app/admin/umkm/{,tambah,ubah}/page.tsx`, `components/admin-sidebar.tsx` (menu "UMKM" admin/staff), `features/admin/news.module.css` (kotak centang ≥48px).
- **Publik**: `services/businesses.ts` (pola `services/posts.ts`; demo kosong tanpa fetch), `features/umkm/public-businesses.tsx` (daftar `/umkm`, filter kategori tombol, kartu `news-card`, kartu beranda), `features/umkm/business-detail.tsx`, `app/umkm/page.tsx`, `app/umkm/lihat/page.tsx`, `app/page.tsx`, `components/site-header.tsx` dan `components/site.tsx` (menu/footer), `app/globals.css`.
- **Backend**: `BusinessController` menerima `sort=name|latest` (bawaan nama; nilai lain 422), tes di `BusinessesApiTest`.
- **Tes/dokumen**: `scripts/test-public-businesses.mjs` (dipanggil `test:demo`), `docs/integrasi.md`, `backend/README.md`, `ROADMAP.md`.

## Keputusan yang saya ambil (mohon dikoreksi)

- Kartu UMKM memakai pola kartu berita yang sudah ada. Usaha **tanpa foto** memakai kotak polos `--sage` dengan ikon toko, bukan pola foto ilustrasi berita, agar tidak dikira foto usaha.
- Ilustrasi judul `/umkm` tanpa label teks kecil (label berita berukuran 7px). Penghitung dan tautan kembali di halaman UMKM dinaikkan ke 16px; gaya berita tidak diubah.
- Tombol "Chat WhatsApp" membuka `wa.me/<nomor>` dengan pesan pembuka "Halo, saya melihat <nama usaha> di website Desa Watuagung."
- Tanpa izin kontak, detail menulis "Kontak pemilik tidak ditampilkan. Untuk informasi usaha ini, hubungi kantor desa."
- Layout ini belum tercatat di `DESIGN.md`.

## Verifikasi yang dijalankan

| Perintah / pemeriksaan | Hasil |
|---|---|
| `php artisan test --compact` (SQLite) | **339 lulus / 5.288 assertion** |
| `php artisan test --env=testing.pgsql --compact` | **339 lulus / 5.290 assertion** |
| `npm run lint`, `npx tsc --noEmit` | Lulus |
| `npm run build`, `npm run build:demo` | Lulus. Beberapa percobaan build dengan `NEXT_PUBLIC_API_URL` uji crash di worker Next.js (kode 134); diulang tanpa perubahan, lulus |
| `npm run test:demo` (termasuk `test-public-businesses.mjs`) | Lulus |
| Demo (static, tanpa API), Chrome headless | `/umkm` keadaan kosong tanpa UMKM karangan, beranda "Segera hadir", tautan footer; 390/1440 lulus |
| E2E Laravel lokal (port 8002, DB SQLite sementara, akun fiktif) + static export | Nomor `0812` ditolak; tambah + foto + terbit; API publik tanpa nama/nomor; detail tanpa nama/tombol WA. Centang izin → nama pemilik dan Chat WhatsApp (`wa.me`, tab baru, ≥48px). Daftar panel tanpa nomor. Usaha kedua (Jasa) + draf: draf tidak tampil; filter Jasa/Kerajinan/Semua dengan `aria-pressed`; beranda menampilkan usaha terbaru dulu tanpa "Segera hadir". |
| Visual 390px/1440px (`/umkm`, detail, kartu beranda, daftar & formulir panel) | Tanpa scroll horizontal, teks ≥15px, tombol/centang ≥48px; screenshot diperiksa |

Foto uji yang terunggah ke `backend/storage/app/public/businesses` sudah dihapus. Database pengembangan, `.env`, `.env.local` tidak disentuh.

## Belum berfungsi / keputusan

- **Hapus UMKM dan hapus foto lewat panel gagal saat frontend dan API beda origin** (pengembangan lokal): preflight CORS hanya mengizinkan `GET, POST, PUT, PATCH, OPTIONS`. Di produksi sesuai `docs/deploy-plan.md` (frontend dan `/api` satu domain) tidak ada preflight, tetapi belum diuji. Perbaikan satu baris `backend/config/cors.php` (tambah `DELETE`) juga memperbaiki temuan berita C4; menunggu persetujuan.
- `PRODUCT.md` masih menulis pengelolaan UMKM sebagai "Belum tersedia"; perlu diperbarui Tech Lead.
- Formulir izin pemilik dan data UMKM resmi dari desa belum ada.
