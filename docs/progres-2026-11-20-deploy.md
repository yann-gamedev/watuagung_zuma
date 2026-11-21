# Progres 20 November 2026 — deploy main ke Hostinger (desawatuagung.com)

## Lingkup

- Deploy `main` @ `7433fd6` (lampiran persyaratan, enkripsi field bebas, unduh surat online + layar O2 #87, pengaman deploy) dari `110320a`. Server masih berisi **data fiktif**; bukan go-live warga.

## Dikerjakan

- Frontend dibangun di laptop dari worktree `origin/main` (API `https://desawatuagung.com/api/v1`, demo/sampel mati); lint dan `tsc` lulus. `npm ci` **gagal**: `package-lock.json` di `main` tidak sinkron (entri `@emnapi/*` hilang), sehingga build memakai `npm install` di worktree sementara (lockfile tidak di-commit).
- Akses: plugin Hostinger (akun `u892368764`) + kunci SSH baru `~/.ssh/watuagung_hostinger` (ditambahkan pengguna di hPanel).
- Urutan server: `git fetch` → `artisan down` (kode lama) → backup manual `watuagung-20261120-050553.tar.gpg` (dekripsi diuji: `db.sql` + `storage.tar`) → unggah arsip (sha256 cocok) → `hostinger-deploy.sh main --frontend` dari salinan skrip `origin/main` di luar repo (`DEPLOY_DRAIN_SECONDS=60`).
- Cron tidak dijeda: deploy berjalan ±22.00 UTC, jauh dari jadwal 17.00–19.00 UTC.
- Cron baru via API: `10 17` `attachments:purge`, `15 17` `letters:expire-downloads` (total 5 cron).
- PHP tidak diubah: hPanel sudah `upload_max_filesize`/`post_max_size`/`memory_limit` = 1536M (pilihan hanya 1024M/1536M). Angka 12M hanya ada di dokumen VPS lama.
- Arsip dan salinan skrip di server dihapus; lock deploy terlepas.

## Verifikasi yang dijalankan

- Migration: 3 baru `DONE` (attachments, encrypt free text, `ready_at`), 0 pending.
- Smoke test di server dan dari laptop: 33/33 lulus. `/.env`, `/.htaccess`, `/laravel.php`, `/storage/`, `/storage/x.php` 403; HTTP → 301.
- `POST /api/v1/applications/letter` dan `/attachments` tanpa isi → 422 (rute baru aktif).
- `/pelayanan/` yang tayang identik (sha256) dengan arsip build.
- Server: 3 permohonan terbaca setelah migration enkripsi (0 galat); `letters:expire-downloads --dry-run` dan `attachments:purge --dry-run` berjalan (0 data).
- **Belum diuji:** alur pengajuan dengan lampiran, unggah scan, dan unduh surat di browser (390px/1440px).

## Sisa pekerjaan / keputusan

- Uji browser end-to-end dengan data fiktif: ajukan dengan 3 lampiran → proses → unggah scan → unduh dari cek status.
- Perbaiki `package-lock.json` di branch tersendiri agar `npm ci` lulus.
- Hapus kunci SSH `watuagung-deploy` dari hPanel bila akses dari laptop ini tidak ingin dipertahankan.
- Dokumen: `deploy/hostinger.md` § C menyebut 20M; di Hostinger nilai efektif 1536M (cukup).
