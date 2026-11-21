# Progres 21 November 2026 — pemeriksaan pra-rilis dan konsistensi MEDIA_URL

Branch `chore/preflight-check` dari `main` @ `2f83c4f`. Aturan rilis (fitur dibekukan untuk deploy 22 November 2026): tanpa perubahan tampilan, teks warga, alur, kontrak API, skema database, atau dependensi.

## Lingkup

1. Perintah baru `php artisan app:preflight {--production}` (`backend/app/Console/Commands/AppPreflight.php`). Hanya membaca, tanpa menulis apa pun. Setiap cek mencetak OK / PERINGATAN / GAGAL dalam bahasa Indonesia, lalu ringkasan; exit 1 bila ada GAGAL. `APP_KEY` dan kata sandi database/SMTP hanya ditulis "terisi"/"kosong"; URL dicetak tanpa `user:password@`, dan galat koneksi database hanya mencetak kodenya.
   - Dengan `--production` semua cek di spesifikasi tugas diterapkan. Tanpa flag, aturan khusus produksi (lingkungan, URL, batas unggah, antrean) turun menjadi PERINGATAN; `APP_KEY` kosong, database, migration, folder, GD, dan admin tetap GAGAL.
   - Tambahan kecil: PERINGATAN bila tidak ada kepala desa aktif, dan bila `MAIL_MAILER=smtp` tetapi kata sandi SMTP kosong.
   - Batas `upload_max_filesize`/`post_max_size` dibaca dari PHP CLI; tes menyuntikkan nilai lewat binding container `preflight.ini` karena nilai PERDIR tidak dapat diubah saat runtime.
   - Cek jadwal membaca event `Schedule` dari `routes/console.php` (tanpa jaringan, tanpa `schedule:list`). Di Hostinger cron dipasang manual, jadi cek ini tidak membuktikan cron hPanel terpasang.
2. MEDIA_URL: satu bentuk produksi, yaitu **`MEDIA_URL` kosong → `${APP_URL}/storage`** lewat symlink `public_html/storage` (Hostinger) atau alias Nginx `/storage/` (VPS). Sebelumnya `docs/integrasi.md` dan `backend/README.md` masih menyebut `/media` (sisa rencana sebelum keputusan 9 November). `.htaccess`, `watuagung.conf`, dan `.env.production.example` hanya mendapat komentar. Path di database tidak berubah.
3. Tes `backend/tests/Feature/AppPreflightTest.php` (11 tes): konfigurasi aman exit 0; debug true, URL localhost/http, placeholder, host berbeda, MEDIA_URL beda host, migration tertunda, batas unggah rendah + tanpa admin → exit 1; PERINGATAN tidak menggagalkan; tanpa `--production` hanya PERINGATAN; output tanpa `APP_KEY`/kata sandi DB/SMTP.
4. `deploy/hostinger.md`: bagian baru "Pemeriksaan pra-rilis", langkah di § G (setelah `.env` dan setelah migration), § I (sebelum dan sesudah skrip deploy), § J, § M, dan daftar periksa. `deploy/README.md`: langkah persiapan dan pemeriksaan setelah deploy. Tabel § M kini juga mencantumkan `SITE_URL`; tanpanya preflight akan GAGAL karena beda host.

## File

| File | Alasan |
|---|---|
| `backend/app/Console/Commands/AppPreflight.php` | perintah baru |
| `backend/tests/Feature/AppPreflightTest.php` | tes baru |
| `docs/integrasi.md`, `backend/README.md` | URL media produksi `/storage`, bukan `/media`; preflight di § Sebelum produksi |
| `backend/.env.production.example`, `deploy/hostinger/.htaccess`, `deploy/nginx/watuagung.conf` | komentar: MEDIA_URL kosong |
| `deploy/hostinger.md`, `deploy/README.md` | kapan menjalankan preflight; jangan buka situs bila ada GAGAL |

## Verifikasi yang dijalankan

| Perintah | Hasil |
|---|---|
| `php artisan test --filter=AppPreflightTest` | 11 lulus, 40 assertions |
| `php artisan test` (SQLite) | 558 lulus, 25.582 assertions |
| `php artisan test --env=testing.mysql` (MariaDB lokal, setelah `migrate:fresh`) | 558 lulus, 25.584 assertions; versi server tidak dicek ulang di sesi ini |
| PostgreSQL | tidak dijalankan: service `postgresql-x64-18` lokal berhenti |
| `npm run lint` | 0 error, 1 warning lama (`app/components/LembagaList.tsx` `<img>`) |
| `npx tsc --noEmit` | lulus |
| `npm run build` / `npm run build:demo` | lulus |
| `npm run test:demo` / `npm run test:no-sample` | PASS |
| `php artisan app:preflight` (tanpa flag, `.env` lokal) | 17 OK, 11 PERINGATAN, 0 GAGAL, exit 0; hanya membaca jumlah baris di SQLite lokal |

Tidak dijalankan di server Hostinger; belum ada bukti hasil `--production` pada `.env` produksi.

## Sisa dan keputusan

- Rencana `docs/PROMPTS-ADMIN-SUBDOMAIN.md` (panel di `panel.<domain>`) akan menambah origin beda host di `FRONTEND_ORIGINS`; aturan "host sama" di preflight harus disesuaikan bila rencana itu diambil.
- `media:prune` belum ada di tabel cron Hostinger § H (catatan lama di sana); preflight hanya memeriksa `routes/console.php`.
- `hostinger-deploy.sh` belum memanggil preflight otomatis; saat ini langkah manual operator.
