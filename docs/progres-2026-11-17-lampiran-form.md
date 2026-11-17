# L3 — Unggah dan ganti dokumen warga, 17 November 2026

Branch: `feat/attachments-form`. Commit diminta: `feat(web): document upload on application form`.

## Lingkup

- `app/pelayanan/[service]/page.tsx`: Siapkan dulu memuat foto/pindaian KTP, KK, pengantar Ketua RT/RW, dan pengingat membawa dokumen asli. Label sementara dipertahankan; kalimat data fiktif di kartu dihapus. DOM/grid persyaratan sebelum formulir pada HP tidak diubah.
- `features/pelayanan/application-form.tsx`, `document-upload.tsx`: tiga langkah isian → unggah → ringkasan; kartu per dokumen, kamera belakang, pilih file, pratinjau, Ganti/Hapus, tips, wajib tiga dokumen, daftar terlampir, progres dan galat 422 per kartu. Data isian/file tetap saat koreksi; file dilepas setelah sukses.
- `lib/attachments.ts`: canvas JPEG kualitas 0,85, sisi panjang ≤2.000 px tanpa memperbesar; sisi pendek <600 px ditolak agar tetap terbaca. Hasil foto ≥1.500.000 byte ditolak dengan petunjuk, bukan dikirim besar diam-diam. PDF ≤5 MiB, header `%PDF-`, isi tidak diubah. Nama netral; file tidak masuk browser storage, object URL dibersihkan.
- `services/pelayanan.ts`, `types/pelayanan.ts`: XHR multipart native bersama untuk submit/revisi, timeout 120 detik, persen bila tersedia, galat terstruktur, validasi Zod; demo tidak mengirim file dan tidak menyimpannya.
- `features/pelayanan/status-checker.tsx`: catatan NEED_REVISION dan tombol Ganti dokumen, memilih minimal satu pengganti. Kode akses yang lolos lookup hanya di memori dan body multipart. Respons L2 parsial digabung agar jenis surat, alur dan catatan tetap ada; status tetap NEED_REVISION. Demo tidak menampilkan revisi.
- `app/kebijakan-privasi/page.tsx`, `docs/integrasi.md`: data lampiran, enkripsi, petugas/admin pelayanan/Kepala Desa, mekanisme retensi 30 hari beserta batas verifikasi produksi.
- Tes: `scripts/test-demo.mjs`, `test-attachments.mjs`, `test-attachments-browser.mjs`.

Tidak menambah dependensi atau mengubah kode backend. Commit L2 `e62247d` masuk HEAD saat sesi berlangsung; pengguna menyetujui mempertahankannya sebagai induk dan menghubungkan revisi. Awalnya privasi direncanakan menyebut retensi belum aktif; sesudah L2 masuk, teks diperbarui: mekanisme tersedia, scheduler/config produksi belum diverifikasi. Perubahan lokal lain pada assets dan dokumen lama tidak disentuh/diikutkan commit.

## Verifikasi

Lulus:

- `npm run lint` (tanpa warning ESLint).
- `npx tsc --noEmit`.
- `npm run build` dan `npm run build:demo` (57 halaman). Warning Next.js tentang `C:\Users\Christian\package-lock.json` di luar repo tetap ada, tidak memengaruhi keberhasilan build.
- `npm run test:demo`: enam jenis surat, storage demo tanpa file/identitas, multipart submit/revisi, progres, 422, timeout/network/413, kode akses body-only dan isolasi demo. Tes kompres helper ikut dipanggil.
- `node scripts/test-attachments.mjs`: ukuran/dimensi/kualitas canvas dengan stub, PDF byte-identik, batas ukuran, gambar rusak, cleanup URL, nama netral, kamera, urutan DOM.
- `node scripts/test-attachments-browser.mjs`: Chrome headless dengan emulasi 390×844 dan 1440×1000; foto **fiktif hasil canvas 4032×3024**, alur formulir sampai HTTP 201 Laravel SQLite lokal. Ketiga foto multipart masing-masing **32.933 byte**, di bawah 1,5 MB. Pratinjau, wajib dokumen, Hapus/Ganti, PDF >5 MB, ringkasan, galat KK 422 tiruan mempertahankan file, tanpa overflow. NEED_REVISION dibuat hanya pada permohonan fiktif baru dari tes; lookup dan penggantian satu KK melalui L2 asli berhasil, catatan tetap tampil.
- Screenshot 390px dan 1440px diperiksa; tersimpan sementara di `%LOCALAPPDATA%\Temp\opencode\attachments-390.png` dan `attachments-1440.png`, tidak di Git.

Uji browser pertama gagal karena migration lampiran belum dijalankan pada SQLite lokal (`no such table: application_attachments`). Hanya migration yang sudah ada `2026_11_16_000000_create_application_attachments.php` dijalankan, tanpa reset DB atau perubahan APP_KEY. Uji ulang lulus. Satu percobaan skrip setelah hot reload gagal menemukan tombol langkah pertama; skrip kini menunggu label/hidrasi sebelum mengisi, uji ulang lulus.

## Batas

- Belum uji kamera fisik Android/iPhone, HEIC lintas browser, screen reader, foto kamera nyata bertekstur/noisy, atau jaringan lambat sungguhan. Format gambar yang tidak dapat dibaca browser mendapat pesan pilih JPG/PNG/WebP/PDF.
- JPEG 0,85/2000px tidak menjamin semua gambar <1,5 MB; hasil di atas batas ditolak, warga diminta ambil ulang/PDF. Bukti ukuran di atas hanya untuk foto fiktif uji.
- Tes browser butuh Chrome profil uji terpisah `--remote-debugging-port=9222`, frontend `:3000` dengan API Laravel `:8000`, PHP CLI serta DB lokal bermigrasi. Ia meninggalkan permohonan fiktif dan lampirannya untuk inspeksi, tidak menghapus data pengguna.
- Tidak menjalankan ulang seluruh suite backend karena kode backend tidak diubah. Tidak push/deploy; scheduler/konfigurasi retensi produksi dan merge L2 ke main belum diverifikasi. L4 di luar lingkup.
