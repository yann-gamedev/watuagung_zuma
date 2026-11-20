# Progres 20 November 2026 — E3 persetujuan kepala desa lewat email (API)

## Lingkup

- Branch `feat/email-head-approval` dari `feat/email-applicant-notifications` @ `b757017` (E1, PR #92). Backend + kontrak/dokumen; halaman `/persetujuan/`, `/verifikasi-email/`, dan menu panel (E4) tidak dibuat.
- Rencana disetujui Tech Lead di sesi: hanya Setuju/Tolak lewat email (Perlu perbaikan tetap di panel); PIN lemah ditolak; email "Percobaan PIN gagal" tanpa IP.

## Berkas

- Migration `2026_11_20_000001_add_email_approval`: kolom `users` (notification_email terenkripsi, verified_at, approval_pin_hash, approval_pin_set_at), tabel `approval_links` (token_hash, expires_at, used_at, revoked_at, failed_pin_attempts, locked_at), `application_events.via`.
- `App\Domain\ApplicationTransition` + `TransitionRejected`: logika `StaffController::update` dipindah apa adanya; panel dan email memakai jalur yang sama. Respons panel tidak berubah (tes lama lulus).
- `App\Support\ApprovalLinks`, `App\Support\NotificationEmails`; listener `SendHeadApprovalLinks` (antrean, token dibuat di job), `RevokeApprovalLinks` (sinkron); job `SendNotificationEmailVerification`, `SendPinLockedEmail`; Mailable `HeadApprovalMail`, `PinLockedMail`, `NotificationEmailVerificationMail` + view.
- `NotificationSettingsController` (`GET/PUT /staff/me/notifications`, `PUT /staff/me/notifications/pin`, `POST /notifications/verify`), `ApprovalController` (`POST /approvals/preview|draft|decide`), limiter `approval-link`.
- Detail petugas: `history[].via`. `User::canApproveByEmail()`.
- `types/pelayanan.ts`, `docs/integrasi.md`, `backend/README.md`. PRODUCT.md/ROADMAP.md lokal diperbarui.
- Tes: `HeadEmailApprovalTest` (11), `NotificationSettingsTest` (6); `StaffApplicationsTest` menambah `via` pada riwayat.

## Berbeda dari teks rencana

- Verifikasi email di `POST /v1/notifications/verify` (publik, bertanda tangan 24 jam), bukan di bawah `/staff/me`, agar tautan bisa dibuka tanpa login di ponsel.
- Draf PDF di-stream lewat `POST /approvals/draft` dengan token di body, bukan "URL draf sementara", agar token tidak pernah ada di URL/log.
- Pilihan Setuju/Tolak di email memakai query `pilih=`, bukan kolom `decision_hint`.
- Kolom tambahan `revoked_at`, `failed_pin_attempts`, `locked_at` di `approval_links`.

## Verifikasi yang dijalankan

- `php artisan test` SQLite: 508 tes / 25.341 assertions lulus. MariaDB 11.4.8 lokal: 508 / 25.343 lulus; rollback + migrate ulang migration E3 lulus. (Satu percobaan MariaDB sebelumnya gagal 1205 lock wait karena proses tes dari sesi terputus berjalan bersamaan; diulang sendirian dan lulus.)
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo` lulus.
- Tidak ada uji kirim SMTP sungguhan dan tidak ada uji browser.

## Sisa pekerjaan / keputusan

- Merge setelah PR #92 (E1).
- E4: halaman `/persetujuan/` (noindex, Referrer-Policy no-referrer, hapus token dari address bar), `/verifikasi-email/`, menu Notifikasi email di panel, label riwayat "melalui email".
- Aktivasi email produksi tetap menunggu E2 (lihat `deploy/hostinger.md` § H Email notifikasi).
