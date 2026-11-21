# Progres: Foto Inline Berita & Relaksasi Unggah Foto (2026-11-21)

## 1. Masalah Utama
1. **Berita lokal tidak bisa dibuka ("Berita belum dapat dimuat")**:
   - Terjadi karena server lokal `php artisan serve` pada port 8000 sebelumnya terhenti/stalled saat migrasi tabel belum dijalankan.
   - Tabel `post_images` belum ada pada SQLite lokal ketika endpoint detail berita langsung memuat relasi eager-load `images`.
2. **Kebutuhan foto inline**:
   - Detail artikel berita memerlukan dukungan 2–3 foto tambahan yang disisipkan di sela paragraf tanpa mengganggu pembacaan teks artikel.
3. **Batas unggah foto terlalu ketat dan foto terpotong**:
   - Admin UMKM dan Berita terkendala batas file/resolusi.
   - Kartu berita/UMKM sebelumnya memotong foto (`object-fit: cover`) sehingga proporsi asli terpotong.
   - Lingkungan PHP lokal (`upload_max_filesize=2M`) sering menolak unggahan langsung sebelum masuk ke Laravel.

---

## 2. Solusi yang Diterapkan

### Backend (Laravel)
- **Tabel & Model Baru**:
  - Migrasi `post_images` (`id`, `post_id`, `path`, `caption`, `position`, `created_at`, `updated_at`).
  - Model `PostImage` dan relasi `Post::images()`.
- **Endpoint Foto Inline**:
  - `POST /api/v1/staff/posts/{id}/images` (maksimal 3 foto, validasi 10 MB, resize terpanjang 2000px).
  - `PATCH /api/v1/staff/posts/{id}/images/{image}` (update takarir/caption max 200 karakter).
  - `DELETE /api/v1/staff/posts/{id}/images/{image}` (hapus file fisik WebP dan record DB).
- **Public API & Kontrak Data**:
  - `GET /api/v1/posts/{slug}` menyertakan array `images: [{ url, caption }]`. Daftar berita publik (`index`) tetap ringan tanpa menyertakan `images`.
  - Detail staf `GET /api/v1/staff/posts/{id}` menyertakan `images: [{ id, url, caption }]`.
  - Hapus berita (`DELETE /posts/{id}`) otomatis membersihkan file foto inline terkait.
  - Perintah `media:prune` diperbarui untuk membersihkan foto inline pada berita yang di-soft-delete melebihi 30 hari dan mempertahankan foto aktif.
- **ImageProcessor**:
  - Batas berkas dinaikkan menjadi 10 MB.
  - Dukungan parameter `$maxHeight` untuk membatasi sisi terpanjang foto (2000 px) dengan tetap menjaga rasio asli (tanpa crop).
  - Skrip admin UMKM foto cover juga mendukung hingga 10 MB dengan sisi terpanjang 2000 px.

### Frontend (Next.js)
- **Kompresi Sisi Klien (`lib/image-compress.ts`)**:
  - Mengubah foto ke WebP, sisi terpanjang ≤ 2000 px, target ukuran ≤ 1.8 MB sebelum dikirim ke API. Menghindari batasan `upload_max_filesize=2M` bawaan PHP lokal.
- **Tampilan Detail Berita (`features/news/news-article.tsx` & `components/news-article.tsx`)**:
  - Foto inline disisipkan otomatis berselang-seling: foto 1 setelah paragraf 1, foto 2 setelah paragraf 2, foto 3 setelah paragraf 3.
  - Jika paragraf kurang dari jumlah foto, sisa foto ditempatkan rapi di akhir paragraf.
  - Menampilkan takarir (caption) jika ada, dan teks alternatif yang aksesibel.
- **Editor Admin Berita (`features/admin/news-editor.tsx`)**:
  - UI manajemen foto inline hingga 3 foto dengan pratinjau langsung.
  - Input takarir opsional per foto (simpan instan).
  - Tombol hapus foto per item.
  - Notifikasi bahwa naskah berita harus disimpan terlebih dahulu sebelum menambah foto inline.
- **Gaya Visual & Rasio Foto (`app/globals.css`, `DESIGN.md`)**:
  - Kartu Berita & UMKM: menggunakan `object-fit: contain` dengan latar belakang netral lembut agar gambar penuh terlihat tanpa ada bagian yang terpotong.
  - Halaman Detail: foto cover dan foto inline menggunakan rasio natural (`height: auto; max-width: 100%`) dengan border radius halus dan bayangan lembut.

---

## 3. Hasil Verifikasi

Semua perintah pengujian dijalankan langsung:

1. **Backend Tests (PHPUnit)**:
   - `php artisan test` (520 tests, 25,438 assertions): **LULUS (100% PASS)**.
   - `PostImagesTest` (10/10 lulus).
   - `KimRoleTest` (11/11 lulus).
   - `PostCoverTest` (30/30 lulus).
   - `MediaPruneTest` (2/2 lulus).
2. **Frontend Typecheck & Lint**:
   - `npx tsc --noEmit`: **LULUS** (tanpa error).
   - `npm run lint`: **LULUS** (eslint bersih).
3. **Build & Demo**:
   - `npm run build`: **LULUS** (Next.js compiled successfully).
   - `npm run build:demo`: **LULUS**.
   - `npm run test:demo`: **LULUS (100% PASS)** mencakup validasi Zod untuk detail berita dengan foto inline dan penempatan paragraf.
4. **Verifikasi Browser & Runtime**:
   - Migrasi lokal dijalankan: `php artisan migrate` -> tabel `post_images` aktif.
   - Endpoint `/api/v1/posts/informasi-peluncuran-website-2` mengembalikan HTTP 200 dengan JSON detail dan `images: []`.
   - Halaman `http://127.0.0.1:3000/berita/baca/?slug=informasi-peluncuran-website-2` terbuka sempurna tanpa pesan galat "Berita belum dapat dimuat".
   - Browser snapshot membuktikan judul, isi, dan foto cover ter-render dengan benar.

---

## 4. Batasan & Catatan Lingkungan
- Pada server produksi (Hostinger), jalankan `php artisan migrate` agar tabel `post_images` tersedia.
- Jika PHP hosting memiliki batas unggah kecil, fungsi kompresi peramban otomatis menurunkan ukuran sebelum unggah, namun tetap disarankan menaikkan `upload_max_filesize=10M` dan `post_max_size=12M` di `php.ini` server produksi.
