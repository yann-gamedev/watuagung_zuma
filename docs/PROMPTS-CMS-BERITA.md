# CMS Berita — Rancangan dan Prompt Sesi C1–C4

> Permintaan klien 27 Okt 2026: perangkat desa dapat menambah, mengubah, menghapus, dan menerbitkan berita dari panel admin. Ini mengerjakan sebagian M5 (hanya berita; profil/agenda/pengumuman tetap statis). Dikerjakan **sebelum** F12a/F12b, karena menambah kebutuhan server (folder media publik).

## Keputusan rancangan

| # | Keputusan | Pilihan | Alasan |
|---|---|---|---|
| K2 | Cara halaman publik mendapat berita | **Diambil di browser dari API** (`GET /api/v1/posts`). Frontend tetap static export. | Berita baru langsung tampil tanpa build ulang dan tanpa mengganti hosting. Konsekuensi: Google mengindeks berita lebih lemah — dapat diterima untuk situs desa. |
| C-1 | URL detail | `/berita/baca/?slug=...` (query string) | Static export tidak bisa membuat halaman untuk slug yang baru ada setelah build. Pola sama dengan detail permohonan admin. |
| C-2 | Siapa yang mengelola | `admin` dan `staff` (petugas desa) | Sesuai "perangkat desa". Kepala desa dan RT/RW tidak. Bisa diubah di satu tempat (lihat C1). |
| C-3 | Alur terbit | **Draf → Terbit**, tanpa persetujuan berjenjang | Sederhana untuk pengguna 30+. Bisa ditambah nanti. |
| C-4 | Format isi | **Teks biasa per paragraf** (baris kosong = paragraf baru). Tanpa editor HTML. | Aman dari XSS tanpa dependensi sanitizer; cocok dengan tampilan artikel yang sudah ada. |
| C-5 | Gambar | **Satu foto sampul** per berita, JPG/PNG/WebP ≤ 3 MB, di-encode ulang di server | Encode ulang membuang metadata EXIF (termasuk lokasi GPS dari foto HP). |
| C-6 | Hapus | **Soft delete** (hilang dari situs dan panel, baris tetap ada); tercatat di audit | Mencegah kehilangan permanen karena salah klik. Pemulihan lewat database saja. |
| C-7 | Kategori | Daftar tetap: Kegiatan Desa, Pemerintahan, Pembangunan, Pemberdayaan, Layanan Publik, Ekonomi Lokal, Pengumuman | Mengikuti kategori di berita contoh. |
| C-8 | Demo Vercel | Tetap memakai berita contoh statis bila `NEXT_PUBLIC_API_URL` kosong | Demo tidak punya backend. |

**Perlu dikonfirmasi ke desa:** siapa saja yang akan menulis berita (menentukan akun yang dibuat), dan apakah berita perlu disetujui kepala desa sebelum terbit. Bila perlu persetujuan, tambahkan sesi C5 setelah C4.

## Dampak ke rencana lain

- **F12b (Nginx):** tambah `location /media/` yang menyajikan `backend/storage/app/public/posts` (hanya gambar, tanpa eksekusi PHP, `Cache-Control` panjang). Tambah `php artisan storage:link` atau path langsung di `deploy.sh`.
- **Backup (F12b):** arsipkan juga `storage/app/public/posts`.
- **Retensi (F10):** tidak berlaku untuk berita.
- **F11:** flag `NEXT_PUBLIC_SHOW_SAMPLE_CONTENT` tetap dipakai untuk demo; di mode API berita contoh tidak pernah tampil.
- **Pelatihan serah terima:** tambah materi "menulis dan menerbitkan berita".

## Urutan sesi

| Sesi | Isi | Ukuran | Bergantung pada |
|---|---|---|---|
| C1 | Backend: tabel, API publik dan CRUD admin (tanpa gambar) | Sedang | — |
| C2 | Backend: unggah foto sampul | Kecil–sedang | C1 |
| C3 | Panel admin: daftar dan formulir berita | Sedang | C1 (C2 untuk bagian foto) |
| C4 | Halaman publik membaca dari API | Sedang | C1 |

C3 dan C4 boleh paralel setelah C1 (dan C2) di-merge. Pakai **Pembuka** dari `PROMPTS-FINALISASI.md` di awal setiap sesi.

---

## C1 — Backend berita (tanpa gambar)

Branch: `feat/cms-news-api` · Tulis rencana dulu, tunggu persetujuan.

