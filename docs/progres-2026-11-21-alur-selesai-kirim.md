# Progres — alur warga selesai saat disetujui + penjaga kirim formulir (21 November 2026)

Branch: `fix/citizen-flow-final-step`, dari `origin/main` @ `aa37436`. Terpisah dari `feat/news-copyright-social-links` (belum di-push).

## 1. Laporan bug: setelah konfirmasi pengajuan, kode akses tidak tampil dan tidak dialihkan

Gejala dari pengguna: setelah klik **Kirim permohonan**, tidak terjadi apa-apa.

**Tidak dapat direproduksi** dengan kode saat ini:
- Static export + Laravel lokal (SQLite sementara, data fiktif): formulir asli diisi lewat Chrome headless, tiga PDF fiktif diunggah, lalu dikirim. Hasilnya HTTP 201, dialihkan ke `/pelayanan/sukses/`, dan kode `WAD-xxxx-xxxx` tampil.
- `next dev` (webpack, worktree terpisah, port 3011): hasil sama setelah hidrasi.
- Backend pengguna di :8000 diperiksa hanya-baca: preflight CORS 204 untuk `localhost:3000` dan `127.0.0.1:3000`, `GET /posts` 200. `migrate:status` database lokal (dengan izin): semua migration sudah jalan. Satu migration berita baru dari branch berita masih pending; tidak terkait pengajuan.
- Log Laravel lokal tidak mencatat galat pengajuan. Catatan: ada dua proses `php -S 127.0.0.1:8000` sekaligus (PID 19100 sejak 10:32 dan 36232 sejak 12:54); sebaiknya hentikan satu.

**Satu-satunya jalur "tidak terjadi apa-apa" yang ditemukan:** tombol diklik sebelum React selesai hidrasi. Ini mudah terjadi di `next dev` karena kompilasi pertama ±13 detik. Form ber-`method="post"` lalu terkirim secara bawaan browser dan halaman dimuat ulang tanpa pesan; terlihat di uji sebagai dua kali muat `site/contact` tanpa POST `/applications`.

**Perbaikan defensif** (`features/pelayanan/application-form.tsx`): tombol formulir dikunci dengan teks "Memuat formulir…" sampai hidrasi selesai (`useSyncExternalStore`; HTML statis berisi tombol terkunci). Bila bug masih muncul, perlu teks konsol browser (F12) dan tab Network saat klik Kirim.

## 2. Tampilan alur: disetujui Kepala Desa = selesai

- `lib/letter-workflow.ts`: tahap "Selesai (surat sudah diunduh)" dihapus. Tahap terakhir menjadi **"Selesai — disetujui Kepala Desa"**. `timelineStatus` memetakan `APPROVED`/`READY_FOR_PICKUP`/`COMPLETED` ke tahap itu (`isCitizenFinal`).
- `features/pelayanan/status-checker.tsx`:
  - Saat tahap terakhir tercapai, semua tahap tercentang tanpa `aria-current`, status tahap "Selesai", dan judul kotak "Keterangan" menggantikan "Langkah berikutnya".
  - Sebelum disetujui, tahap terakhir berbunyi "Setelah Kepala Desa menyetujui, surat langsung bisa diunduh dan dicetak sendiri. Berlaku 7 hari."
  - Daftar nomor contoh demo disesuaikan.
- `components/site.tsx`:
  - `StatusBadge citizen` berlabel **Selesai** (ikon centang) untuk ketiga status; panel admin tetap memakai label lama.
  - Deskripsi `COMPLETED` tidak lagi "Surat sudah diunduh".
- Status backend, email, dan panel tidak berubah.
- `DESIGN.md` dicatat; `scripts/test-demo.mjs` diperbarui.

## Verifikasi (benar-benar dijalankan)

- `npm run lint`: 0 error, 1 warning lama (`app/components/LembagaList.tsx`). `npx tsc --noEmit`: lulus.
- `npm run build`: satu percobaan gagal sesaat setelah server statis uji dihentikan (log tertimpa; diduga `out/` masih terkunci), lalu dua percobaan berikutnya lulus. `npm run build:demo`, `npm run test:demo`: lulus.
- Backend tidak diubah; `php artisan test` tidak dijalankan di sesi ini.
- **Uji browser** (Laravel :8010 SQLite sementara, static export :3010, Chrome headless, data fiktif):
  - Formulir asli → kirim → halaman sukses dengan kode `WAD-…`.
  - Linimasa 390px: menunggu persetujuan = tahap 4 saat ini, tahap 5 belum dimulai.
  - Setelah kades setuju, pada 390px dan 1440px: badge Selesai, kelima tahap tercentang, "Keterangan", tombol unduh tetap ada, tanpa scroll horizontal.
  - Setelah unduh (`COMPLETED`): tetap Selesai dan unduh ulang tersedia. Screenshot diperiksa visual.
- Pembersihan: 20 berkas fiktif yang tertulis ke `backend/storage/app/private` (hanya path yang tercatat di DB sementara) dihapus; storage kembali sama. Worktree uji dan junction `node_modules` dihapus. `out/` dibangun ulang dengan env bawaan.

## Sisa

- Bug kirim belum terbukti tertutup karena tidak dapat direproduksi; menunggu konfirmasi pengguna.
- Hentikan salah satu dari dua server PHP di :8000.
- Branch berita perlu `php artisan migrate` di database lokal sebelum fitur berita baru dipakai.
