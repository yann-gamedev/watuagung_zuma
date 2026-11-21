# Progres V2 — rilis surat QR (21 November 2026)

Branch: `feat/letters-qr-release`, dari `0ee1a58`. Acuan: `docs/PROMPTS-REVISI-SURAT2.md` § Keputusan dan V2. Perubahan V1 pada worktree asal tidak disertakan.

## Perubahan

- `ApplicationTransition` menjadi jalur bersama panel/email: persetujuan membuat PDF final terenkripsi, `source=system`, `ready_at`, `valid_until`, dan status `READY_FOR_PICKUP` dalam transaksi yang sama. Satu riwayat `WAITING_APPROVAL → READY_FOR_PICKUP`, catatan terenkripsi `Disetujui dan dirilis` ditambah catatan persetujuan bila ada, petugas dan `via=email` dipertahankan. E1 hanya untuk status akhir.
- Penyimpanan memakai path unik. Rollback membersihkan file baru, file lama baru dihapus setelah commit. Pemilik transaksi terluar memeriksa referensi lewat write PDO untuk menangani COMMIT gagal; bila referensi tidak dapat dipastikan, file dipertahankan dan galat dilaporkan agar tidak menghapus PDF yang sudah committed. Transaksi transisi tidak melakukan retry otomatis; deadlock membatalkan request, klien dapat mencoba ulang. Ini menghindari callback event sisa percobaan COMMIT gagal.
- Unduhan warga menerima `system`/`uploaded`. `LETTER_DOWNLOAD_DAYS=7` terpisah dari `LETTER_VALIDITY_DAYS=7`; batas berlaku tersimpan saat rilis. Batas tepat masih valid, lewat batas ditolak. Unduhan pertama/command expiry tetap menyelesaikan permohonan. Retensi melindungi kedua sumber selama masa unduh hidup; tidak ada penghapusan PDF otomatis hari ke-7.
- Endpoint Ganti PDF tetap staff/admin, hanya `READY_FOR_PICKUP`/`COMPLETED` selama validitas. Tidak mereset status, waktu rilis, batas berlaku/unduh, atau E1. Kegagalan audit mempertahankan file lama.
- Verifikasi mengirim nama lengkap, `valid_until`, dan `valid`/`expired`/`revoked`; pembatalan didahulukan. Throttle dan `no-store` tetap. QR adalah bearer publik, bukan TTE tersertifikasi.
- Migrasi menambah `system` dan `valid_until`; surat lama dengan `ready_at` mendapat `ready_at + 7 hari`, sumber `generated` lama tetap. Tidak merilis `APPROVED` lama atau membuat ulang PDF lama. Kebijakan unduh baru memendekkan jendela lama dari waktu rilis asli, bukan memberi tujuh hari baru sejak deploy.
- Template QR ±2,5 cm di tengah blok kanan; nama kepala desa tebal bergaris bawah, teks validitas dan Scan sesuai permintaan. Kolom tanda tangan pemohon tetap pada KEHILANGAN/BELUM_MENIKAH.
- Kontrak TypeScript/Zod, hasil persetujuan email, dan fixture skrip mengikuti API baru. Perubahan layar/teks V3 lainnya sengaja terpisah. `PRODUCT.md`, `docs/integrasi.md`, `backend/README.md`, dan `deploy/hostinger.md` diperbarui; env server tidak disentuh.

## Verifikasi

- `npm run lint`: lulus.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus, 61 halaman.
- `npm run build:demo`: lulus, 61 halaman setelah membersihkan output `.next` worktree. Percobaan awal gagal pada cache/font Turbopack; tidak mengubah font atau dependensi.
- `npm run test:demo`: lulus setelah fixture API menambah `valid_until`.
- `npm run test:approval`: lulus dengan respons akhir `READY_FOR_PICKUP`.
- `npm run test:no-sample`: tetap gagal bawaan sejak `main` lama karena chunk bundler memuat frasa komponen pratinjau `Artikel contoh` (tercatat di progres 2 November, 9 November, dan 20 November); tidak diubah/dilemahkan.
- Backend SQLite penuh (`php artisan test --compact`): 523 tes lulus, 25.552 assertions.
- Regresi transaksi atomik (`LetterReleaseTransactionTest`): 3 tes lulus, 33 assertions (rollback nested, root COMMIT melempar dan membersihkan file tanpa referensi serta callback transaksi sisa, exception afterCommit mempertahankan status/row/PDF committed).
- Uji PDF & inspeksi visual (`test_official_pdf_text_and_one_a4_page`): 30 tes lulus, 508 assertions; 6 PDF fiktif diekspor dan dirender ke PNG via PyMuPDF/Pillow; contact sheet mengonfirmasi masing-masing 1 halaman A4 pas, teks validitas 7 hari dan Scan sesuai permintaan, QR 2,5 cm di tengah blok tanda tangan kanan, serta ruang tanda tangan pemohon KEHILANGAN/BELUM_MENIKAH tetap utuh.
- Backend MariaDB lokal (`127.0.0.1:3307`, MariaDB 11.4.8):
  - `QrLetterValidityMigrationTest`: 1 tes lulus (12 assertions) mencakup migrasi up, backfill surat lama, dan rollback down.
  - Regresi transaksi & PDF (`LetterReleaseTransactionTest|LetterPdfTest`): 43 tes lulus, 541 assertions.
  - Uji konkurensi penomoran surat 30 proses PHP bersamaan (`backend/tests/Concurrency/letter-number-mysql.php`): 30 proses lulus, nomor urut 1..30 unik berurutan, counter 30, 30 transisi/event (10.97 detik).

## Batas

- Belum push/deploy; Laravel Boost tidak dipasang sesuai persetujuan, tidak ada dependensi baru.
- V3 masih diperlukan untuk label/tampilan alur warga, batas berlaku, panel Ganti PDF, dan privasi nama lengkap. Cek responsif 390px/1440px belum dilakukan dalam sesi V2 ini.
- Pengiriman SMTP tepat-sekali tidak dijamin baru; satu dispatch E1 akhir diuji, semantik retry queue lama tetap.
- Versi MariaDB produksi Hostinger dan penerimaan surat QR oleh instansi luar desa tetap perlu verifikasi operasional.