```text
## Tujuan
API untuk mengelola berita dari panel dan membacanya dari halaman publik.
Rancangan ada di PROMPTS-CMS-BERITA.md (baca bagian "Keputusan rancangan").

## Backend
1. Migration `posts`: id, slug (unik), title (maks 160), category (string,
   validasi dari enum C-7), summary (maks 300), body (text, teks biasa),
   status ('draft'|'published'), published_at (nullable), cover_path
   (nullable, dipakai di C2), created_by, updated_by (FK users, nullOnDelete),
   timestamps, softDeletes. Index (status, published_at).
2. Enum/kelas App\Domain\PostCategory untuk daftar kategori + label.
3. Model Post: SoftDeletes, scope published() = status published AND
   published_at <= now().
4. Slug otomatis dari judul (Str::slug), unik dengan akhiran -2, -3; TIDAK
   berubah saat judul diedit setelah pernah terbit (tautan lama tetap
   hidup).
5. Hak kelola: satu metode, mis. User::canManageContent() → role admin
   atau staff. Endpoint admin di bawah group auth:sanctum yang ada, cek
   peran di server (403).
6. Endpoint publik (tanpa token, throttle 60/menit):
   - GET /v1/posts?page= → hanya published, urut published_at desc,
     10 per halaman; field: slug, title, category, category_label,
     summary, published_at, cover_url (null dulu).
   - GET /v1/posts/{slug} → detail published + body; 404 untuk draf atau
     terhapus.
   Header Cache-Control: public, max-age=60.
7. Endpoint petugas:
   - GET /v1/staff/posts?status=&q=&page= (semua status kecuali terhapus)
   - GET /v1/staff/posts/{id}
   - POST /v1/staff/posts (title, category, summary, body, status)
   - PATCH /v1/staff/posts/{id}
   - DELETE /v1/staff/posts/{id} (soft delete)
   Terbit pertama kali mengisi published_at = now(); kembali ke draf
   mempertahankan published_at lama.
8. Validasi: body maks 20.000 karakter; tolak karakter kontrol; trim.
   Tidak ada HTML yang diproses — disimpan apa adanya, frontend
   merender sebagai teks.
9. Audit: post.created, post.updated, post.published, post.deleted di
   audit_logs (subject_type=post), tanpa isi berita.
10. Tes: publik hanya melihat terbit; draf/terhapus 404; peran
    village_head/rt_head/rw_head 403; tanpa token 401; slug unik dan
    stabil; validasi 422; audit tercatat. Jalankan di SQLite + PostgreSQL.
11. Perbarui types/pelayanan.ts (atau types/posts.ts), docs/integrasi.md,
    backend/README.md. ROADMAP M5: tambah sub-butir berita.

## Batasan
Tanpa dependensi baru. Jangan menyentuh frontend selain tipe.

Commit: feat(api): news posts management API
```

---

## C2 — Unggah foto sampul

Branch: `feat/cms-news-cover` · Setelah C1.

```text
## Tujuan
Satu foto sampul per berita, aman dan ringan.

## Tugas
1. POST /v1/staff/posts/{id}/cover (multipart `file`) dan
   DELETE /v1/staff/posts/{id}/cover. Throttle 10/menit. Hak kelola sama
   dengan C1.
2. Validasi: mimes jpg,jpeg,png,webp; maks 3 MB; dimensi minimal
   600×400, maksimal 6000×6000.
3. Proses dengan GD bawaan PHP (tanpa dependensi baru):
   - baca, perkecil ke lebar maks 1600 px (rasio tetap);
   - encode ulang ke WebP (kualitas 80) bila didukung, selain itu JPEG
     (kualitas 82) — ini sekaligus membuang EXIF/GPS;
   - nama file acak (Str::uuid) di disk public, folder `posts/`;
   - hapus file lama saat diganti atau dihapus.
4. cover_url di respons publik dan petugas = URL publik file
   (config('app.url') + '/media/posts/...' — tentukan prefix lewat env
   MEDIA_URL dengan bawaan storage URL Laravel; jelaskan di rencana).
5. Soft delete berita TIDAK menghapus file (agar bisa dipulihkan);
   catat sebagai temuan untuk pembersihan berkala nanti.
6. Pastikan ekstensi GD + WebP tersedia: tambahkan pemeriksaan di tes
   (skip dengan pesan jelas bila tidak ada) dan catat kebutuhan
   `php-gd` di docs/deploy-plan.md Fase 3.
7. Tes: tipe salah/terlalu besar 422; EXIF hilang (gunakan fixture JPEG
   fiktif ber-EXIF yang dibuat di tes); file lama terhapus saat diganti;
   peran salah 403.
8. Catat di docs/deploy-plan.md (Nginx, backup) kebutuhan folder media
   sesuai bagian "Dampak ke rencana lain" di PROMPTS-CMS-BERITA.md.

Commit: feat(api): news cover image upload
```

---

## C3 — Panel admin: kelola berita

Branch: `feat/cms-news-admin` · Setelah C1 (dan C2 untuk bagian foto). Tulis rencana dulu.

