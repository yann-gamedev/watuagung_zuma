# Progres 19 November 2026 — Siap diunduh otomatis dan unduhan surat oleh warga (API)

## Lingkup

- Branch `feat/online-letter-download` dari `origin/main` @ `d770ca5`. Backend + kontrak/dokumen; layar warga dan panel (O2) tidak diubah.
- `docs/PROMPTS-ALUR-ONLINE.md` yang disebut rencana **tidak ditemukan** di repo, working tree, maupun riwayat Git, sehingga tidak di-commit dan bagian "Alur baru"/"Keputusan" tidak dapat dibaca. Pekerjaan mengikuti rencana tugas di chat.

## Berkas

- Migration `2026_11_19_000000_add_ready_at_to_letters`: `letters.ready_at` nullable. Dipilih `letters`, bukan `applications`, karena terikat pada berkas surat (satu baris per permohonan bersama `path`, `source`, `file_updated_at`) dan bukan data pemohon. Data lama tidak diisi.
- `ApplicationStatus`: transisi manual `APPROVED → READY_FOR_PICKUP` dihapus; `canUploadLetter()`, `afterLetterUpload()`, `awaitsAction()` (APPROVED tetap di antrean kantor), `LETTER_UPLOAD_STATUSES`.
- `Application::scopeForMyQueue()` memakai `awaitsAction()`.
- `Letter`: `DOWNLOAD_STATUSES`, `downloadDays()`, `downloadUntil()`, `downloadState()`.
- `LetterController::upload()`: transaksi dengan baris permohonan terkunci; simpan scan, `ready_at`, APPROVED → READY_FOR_PICKUP + event, audit; respons menambah `status`; ringkasan `letter` menambah `ready_at`, `download_until`.
- `ApplicationController`: `letter()` untuk `POST /v1/applications/letter` (memakai `authenticate()` yang sama dengan cek status); cek status menambah `letter_available`, `letter_available_until`.
- `routes/api.php` (throttle 10/menit per IP, kunci `application-letter`), `routes/console.php` (`letters:expire-downloads` + jadwal; `applications:purge` melewati surat dalam masa unduh), `config/letters.php` (`download_days`).
- Tes: `CitizenLetterDownloadTest` (baru, 14 tes); helper `uploadScan()` di `tests/TestCase.php`; `StatusWorkflowTest`, `NeighborhoodApprovalTest`, `NeighborhoodApprovalDisabledTest`, `RetentionPurgeTest`, `LetterRegisterTest` disesuaikan (READY_FOR_PICKUP lewat unggah; dua field baru di cek status; `ready_at` lama untuk tes retensi).
- `types/pelayanan.ts`, `docs/integrasi.md` (§ Alur online), `backend/README.md`, `PRODUCT.md`, `deploy/hostinger.md` (cron 00.15 WIB), `.env.example`/`.env.production.example` (`LETTER_DOWNLOAD_DAYS=30`).

## Keputusan teknis

- Event status otomatis memakai `action` null (memang perubahan status), catatan terenkripsi sesuai pola sejak `e6ff398`; unggah ulang tidak membuat event status (audit `letter.uploaded` tetap). `catatan` dikosongkan pada transisi otomatis, sama dengan transisi manual tanpa catatan.
- Masa unduh: tersedia sampai tepat `ready_at` + N hari (inklusif); `letter_available_until` tetap dikirim setelah lewat agar layar dapat menjelaskan.
- Scan lama tanpa `ready_at` dan PDF otomatis sistem tidak dapat diunduh warga (404).
- `letters:expire-downloads` tidak menghapus berkas.
- Pesan 410 memakai "Masa unduh sudah berakhir. Silakan hubungi petugas di kantor desa." (kalimat rencana diperjelas).

## Verifikasi yang dijalankan

- `php artisan test` (SQLite): 471 tes / 24.781 assertions lulus.
- MariaDB 11.4.8 lokal (portabel, 127.0.0.1:3307, `APP_KEY` acak sementara): `migrate:fresh`, 471 tes / 24.783 assertions lulus; `migrate:rollback` (migration `ready_at`) dan `migrate` ulang lulus.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo` lulus.
- Tidak ada uji browser (tidak ada perubahan layar).

## Sisa pekerjaan / keputusan

- **O2 wajib sebelum deploy:** panel masih menawarkan alur lama. Setelah unggah scan, panel tidak memuat ulang status (respons dipakai hanya untuk `letter`); antrean "Siap diambil" dan label "Siap diambil"/"bawa KTP" perlu diganti; halaman cek status warga belum punya tombol unduh.
- Hostinger: pasang cron `letters:expire-downloads` (§ H).
- `docs/PROMPTS-ALUR-ONLINE.md` perlu disalin ke repo oleh Tech Lead bila ingin ikut di-commit.
- Permohonan lama yang sudah `READY_FOR_PICKUP` (surat fisik) tidak terpengaruh; petugas menyelesaikannya manual seperti biasa.
