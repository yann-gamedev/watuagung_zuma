# Enkripsi teks pemohon tambahan — 18 November 2026

Branch: `feat/encrypt-more-fields`, basis `6731f34` (main sesudah PR #84). Tidak mengubah frontend/kontrak API. Perubahan lokal tidak terkait tidak masuk commit.

## Cakupan

- `Application`: cast `encrypted` untuk tujuh field `keperluan`, `isi_keterangan`, `isi_keterangan_awal`, `barang_hilang`, `pekerjaan`, `pendidikan`, `catatan`. Kolom `isi_keterangan_asli` tidak ada; `isi_keterangan_awal` menyimpan teks asli warga.
- `StaffController`, `ApplicationController`, `LetterNumber`: seluruh pembaca/penulis salinan `application_events.note` dan `letter_numbers.void_reason` mengenkripsi/dekripsi string, termasuk note sistem sunting/ganti lampiran. Tanpa fallback plaintext pada runtime. Nilai tetap terbaca sesuai otorisasi pada detail/status/riwayat, PDF tidak berubah.
- Migration `2026_11_18_000000_encrypt_application_free_text`: pendidikan/pekerjaan varchar60 dan barang_hilang varchar200 menjadi nullable text, yang lain sudah text. ChunkById 500, query mentah agar tidak menggandakan cast, satu transaksi data ketiga tabel. `null` dipertahankan, string kosong dienkripsi. Retry seragam plaintext/ciphertext; campuran atau payload rusak/kunci salah ditolak. Down memeriksa panjang sebelum dekripsi, mendekripsi lalu memulihkan varchar semula. DDL SQLite memakai foreign-key-off hanya saat rebuild di luar transaksi data; MariaDB DDL tetap terpisah karena implicit commit.
- Tanggal/identitas pencarian tidak ditambah enkripsi: nama, request_id, jenis_surat, status, rt, rw, dusun, tanggal operasional. Tanggal lahir yang sebelumnya terenkripsi tetap terenkripsi.
- Tes baru dan fixture/assertion raw database lama disesuaikan agar memeriksa ciphertext/dekripsi, bukan meminta plaintext tersimpan.

## Audit query

Grep `where`, `whereRaw`, `orderBy`, `groupBy`, `having`, `selectRaw` pada `backend/app/` dan `backend/routes/`, lalu pemeriksaan pemakaian field: tidak ditemukan pencarian/filter/pengurutan/agregasi pada tujuh field baru, `note`, atau `void_reason`.

- `StaffController::index`: pencarian LOWER(request_id)/LOWER(nama); filter status/jenis; urutan created_at/id.
- Scope `Application`: jenis/status/rt/rw/created_at; ringkasan status, antrean wilayah.
- History mengurut events.created_at/id, bukan note. Nomor surat mengurut id/sequence, bukan void_reason.
- Retensi memfilter status/purged_at/updated_at; menulis/mengosongkan field melalui model sehingga cast tetap berlaku.

## Verifikasi

- `php artisan test` (SQLite in-memory): **459 tes / 24.586 assertions lulus**. Termasuk regresi PDF, detail, cek status, catatan, riwayat, nomor surat, lampiran, retensi dan otorisasi.
- Tes baru mencakup 503 baris per tabel, urutan up/up/down/down/up, nilai null/kosong/Unicode, kolom pencarian dan timestamp tidak berubah; campuran/kunci salah dan rollback terlalu panjang ditolak tanpa perubahan data parsial.
- `php artisan test --env=testing.mysql` (MariaDB 11.4.8 lokal, serial): **459 tes / 24.588 assertions lulus**, termasuk migration up/up/down/down/up pada 503 baris per tabel serta regresi PDF/detail/status/riwayat. Bukan verifikasi server produksi; uji konkurensi penomoran tidak diulang karena algoritmanya tidak berubah.
- `php -l` pada model, dua controller, `LetterNumber`, migration dan tes baru: lulus. `git diff --check`: lulus (warning konversi LF/CRLF bukan kesalahan whitespace).

Percobaan awal gagal: assertion plaintext lama, perubahan tipe SQLite di tabel ber-FK, serta benturan storage fiktif saat dua suite berjalan bersamaan. Assertion diperbarui, DDL SQLite diperbaiki, dan suite diulang secara serial. Bukan alasan menyatakan percobaan awal lulus.

Percobaan penuh MariaDB berikutnya gagal autentikasi (`1045`, `using password: YES`), bukan kegagalan enkripsi. Diagnosis tanpa mencetak rahasia membuktikan `$env:DB_PASSWORD=''` menghapus variable proses pada PowerShell Windows ini; password nonkosong dari `.env.testing.mysql` lalu dimuat. Override Laravel `(empty)` untuk `DB_PASSWORD` dan `DB_URL` terbukti menghasilkan password kosong dan koneksi ke instance terisolasi `127.0.0.1:3308/watuagung_test` pada MariaDB 11.4.8. File kredensial tidak diubah.

## Operasional dan batas

- Database pengembangan tidak dimigrasi; MariaDB 11.4.8 lokal memakai instance baru khusus port 3308, database `watuagung_test` kosong dengan APP_KEY acak sementara di environment proses. Bukan server produksi, bukan penggantian APP_KEY data lama. SQLite memakai database in-memory tes.
- Wajib maintenance tanpa HTTP penulis/worker/scheduler, backup database dapat dipulihkan, APP_KEY lama tetap tersedia. Tidak aman rolling deploy kode lama/baru. Jalankan rollback migration ini sebelum kode lama diaktifkan kembali. Panduan lengkap di `backend/README.md`.
- Enkripsi ini melindungi dump database tanpa APP_KEY; bukan perlindungan bila APP_KEY/server ikut bocor. Backup lama masih berisi plaintext. Field lain di luar cakupan tetap seperti sebelumnya.
- Tidak mengubah aturan akses, retensi, format PDF, atau daftar response publik. Tidak menjalankan tes visual/frontend karena tidak ada perubahan frontend. Belum push/deploy.
