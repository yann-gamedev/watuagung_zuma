# Progres 21 November 2026 — deploy mode S (panel di admin.desawatuagung.com)

Dijalankan agent lewat SSH berbasis kunci atas izin eksplisit pengguna (kata sandi tidak dipakai). Detail akses server sengaja tidak dicatat di repo. Data server masih fiktif.

## Rilis

- Dari `main` @ `367b173` ke `main` @ `a6a363e`. Ikut terpasang: 20 commit sejak deploy 21 November pagi, yaitu rilis surat QR V2, foto berita tambahan, hak cipta KIM/tautan sosmed, izin keramaian, SEO, preflight, deploy subdomain (#111), tautan lintas origin (#112), dan perbaikan pengaman arsip (#113).
- 3 migration: `2026_11_21_000000_add_qr_letter_validity`, `2026_11_21_000000_create_post_images_table`, `2026_11_22_000000_add_copyright_and_social_links_to_posts`; semuanya `Ran`.
- Arsip frontend dibangun di laptop dari `6fc8c8d` (beda dengan `a6a363e` hanya di `deploy/`). Env: `NEXT_PUBLIC_API_URL=https://desawatuagung.com/api/v1`, `NEXT_PUBLIC_SITE_URL=https://desawatuagung.com`, `NEXT_PUBLIC_ADMIN_URL=https://admin.desawatuagung.com`, `DEMO_MODE=false`, `SHOW_SAMPLE_CONTENT=false`, URL pengaduan dan verifikasi Google kosong (sama dengan situs live). SHA-256 lokal dan server cocok (`c5096e02…`).
- `.env` server: `FRONTEND_ORIGINS` diisi pengguna (dua origin). `LETTER_DOWNLOAD_DAYS`/`LETTER_VALIDITY_DAYS` tidak ada di `.env`; config memakai bawaan 7, dan preflight mengonfirmasi nilainya.

## Urutan

1. Pemeriksaan baca-saja: HEAD server, repo bersih, alat tersedia, kunci `.env` non-rahasia, cron (lewat API Hostinger), backup terakhir.
2. Waktu 16.10 UTC (23.10 WIB): di luar jam layanan, 50 menit sebelum cron harian 17.00 UTC. Cron tidak bisa dijeda lewat API paket ini. Cron antrean tiap menit tidak menulis data karena `QUEUE_CONNECTION=sync`.
3. Backup manual: `watuagung-20261121-231011.tar.gpg` (2,6 MB), lulus uji dekripsi skrip.
4. `hostinger-deploy.sh` dan `hostinger-sync.sh` diambil dari `origin/main` ke `~/deploy-next` tanpa mengganti kode yang berjalan.
5. Deploy mode S (`ADMIN_PUBLIC_HTML=…/public_html/panel-admin`, `ADMIN_ORIGIN=https://admin.desawatuagung.com`) lewat `nohup`, log `~/deploy-20261121-mode-s.log`: composer, migration, cache, pemasangan subdomain lalu situs utama.
6. **Smoke test: 55 lulus, 1 gagal.** Pemeriksaan "tanpa CSP penegak ganda" memakai process substitution `< <(...)`, padahal shell SSH Hostinger tidak punya `/dev/fd`. Skrip menyalakan maintenance kembali sesuai desain.
7. Diperiksa manual: header panel hanya satu `Content-Security-Policy-Report-Only`, tanpa CSP penegak; migration `Ran`; `panel-admin` berisi panel; `public_html/admin` terhapus (D7). Lalu `php artisan up`. API dalam maintenance kira-kira 5 menit.
8. `php artisan app:preflight --production`: 29 OK, 1 PERINGATAN, 1 GAGAL (lihat Sisa).
9. Smoke test versi perbaikan dari laptop ke produksi: **56 lulus, 0 gagal**.

## Sisa dan keputusan

- **GAGAL preflight `QUEUE_CONNECTION=sync`** (kondisi sebelum deploy): email dikirim langsung saat permintaan, bukan lewat antrean. Cron `queue:work` tiap menit sudah terpasang. Pindah ke `database` cukup mengubah `.env` lalu `config:cache`, menunggu keputusan pengguna.
- PERINGATAN: 1 kepala desa belum memverifikasi email/membuat PIN, sehingga persetujuan lewat email belum bisa dipakai.
- Cron `media:prune` belum ada di hPanel (dicatat sejak sebelumnya).
- Uji manual browser (login semua peran, alur fiktif penuh, unggah foto, `sessionStorage` hanya di origin panel) belum dilakukan.
- File sementara di server: `~/deploy-next/`, `~/watuagung-web.tar.gz`, log deploy. Boleh dihapus setelah uji manual.
- Bug smoke test diperbaiki di branch `fix/smoke-no-dev-fd` (here-string + tes regresi yang menolak process substitution di skrip server).
