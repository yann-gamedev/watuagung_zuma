# Progres 21 November 2026 — E4 halaman persetujuan email dan pengaturan notifikasi

## Lingkup

- Branch `feat/email-head-approval-ui` dari `main` @ `ee6f253` (E1–E3 sudah di main lewat #92, #93, #95). Frontend + konfigurasi header server; backend tidak diubah.
- Disetujui Tech Lead di sesi: menu "Notifikasi email" di menu **Akun** topbar (bukan sidebar); halaman `/verifikasi-email/` dikerjakan di E4 (dibutuhkan tautan verifikasi E3).

## Berkas

- `app/admin/notifikasi/page.tsx`, `features/admin/notification-settings.tsx` (+ `.module.css`): email notifikasi, status verifikasi, kirim ulang/hapus; PIN + kata sandi akun hanya untuk Kepala Desa.
- `app/persetujuan/page.tsx`, `features/approval/approval-page.tsx` (+ `approval.module.css`): halaman konfirmasi publik, noindex, no-referrer; token dibaca sekali lalu dihapus dari address bar.
- `app/verifikasi-email/page.tsx`, `features/approval/verify-email.tsx`: konfirmasi email lewat tombol.
- `services/approval.ts`: klien POST dengan status HTTP (410/422/423), Zod, `referrerPolicy: no-referrer`.
- `components/admin-sidebar.tsx` (akses + judul `/admin/notifikasi`), `features/admin/shell.tsx` (tautan di menu Akun), `features/admin/application-detail.tsx` (`via` di riwayat: "disetujui/ditolak melalui email").
- `deploy/hostinger/.htaccess`, `deploy/nginx/watuagung.conf`, `deploy/nginx/watuagung-headers.conf`: `Referrer-Policy: no-referrer` untuk `/persetujuan/`, `/verifikasi-email/`, `/berhenti-email/`.
- `scripts/test-approval.mjs` (`npm run test:approval`), `scripts/test-email-approval-browser.mjs` (E2E), `package.json`.
- `docs/integrasi.md` (§ Layar persetujuan dan pengaturan notifikasi), `deploy/hostinger.md` § J (cek header).

## Temuan selama uji

- React StrictMode (dev) menjalankan efek dua kali: efek kedua membaca URL yang sudah dikosongkan dan menampilkan "Tautan tidak lengkap". Diperbaiki dengan penanda baca-sekali (`useRef`) di kedua halaman.
- HTML hasil export memuat `<script>` sebelum `<meta name="referrer">`: chunk awal dikirim dengan Referer berisi token ke origin sendiri (83 permintaan di server dev). Permintaan ke API (lintas origin) tidak membawa token. Karena itu header server **wajib**; dicek setelah deploy (§ J).

## Verifikasi yang dijalankan

- `npm run lint` (0 masalah), `npx tsc --noEmit`, `npm run build` (API produksi), `npm run build:demo`, `npm run test:demo`, `npm run test:approval` lulus. `bash deploy/test-scripts.sh` lulus.
- E2E `scripts/test-email-approval-browser.mjs` lulus pada lingkungan terisolasi (Laravel `php -S` :8001 dari worktree, SQLite sementara, `MAIL_MAILER=log`, `QUEUE_CONNECTION=sync`, akun fiktif; Next dev :3001; Chrome headless): verifikasi email dari log (390px) → PIN lemah ditolak, PIN disimpan (1440px/390px) → staf ajukan ke Kepala Desa → tautan dari log dibuka 390px (token hilang dari URL, meta noindex/no-referrer, `inputmode=numeric`) → dialog "Yakin menyetujui?" (tombol ≥ 48px) → "Permohonan disetujui. Nomor surat: 470/1/424.314.2.02/2026" → tautan dibuka lagi → "Tautan sudah tidak berlaku" + tautan panel → riwayat panel "disetujui melalui email" → permohonan kedua 1440px `pilih=tolak`, alasan wajib, PIN salah ("Sisa 4 percobaan"), lalu ditolak. Tanpa scroll horizontal di setiap tangkapan layar; tangkapan layar ditinjau visual.
- `.env`, `database.sqlite`, dan server :8000 milik pengguna tidak disentuh. `php artisan test` tidak dijalankan ulang (tidak ada perubahan backend).

## Sisa pekerjaan / keputusan

- Setelah deploy: cek `curl -sI https://desawatuagung.com/persetujuan/ | grep -i referrer-policy` → `no-referrer` (LiteSpeed + `REDIRECT_` env belum diuji di server sungguhan).
- Aktivasi SMTP produksi dan cron antrean mengikuti `deploy/hostinger.md` § H Email notifikasi.
