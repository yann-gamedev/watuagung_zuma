# Progres 20 November 2026 — E1 notifikasi email pemohon (API)

## Lingkup

- Branch `feat/email-applicant-notifications` dari `origin/main` @ `3b32590`. Backend + kontrak/dokumen; formulir dan halaman berhenti (E2) tidak diubah. Rancangan `docs/PROMPTS-EMAIL.md` di-commit lebih dulu (`abdde4d`).
- Disetujui Tech Lead di sesi: worker Hostinger lewat **cron langsung** (bukan `schedule:run`, karena `proc_open` dimatikan); PRODUCT.md/ROADMAP.md lokal diperbarui.
- Berbeda dari teks rencana mengikuti kode: tombol Cek status ke `/pelayanan/status/?id=` (path `/cek-status/` tidak ada).

## Berkas

- Migration `2026_11_20_000000_add_email_notifications_to_applications`: `email` (text, cast `encrypted`, `$hidden`), `email_consent_at`, `email_unsubscribed_at`.
- `LetterSubmission`: `email` opsional `email:rfc` maks 120; `email_consent` wajib diterima hanya bila email diisi (aturan `accepted` implisit, jadi dipasang kondisional).
- `App\Domain\ApplicationStatusChanged` (after commit; payload hanya ID/status) dikirim di `StaffController::update`, `LetterController::upload`, `ApplicationController::letter`, `letters:expire-downloads`.
- `App\Listeners\SendApplicantStatusEmail` (antrean, 3 percobaan, `shouldQueue` menyaring), `App\Mail\ApplicantStatusMail` + `resources/views/mail/applicant-status.blade.php`, `App\Support\ApplicantEmail`, `ApplicationStatus::citizenLabel()`.
- `POST /v1/applications/unsubscribe` (tanda tangan relatif tanpa kedaluwarsa; email dikosongkan; audit).
- `routes/console.php`: jadwal `queue:work --stop-when-empty --max-time=50 --tries=3` tiap menit; `applications:purge` mengosongkan email.
- `config/app.php` `site_url` (`SITE_URL`), `.env.example`, `.env.production.example` (`QUEUE_CONNECTION=database`, `MAIL_*` Hostinger).
- `types/pelayanan.ts` (`Submission.email`, `email_consent`, `EmailUnsubscribeResponse`), `docs/integrasi.md`, `backend/README.md`, `deploy/hostinger.md` (kotak surat, SPF/DKIM/DMARC, batas kirim, cron antrean, § C batas unggah 1536M).
- Tes `ApplicantStatusEmailTest` (13 tes).

## Sumber nilai SMTP/batas

- Host `smtp.hostinger.com`, port 465 SSL/TLS (cadangan 587 STARTTLS): https://docs.hostinger.com/emails/setup-devices
- Batas kirim Business Starter 1.000/hari, Premium 3.000/hari per kotak surat: https://www.hostinger.com/support/4625828-parameters-and-limits-of-hostinger-email/

## Verifikasi yang dijalankan

- `php artisan test` SQLite: 491 tes / 25.088 assertions lulus. MariaDB 11.4.8 lokal: 491 / 25.090 lulus; rollback 1 langkah + migrate ulang migration baru lulus (`APP_KEY` acak sementara via env).
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo` lulus.
- Tidak ada uji kirim SMTP sungguhan dan tidak ada uji browser.

## Sisa pekerjaan / keputusan

- **SMTP produksi baru diaktifkan setelah E2** (tautan berhenti menuju `/berhenti-email/`).
- E2: kebijakan privasi — email opsional untuk pemberitahuan status, terenkripsi, dihapus saat berhenti berlangganan atau oleh retensi.
- Retensi `applications:purge` mati bawaan; email tersimpan sampai retensi aktif atau warga berhenti.
- Pengajuan baru (SUBMITTED) tidak mengirim email (bukan perubahan status).
- E3 (persetujuan kades lewat email) menyusul di `feat/email-head-approval`, bercabang dari branch ini.
