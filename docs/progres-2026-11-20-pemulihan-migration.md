# Pemulihan migration lokal — 20 November 2026

## Penyebab dan lingkup

Database SQLite lokal masih memiliki migration enkripsi teks tambahan (18 November) dan `letters.ready_at` (19 November) berstatus Pending. Kode baru sudah membaca dan menulis ciphertext, sementara data lama masih plaintext. Pemeriksaan read-only menemukan campuran valid; tidak ditemukan payload terenkripsi yang gagal dibaca dengan APP_KEY aktif. Migration sengaja menolak campuran, bukan melakukan enkripsi ganda.

Pengguna menyetujui pemulihan aman database lokal. Tidak mengubah kode aplikasi/migration, dependensi, kontrak API, atau konfigurasi .env. Laravel Boost tidak dipasang karena aturan proyek melarang dependensi baru tanpa persetujuan. PHP 8.3.36 dan Composer 2.8.12 tersedia.

## Prosedur yang dijalankan

1. Aktifkan maintenance HTTP; pemeriksaan proses tidak menemukan queue worker atau scheduler PHP aktif.
2. Buat snapshot SQLite konsisten dengan VACUUM INTO, salin storage/app, .env dan APP_KEY aktif ke direktori pemulihan privat di luar repo dengan ACL terbatas. Backup mengandung data sensitif; tidak dimasukkan Git atau PR.
3. Uji skrip pemulihan sekali pakai pada salinan SQLite. Validasi seluruh nilai sebelum penulisan; payload terenkripsi tak terbaca membatalkan transaksi. Enkripsi hanya plaintext pada kolom migration, pertahankan ciphertext yang sudah valid.
4. Jalankan kedua migration pada salinan; bandingkan seluruh nilai dan jumlah baris tabel asli terhadap snapshot (nilai teks dibandingkan setelah dekripsi). Uji pembacaan detail terotorisasi, rollback audit uji.
5. Setelah uji lulus, pastikan database kerja belum berubah sejak snapshot; terapkan prosedur sama pada database lokal. Pengulangan pemulihan tidak mengubah nilai lagi.
6. Periksa migration, integritas, foreign key, dekripsi dan detail; buka maintenance kembali.

## Hasil verifikasi

- 19 nilai plaintext diperbarui; ciphertext valid dipertahankan. Pengulangan pemulihan: 0 perubahan.
- Seluruh nilai asli dan jumlah baris pada 20 tabel / 241 baris tetap utuh (tabel bookkeeping migrations dikecualikan dari perbandingan karena dua migration baru memang dicatat).
- SQLite integrity_check dan foreign_key_check lulus.
- Detail 9 pengajuan berhasil diserialisasi melalui controller terotorisasi; audit pemeriksaan di-rollback agar riwayat asli tetap utuh. Isi pemohon tidak dicetak atau disimpan dalam laporan.
- Kedua migration berstatus Ran. Kolom terkait tidak lagi memiliki plaintext atau payload tak terbaca.
- .env identik byte dengan backup; APP_KEY tidak diganti.
- php artisan test --compact: 472 tes / 24.809 assertions lulus pada database pengujian, bukan database kerja.
- Maintenance dinonaktifkan; GET http://127.0.0.1:8000/up mengembalikan HTTP 200.
- Tidak menjalankan ulang lint/build/frontend atau pemeriksaan visual; tidak ada kode/tampilan yang berubah. Pengujian HTTP detail melalui browser pengguna belum dilakukan; pemeriksaan controller bukan E2E browser.

## Risiko deploy yang masih perlu ditangani

Panduan backend sudah mensyaratkan backup, APP_KEY tetap, maintenance, penghentian worker/scheduler, migration sebelum layanan dibuka. Namun `deploy/hostinger-deploy.sh` saat diperiksa langsung checkout kode, composer install, lalu migrate tanpa mengaktifkan maintenance sebelum pergantian kode. Urutan itu berisiko menerima penulisan kode baru pada schema/data lama.

Jangan menganggap pemulihan SQLite membuktikan deployment Hostinger/MySQL aman. Jangan menjalankan skrip pemulihan lokal ini di produksi; gunakan backup dan rehearsal database target dengan prosedur yang ditinjau. Tidak ada push, deploy, atau perubahan database produksi pada sesi ini.

## Tindak lanjut pengaman deploy (disetujui pengguna)

Branch `fix/hostinger-deploy-safety`, tanpa dependensi baru atau perubahan aplikasi/UI:

- `deploy/hostinger-deploy.sh`: konfirmasi backup dan penulis dijeda, lock direktori atomik untuk menolak deploy bersamaan, maintenance sebelum checkout/Composer, jeda request bawaan 120 detik, migration/cache/file sebelum layanan dibuka. Kegagalan setelah maintenance mencoba mempertahankan/mengaktifkan ulang maintenance, termasuk kegagalan smoke test; tidak rollback data secara otomatis. Trap EXIT/INT/TERM/HUP membersihkan file sementara dan lock milik proses.
- `deploy/test-scripts.sh`: stub menguji penolakan konfirmasi/lock, urutan sukses backend dan frontend, kegagalan down/checkout/Composer/validasi/migration/cache/file/up/smoke serta rsync. Tidak menyentuh server atau database nyata.
- `deploy/hostinger.md`: operator wajib menutup HTTP dan menunggu request/CLI selesai **sebelum** backup database + storage agar snapshot konsisten; simpan APP_KEY terpisah, verifikasi backup, gunakan skrip baru, aktifkan cron kembali setelah pemeriksaan pascadeploy. Ini juga menutup temuan review bahwa backup sebelum maintenance dapat kehilangan konsistensi DB/file.
- SHA-256 yang tampil di panel berasal dari hash isi PDF, bukan kunci enkripsi atau kode akses; tampilan tidak diubah.

Verifikasi: `bash -n` kedua skrip lulus; `bash deploy/test-scripts.sh` melalui Git Bash lulus (smoke, backup PostgreSQL/MySQL, validasi dan alur/fault deploy); `git diff --check` lulus. Review read-only tidak menemukan penghambat lain pada trap/urutan; temuan backup diatasi dalam panduan sebelum selesai. Lint/build/frontend/backend suite tidak diulang untuk perubahan shell/dokumentasi ini; suite backend 472 tes di atas dijalankan pada sesi pemulihan.

Batas: konfirmasi operator bukan deteksi backup/cron otomatis; drain berbasis waktu tidak membuktikan request sudah habis; deploy in-place bukan atomik dan smoke memerlukan jendela layanan terbuka singkat. SIGKILL/listrik mati dapat meninggalkan lock. Bila kode/vendor rusak sehingga artisan tidak dapat berjalan, perlu blokir HTTP di hPanel. LiteSpeed/opcache, sinyal proses, dan server Hostinger/MySQL nyata belum diuji. Tidak menjamin seluruh migration/rilis bebas error. Perubahan lokal pengguna tetap dipertahankan; commit/push/PR tindak lanjut diizinkan pengguna setelah verifikasi. Deployment produksi tetap tidak dijalankan.
