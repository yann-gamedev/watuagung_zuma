# Progres 16–17 November 2026 — Lampiran wajib terenkripsi (API)

## Lingkup

- Branch `feat/attachments-api` dari `main` @ `110320a`. Backend + kontrak/dokumen; tidak ada perubahan layar (L3/L4).
- Pengajuan surat online wajib melampirkan KTP, KK, dan Surat Pengantar RT/RW untuk keenam jenis yang ditawarkan. Daftar wajib hanya di `LetterType::requiredAttachments()`.
- `docs/PROMPTS-LAMPIRAN.md` yang disebut rencana **tidak ditemukan** di repo, working tree, maupun riwayat Git, sehingga tidak di-commit dan bagian "Prinsip dan Keputusan" tidak dapat dibaca. Pekerjaan mengikuti rencana tugas di chat.

## Berkas

- `backend/app/Domain/AttachmentKind.php` (baru): `KTP`, `KK`, `PENGANTAR_RT_RW` + `label()`.
- `backend/app/Domain/LetterType.php`: `requiredAttachments()`.
- `backend/database/migrations/2026_11_16_000000_create_application_attachments.php` (baru): kolom sesuai rencana, unique (`application_id`, `kind`), FK cascade.
- `backend/app/Support/AttachmentStore.php` (baru): validasi (finfo, 5 MB, foto sisi pendek ≥ 600/sisi panjang ≤ 6.000, PDF `%PDF-` + ≤ 10 halaman bila terhitung), encode ulang foto, `Crypt::encryptString` ke `attachments/{id}/{uuid}.bin`, `discard()`, `contents()`, `receivedKinds()`.
- `backend/app/Support/ImageProcessor.php`: logika encode dipisah ke `encode()` (dipakai lampiran); `store()` tetap berperilaku sama.
- `backend/app/Http/Controllers/Api/ApplicationController.php`: multipart, kesalahan isian + lampiran digabung dalam satu 422, satu transaksi, file dibersihkan bila gagal, `lampiran` di respons pengajuan dan cek status.
- Tes: `ApplicationAttachmentsTest` (baru, 24 tes); `tests/LetterPayloads.php` menambah `submitLetter()`/`letterAttachments()` dan memalsukan disk `local`; tes pengajuan lain memakai helper itu; tiga `assertExactJson` cek status menambah `lampiran: []`.
- `types/pelayanan.ts`: `attachmentKinds`, `AttachmentKind`, `attachmentKindLabels`, `SubmissionAttachments`, `Receipt.lampiran?`.
- `docs/integrasi.md` (§ Lampiran persyaratan, tabel kontrak), `backend/README.md` (§ Lampiran, endpoint, retensi), `deploy/hostinger.md` § C (20M).
- `PRODUCT.md` (keputusan [BARU] M6, cakupan 3 dokumen; daftar "Belum tersedia"), `ROADMAP.md` (M6). Keduanya terlacak Git meskipun CLAUDE.md menyebut sebaliknya.

## Keputusan teknis

- Hitung halaman PDF tanpa dependensi: objek `/Type /Page` dan `/Count` pohon halaman (ambil yang terbesar). PDF dengan object stream terkompresi tidak terhitung → batas dilewati, dicatat di `docs/integrasi.md`. PDF yang disimpan bertahap (incremental update) bisa terhitung lebih dari jumlah sebenarnya.
- PDF disimpan apa adanya (metadata dokumen tidak dibuang).
- `size_bytes` = ukuran isi yang disimpan sebelum enkripsi; `sha256` = isi asli yang diunggah.
- Batas atas 6.000 px untuk foto (sama dengan unggahan lain) mencegah GD kehabisan memori; tidak tertulis di rencana.
- `post_max_size` 12M **tidak** cukup untuk 3 × 4 MB (tepat 12 MiB + overhead multipart), berbeda dari asumsi rencana. `deploy/hostinger.md` § C diubah ke 20M.

## Verifikasi yang dijalankan

- `php artisan test` (SQLite): 435 tes / 7.003 assertions lulus.
- MariaDB 11.4.8 lokal (portabel di scratchpad sesi 13 November, port 3307, hanya 127.0.0.1, `APP_KEY` acak di environment proses): `migrate:fresh` lulus; `php artisan test --env=testing.mysql` 435 tes / 7.005 assertions lulus; `migrate:rollback` (batch terakhir = migration lampiran) dan `migrate` ulang lulus. Uji penomoran multiproses tidak diulang (tidak ada perubahan penomoran).
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo` lulus. Catatan: working tree saat build juga memuat perubahan `app/page.tsx` dan `app/globals.css` (foto balai desa) dari pekerjaan lain yang belum di-commit; perubahan itu tidak termasuk commit ini.
- Tidak ada uji browser atau HTTP manual; tidak ada perubahan layar.

## Sisa pekerjaan / keputusan

- **Formulir mode API rusak sampai L3:** frontend masih mengirim JSON tanpa lampiran → 422. Jangan deploy backend ini ke produksi sebelum L3, atau terima bahwa pengajuan online terhenti sementara. Mode demo tidak terpengaruh.
- **Retensi:** `applications:purge` belum menghapus lampiran (file KTP/KK tetap ada setelah anonimisasi). Wajib sebelum retensi dinyalakan untuk data nyata.
- Endpoint petugas untuk membuka/mengganti lampiran (`uploaded_by = staff`) dan audit aksesnya (L4).
- Hostinger: ubah `upload_max_filesize`/`post_max_size` ke 20M di hPanel; VPS: `client_max_body_size`.
- `docs/PROMPTS-LAMPIRAN.md` perlu disalin ke repo oleh Tech Lead bila ingin ikut di-commit.
