# O2 — Layar surat online dan bantuan petugas

Sesi 19–20 November 2026, branch `feat/online-letter-ui`. Permintaan terbaru disetujui menggantikan arahan pengambilan fisik di dokumen lama. Pesan 1–2 hari kerja hanya untuk mengecek kembali setelah Disetujui, bukan SLA seluruh pelayanan.

## Perubahan

- `components/site.tsx`, `lib/letter-workflow.ts`: Disetujui menjelaskan tanda tangan Kepala Desa; Siap diunduh memakai tanggal server; Selesai menjelaskan unduhan. Kasus masa unduh habis ditampilkan terpisah.
- `services/pelayanan.ts`, `features/pelayanan/status-checker.tsx`: parsing ketersediaan/tenggat; POST nomor dan kode akses pada body; PDF blob dan object URL sementara; unduhan pertama memuat ulang status, unduh ulang tetap tersedia; pesan A4/QR, kegagalan, dan masa unduh habis. Tidak menyimpan kode akses di URL unduhan atau WhatsApp.
- `components/hubungi-petugas.tsx`: `useContact()`, nama, jam, nomor WhatsApp tervalidasi, pesan bantuan tetap, nomor pengajuan opsional; tanpa nomor tampil alamat kantor. Dipasang pada pelayanan, detail layanan, sukses, cek status, dan pengajuan gagal.
- Halaman pelayanan/beranda, katalog, formulir, privasi: alur unduh mandiri, empat langkah pelayanan, tiga label Scan, masa unduh 30 hari dan kerahasiaan kode. Semua istilah lama untuk scan diganti, termasuk arsip dokumentasi (makna historis tidak diubah).
- Panel: sidebar/dashboard/filter Siap diunduh; transisi manual READY_FOR_PICKUP/COMPLETED disembunyikan. Kartu Surat bertanda tangan menjelaskan cetak/tanda tangan/unggah PDF ≤5 MB, validasi signature dan ukuran, refresh detail/riwayat setelah unggah; kegagalan refresh mengunci mutasi sampai dimuat ulang.
- Perluasan API kecil atas izin pengguna: `LetterController::summary()` dan `LetterFile` menambah `download_count` serta `last_downloaded_at`. Agregat audit hanya unduhan warga (`user_id IS NULL`) untuk application terkait; unduhan kantor dikecualikan. Tidak ada endpoint, migration, atau dependensi baru. Kontrak di `docs/integrasi.md`, regresi di `CitizenLetterDownloadTest`.
- Demo: PDF fiktif berlabel SIMULASI; nomor contoh siap unduh menjadi Selesai setelah klik unduh, unduh ulang boleh. PDF dan perubahan contoh hanya di memori, bukan identitas atau file di penyimpanan browser. `scripts/test-demo.mjs` mencakup transport dan kegagalan unduhan.

## Verifikasi yang dijalankan

- `npm run lint`: lulus, tanpa warning pada pemeriksaan akhir.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus.
- `npm run build:demo`: lulus.
- `npm run test:demo`: lulus; mencakup POST/blob, kode hanya pada body, PDF demo pertama/ulang, metadata tenggat, HTTP 404/410/429/500, serta regresi lampiran/berita/UMKM.
- `php artisan test --compact`: 472 tes, 24.809 assertions lulus pada SQLite pengujian in-memory.
- Tes backend terarah: 15 tes / 235 assertions (`CitizenLetterDownloadTest`); gabungan surat/detail 70 tes / 956 assertions lulus.
- `scripts/test-online-letter-browser.mjs`: lulus melalui Chrome/CDP dengan Laravel sungguhan dan Next mode API, bukan respons tiruan. Ajukan DOMISILI dengan tiga scan gambar fiktif, petugas verifikasi/proses/ajukan, Kepala Desa setuju, petugas unggah PDF fiktif, cek status menampilkan unduh, unduhan pertama Selesai, unduh ulang identik, agregat jumlah 1 lalu 2 dan waktu terakhir terisi.
- Screenshot cek status dan detail panel pada 390px/1440px diperiksa; tanpa overflow halaman. Berkas di `C:/Users/Christian/AppData/Local/Temp/opencode/online-letter-eqbFk7/`; contoh pengajuan `REQ-2026-01M7TNVAE7C2DKXX9Z55QZKSG0` seluruh identitas fiktif. Bukti tidak memuat kode akses/token pada URL atau metadata jaringan yang disimpan.
- Pencarian repo untuk istilah scan lama yang dilarang pengguna: 0 kecocokan.

## Lingkungan dan batas

- Percobaan pertama sebelum sesi tersambung terhenti karena database kerja belum menerapkan migration 18/19 November. Tidak memigrasikan/reset database kerja. Verifikasi akhir memakai SQLite baru `C:/Users/Christian/AppData/Local/Temp/opencode/online-letter-o2.sqlite`, migration lengkap, akun fiktif dan token sementara; `.env` tidak diubah.
- Beberapa percobaan cepat menemui HTTP 429 karena throttle IP Laravel tanpa prefix dibagi beberapa route tulis. Skrip menghormati jendela satu menit sebelum cek status; tidak mengubah atau mematikan rate limit. Satu percobaan persetujuan PDF melewati timeout 20 detik; UI tetap menampilkan kegagalan yang benar dan refresh menemukan status tersimpan. Alur akhir lulus dua kali setelah penyesuaian skrip.
- Chrome headless dapat menimpa nama file unduh yang sama; skrip memeriksa byte tiap transfer lalu menghapus hanya file hasil uji di direktori download sementara, bukan menghitung nama file unik.
- Tidak menguji deployment produksi, database non-SQLite sesi ini, pemindaian QR dengan kamera nyata, atau WhatsApp eksternal. Nomor resmi mengikuti konten kontak yang ada; tidak mengarang nomor.
- Laravel Boost tidak diinstal karena dependensi baru tidak diizinkan. Perubahan lokal pengguna di catatan footer/video, `assets/`, dan dokumen tak terlacak tidak dimasukkan commit.
