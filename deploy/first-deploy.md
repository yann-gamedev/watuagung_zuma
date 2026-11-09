# Bootstrap pertama — dikerjakan manusia di VPS

Hanya untuk instalasi baru. Jangan jalankan langkah pembuatan kunci pada aplikasi yang sudah memiliki kunci/data. Ini persiapan setelah checkout dan instalasi berkas pertama, **sebelum** `deploy.sh` rutin atau akses publik. Jangan menunggu smoke test pertama berhasil baru membuat kunci.

1. Siapkan PostgreSQL 16+ lokal, database/user khusus, PHP CLI/FPM yang sama (8.3+ beserta ekstensi Composer, `pdo_pgsql`, GD JPEG/PNG/WebP), Composer, Git, curl, rsync dan Node **24.x** bila build di VPS. Nginx/HTTPS dan firewall disiapkan manusia. Jangan buka situs untuk warga dulu.
2. Checkout rilis di `<APP_DIR>` di luar document root. `WEB_ROOT` khusus hasil `out/`, terpisah dari repo. Dari root repo, jalankan `composer install --working-dir=backend --no-dev --optimize-autoloader --no-interaction`. Jangan salin `.env` lokal/laptop ke VPS. Jika belum ada `backend/.env`, salin `backend/.env.production.example` menjadi `backend/.env`, isi domain dan kredensial PostgreSQL di editor server. Lindungi `.env` dengan mode `640`, pemilik user deploy, grup PHP-FPM; jangan mencetak atau commit isinya. Jangan menimpa `.env` yang sudah ada.
3. Tetapkan izin direktori runtime sebelum Artisan. Ganti placeholder berikut dengan user/grup asli server (contoh ini bukan perintah siap tempel tanpa penggantian). User deploy perlu menjadi anggota grup PHP-FPM; login ulang setelah perubahan grup. Siapkan utilitas `setfacl` pada server; default ACL wajib agar file baru dari PHP-FPM/cron tetap dapat ditulis grup bersama meski umask proses `0022`. Jalankan Artisan dengan `umask 0002`. Jangan memakai `chmod 777` atau memberi PHP-FPM hak menulis seluruh repo.

   ```bash
   cd '<APP_DIR>/backend'
   sudo chown -R '<DEPLOY_USER>:<PHP_FPM_GROUP>' storage bootstrap/cache
   sudo find storage bootstrap/cache -type d -exec chmod 2770 {} +
   sudo find storage bootstrap/cache -type f -exec chmod 660 {} +
   sudo find storage bootstrap/cache -type d -exec setfacl -m d:u::rwx,d:g::rwx,d:m::rwx,d:o::--- {} +
   umask 0002
   ```

   User PHP-FPM dan user cron harus bisa membaca `.env` dan menulis direktori ini. User Nginx hanya perlu membaca media publik dan frontend; bila grup Nginx berbeda, atur ACL baca terbatas untuk `storage/app/public` beserta direktori induknya. Jangan beri akses ke `storage/app/private` atau log.

4. Dari `backend/`, hapus cache konfigurasi bawaan salinan, lalu **hanya bila `APP_KEY` kosong pada instalasi baru**, jalankan:

   ```bash
   php artisan config:clear
   php artisan key:generate --force
   ```

   `--force` hanya melewati konfirmasi lingkungan production; bukan izin mengganti kunci lama. **`APP_KEY` dibuat SEKALI. Simpan cadangannya segera di password manager/penyimpanan aman di luar server, terpisah dari backup database. JANGAN pernah dibuat ulang — data terenkripsi akan hilang.** Pada pemulihan gunakan kunci asli, bukan `key:generate`. Jangan gunakan `--show` atau menyalin kunci ke log/chat/Git.

5. Masih dari `backend/`, jalankan:

   ```bash
   php artisan migrate --force
   php artisan site:import-defaults
   php artisan staff:create '<USERNAME_ADMIN>' --role=admin --name='<NAMA_ADMIN>'
   ```

   Ganti placeholder admin. Kata sandi minimal 12 karakter diminta tersembunyi dua kali; jangan taruh di argumen shell. Impor hanya mengisi bagian situs yang belum ada; periksa konten impor melalui panel sebelum operasional. Jangan menjalankan seeder, `migrate:fresh`, atau `migrate:refresh` di produksi.

6. Siapkan `.env.production` frontend sesuai README; jalankan `deploy.sh <tag|branch>` untuk storage link, cache, frontend, reload FPM dan smoke test. Bila frontend dibangun di laptop, unggah **isi** `out/` ke `WEB_ROOT` terlebih dahulu, lalu gunakan `--skip-frontend`. Pasang cron dari `crontab.txt` sebagai user deploy. Pastikan versi PHP cron sama dengan FPM.
7. Periksa alur pengajuan fiktif, login admin, media publik, QR, backup/pemulihan dan header keamanan di VPS. Retensi kosong berarti penghapusan otomatis mati; desa wajib menetapkan kebijakan sebelum menerima data nyata. Smoke test bukan izin go-live dan bukan pengganti audit keamanan.
