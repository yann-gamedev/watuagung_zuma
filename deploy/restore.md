# Pemulihan ke server kosong — dikerjakan manusia

Dipakai saat VPS hilang/rusak **dan** untuk uji pemulihan wajib (Fase 5, BLOKIR) sebelum go-live. Uji dilakukan di VM terpisah, bukan di server produksi.

Yang dibutuhkan, tiga hal terpisah:

1. Berkas backup `watuagung-YYYYMMDD-HHMMSS.tar.gpg` (dari `BACKUP_DIR` atau penyimpanan luar/rclone).
2. Passphrase backup (password manager desa).
3. `APP_KEY` produksi asli (password manager desa, terpisah dari backup).

**Jangan pernah menjalankan `php artisan key:generate` saat pemulihan.** Kunci baru membuat NIK, KK, telepon, alamat dan seluruh PDF surat di backup tidak bisa dibaca lagi, permanen.

## Langkah

1. **Server.** Siapkan VPS/VM baru sesuai [server-setup.md](server-setup.md) bagian 1–5 (paket, user, firewall, PostgreSQL kosong dengan user/database yang sama, PHP). Untuk uji pemulihan, jangan ubah DNS domain produksi.

2. **Kode.** Checkout tag rilis yang **sama** dengan saat backup dibuat (skema database harus cocok), lalu `composer install` seperti [first-deploy.md](first-deploy.md) langkah 2–3, termasuk izin direktori runtime. Lewati langkah 4–5 (key:generate, migrate, import, staff:create).

3. **`.env`.** Salin `backend/.env.production.example` ke `backend/.env`, isi domain dan kredensial database baru, lalu tempel `APP_KEY` asli lewat editor (bukan `echo`, agar tidak masuk history). Mode `640`, pemilik user deploy, grup PHP-FPM.

4. **Buka backup** di direktori sementara yang hanya bisa dibaca user deploy:

   ```bash
   umask 077
   mkdir ~/restore && cd ~/restore
   gpg --batch --pinentry-mode loopback --passphrase-file /etc/watuagung/backup-passphrase \
     --decrypt watuagung-YYYYMMDD-HHMMSS.tar.gpg | tar -xf -
   ls   # db.dump  storage.tar
   ```

   Passphrase ditaruh di `/etc/watuagung/backup-passphrase` (mode 600) seperti server-setup.md bagian 7, bukan diketik di argumen.

5. **Database.** Ke database kosong:

   ```bash
   pg_restore --no-owner --role=<DB_USER> -h localhost -U <DB_USER> -d watuagung --exit-on-error db.dump
   ```

   Bila database tujuan sudah berisi tabel, tambahkan `--clean --if-exists` (menghapus isi lama, pastikan servernya benar).

6. **File.** Media publik dan PDF surat terenkripsi:

   ```bash
   tar -C <APP_DIR>/backend/storage -xf storage.tar   # mengisi app/private dan app/public
   ```

   Ulangi perintah izin dari first-deploy.md langkah 3 (chown/chmod/setfacl) agar PHP-FPM bisa menulis dan Nginx membaca `app/public`.

7. **Cache dan frontend.** Jalankan `deploy.sh <tag yang sama>` (atau `--skip-frontend` setelah mengunggah `out/` produksi ke `WEB_ROOT`). Skrip menjalankan `migrate --force`; pada tag yang sama tidak ada migration baru.

8. **Nginx/HTTPS.** Server pengganti produksi: arahkan DNS, lalu server-setup.md bagian 6. VM uji: lihat "Akses VM uji" di bawah.

9. **Bersihkan** `~/restore` (`rm -rf ~/restore`): berisi dump database tidak terenkripsi.

## Uji wajib

Lakukan setelah langkah 1–8. Backup yang diuji harus berisi minimal satu permohonan **fiktif** (data rekaan, NIK bukan milik siapa pun) yang sudah memiliki PDF surat final. Sebelum go-live, buat lewat formulir dan proses sampai surat dibuat; setelah go-live gunakan permohonan uji yang sama, jangan membuka data warga asli untuk keperluan uji.

1. **NIK terbaca = `APP_KEY` benar.** Masuk panel admin, buka permohonan fiktif. NIK, KK, telepon, alamat tampil sesuai data rekaan. Galat 500 atau `The MAC is invalid` di `storage/logs` berarti `APP_KEY` salah: hentikan, ambil kunci yang benar, jangan membuat kunci baru.
2. **PDF surat terbaca.** Pada permohonan yang sama, unduh PDF surat; berkas terbuka dan QR mengarah ke `https://<domain>/verifikasi/?kode=...`. PDF disimpan terenkripsi dengan `APP_KEY`, jadi uji ini juga membuktikan `app/private` dan kunci cocok.
3. **Media publik.** Satu sampul berita, satu foto UMKM, bagan struktur dan satu PDF APBDes tampil dari `/storage/...` (bila ada di backup).
4. `bash deploy/smoke-test.sh <domain>` lulus.

Catat tanggal, nama berkas backup, tag rilis dan hasil empat uji di `docs/progres-YYYY-MM-DD.md` (tanpa data pribadi, tanpa kunci). Matikan dan hapus VM uji setelah selesai: berisi salinan database produksi.

## Akses VM uji

Frontend memanggil `https://<domain>/api/v1` (dibekukan saat build). Membuka VM lewat IP atau domain lain akan membuat browser memanggil **API produksi**. Karena itu:

1. Di VM, buat sertifikat sementara pada path yang dirujuk `watuagung.conf`:

   ```bash
   sudo mkdir -p /etc/letsencrypt/live/<domain>
   sudo openssl req -x509 -newkey rsa:2048 -nodes -days 7 -subj "/CN=<domain>" \
     -keyout /etc/letsencrypt/live/<domain>/privkey.pem -out /etc/letsencrypt/live/<domain>/fullchain.pem
   ```

2. Di laptop penguji, tambahkan `<IP_VM> <domain>` ke berkas hosts, lalu gunakan profil browser **baru** (cache HSTS profil lama menolak sertifikat sementara). Pastikan dengan `ping <domain>` bahwa domain mengarah ke VM.
3. Batasi `ufw` VM ke IP penguji (`sudo ufw allow from <IP_PENGUJI> to any port 443`), jangan buka untuk umum.
4. Setelah selesai, hapus baris hosts.