```text
## Tujuan
Perangkat desa bisa menulis, menyunting, menerbitkan, dan menghapus berita
tanpa bantuan teknis.

## Frontend
1. Menu sidebar "Berita" (ikon Newspaper) hanya untuk admin dan staff,
   di bawah "Buku registrasi". Ikuti pola filter peran di
   components/admin-sidebar.tsx.
2. /admin/berita: tabel (Judul, Kategori, Status badge Draf/Terbit,
   Tanggal terbit, Diperbarui), filter status, pencarian judul,
   pagination; di HP menjadi kartu. Tombol "Tulis berita".
3. /admin/berita/tulis/ dan /admin/berita/ubah/?id=... (query string,
   bukan route dinamis):
   - Field: Judul, Kategori (select label Indonesia), Ringkasan (dengan
     penghitung karakter), Isi (textarea besar; petunjuk "Pisahkan
     paragraf dengan baris kosong").
   - Foto sampul: pilih file, pratinjau, ganti, hapus; pesan galat dari
     server ditampilkan apa adanya. Unggah setelah berita tersimpan
     (butuh id).
   - Tombol: "Simpan draf", "Terbitkan" / "Simpan perubahan",
     "Kembalikan ke draf" (bila sudah terbit), "Pratinjau".
   - Pratinjau memakai komponen artikel publik yang sama (render teks,
     BUKAN dangerouslySetInnerHTML).
   - Peringatan sebelum meninggalkan halaman bila ada perubahan belum
     disimpan.
   - Tautan "Lihat di website" untuk berita terbit.
4. Hapus: dialog konfirmasi "Berita akan dihapus dari website. Lanjutkan?"
5. Semua permintaan lewat adminRequest(); 401 → login ulang (sudah ada).
6. Gaya: token DESIGN.md, teks ≥ 16px, tombol ≥ 48px, label jelas.

## Selesai jika
lint, tsc, build, build:demo, test:demo lulus. Uji dengan Laravel lokal:
tulis draf → unggah foto → terbitkan → ubah → kembalikan ke draf → hapus;
peran kepala desa tidak melihat menu dan mendapat 403 bila membuka URL.
Cek 390px dan 1440px.
Commit: feat(admin): news management screens
```

---

## C4 — Halaman publik membaca berita dari API

Branch: `feat/cms-news-public` · Setelah C1. Tulis rencana dulu.

```text
## Tujuan
/berita, detail berita, dan bagian "Kabar desa" di beranda menampilkan
berita yang diterbitkan dari panel, tanpa build ulang.

## Tugas
1. services/posts.ts: listPosts(page), getPost(slug) memakai pola
   services/pelayanan.ts (timeout 20 detik, validasi respons dengan Zod).
   Bila NEXT_PUBLIC_API_URL kosong (demo): kembalikan berita contoh dari
   lib/data.ts mengikuti NEXT_PUBLIC_SHOW_SAMPLE_CONTENT (perilaku F11
   tetap).
2. /berita: komponen klien yang memuat daftar; keadaan memuat, kosong
   ("Belum ada berita resmi."), dan galat ("Berita belum dapat dimuat"
   + tombol coba lagi); pagination "Muat lebih banyak".
3. Detail baru: /berita/baca/?slug=... membaca slug di browser. Isi
   dirender per paragraf (split baris kosong) sebagai teks. Judul
   dokumen (document.title) diperbarui setelah data dimuat. Slug tidak
   ada → pesan "Berita tidak ditemukan" + tautan kembali.
4. Route lama /berita/[slug]: tetap ada untuk demo; dalam mode API
   arahkan ke /berita/baca/?slug=<slug> di browser agar tautan lama
   tidak mati. Jelaskan pendekatan di rencana (ingat batas
   generateStaticParams pada static export).
5. Beranda "Kabar desa": 3 berita terbaru dari API; bila kosong/galat,
   bagian disembunyikan (bukan pesan galat di beranda).
6. Foto sampul: <img> biasa dengan alt = judul, loading="lazy", rasio
   tetap; tanpa foto → pola visual yang sudah ada, bukan teks
   "[FOTO KEGIATAN]".
7. Label "Konten contoh" hanya muncul untuk berita contoh (mode demo).
8. Perbarui scripts/test-demo.mjs bila perlu agar demo tetap lulus.

## Selesai jika
lint, tsc, build, build:demo, test:demo lulus. Uji dengan Laravel lokal:
berita yang baru diterbitkan di panel muncul di /berita dan beranda
tanpa build ulang; draf tidak muncul; berita dihapus → detail menampilkan
"tidak ditemukan". Cek 390px dan 1440px.
Commit: feat(web): public news pages read from API
```
