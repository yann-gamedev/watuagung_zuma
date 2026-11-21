# Progres 21 November 2026 — deploy main (E1–E4) ke Hostinger

## Lingkup

- Deploy `main` @ `367b173` (dari `7433fd6`): notifikasi email pemohon (E1), kolom email di formulir + `/berhenti-email/` (E2), persetujuan Kepala Desa lewat email (E3), `/persetujuan/`, `/verifikasi-email/`, Akun → Notifikasi email (E4), perbaikan throttle login (#90), lockfile (#89). Data server masih fiktif.

## Dikerjakan

- Frontend dibangun di laptop dari worktree `origin/main` (API `https://desawatuagung.com/api/v1`); lint, tsc lulus; arsip 1,7 MB (sha256 `88778c22…` cocok setelah unggah).
- Server ±00.35 UTC (jauh dari cron 17.00–19.00 UTC, cron tidak dijeda): `artisan down` → backup manual `watuagung-20261121-073546.tar.gpg` (dekripsi diuji: `db.sql`, `storage.tar`) → `hostinger-deploy.sh main --frontend` dari salinan skrip `origin/main` di luar repo.
- Migration: `2026_11_20_000000_add_email_notifications_to_applications`, `2026_11_20_000001_add_email_approval`.
- `.env` produksi tidak diubah: `QUEUE_CONNECTION=sync`, `MAIL_MAILER=log` → email hanya ditulis ke log server, belum terkirim.
- Arsip dan salinan skrip di server dihapus; lock terlepas.

## Verifikasi yang dijalankan

- Smoke test di server dan dari laptop: 33/33 lulus. `/.env`, `/.htaccess`, `/laravel.php`, `/storage/` 403.
- `Referrer-Policy: no-referrer` aktif di LiteSpeed untuk `/persetujuan/`, `/verifikasi-email/`, `/berhenti-email/`; halaman lain tetap `strict-origin-when-cross-origin`.
- `POST /approvals/preview` tanpa token 422, token palsu 410 dengan pesan Indonesia; `/staff/me/notifications` tanpa login 401.
- Formulir `/pelayanan/domisili/` memuat "Email (opsional)"; `/persetujuan/` yang tayang identik dengan build.
- Server: 0 migration pending, 6 permohonan terbaca tanpa galat, status LIVE.
- Belum diuji di produksi: alur browser lengkap dengan email sungguhan (SMTP belum aktif).

## Sisa pekerjaan / keputusan

- Aktivasi email: kotak surat `notifikasi@desawatuagung.com`, SPF/DKIM/DMARC, `.env` SMTP + `QUEUE_CONNECTION=database`, cron antrean tiap menit (`deploy/hostinger.md` § H Email notifikasi).
- Kepala Desa mengatur email notifikasi dan PIN di panel setelah SMTP aktif.
