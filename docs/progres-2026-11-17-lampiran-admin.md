# L4 — Dokumen warga di detail permohonan

Tanggal: 17 November 2026. Branch: `feat/attachments-admin` dari `origin/main` setelah PR L3 #83 merged. Tidak mengubah backend atau kontrak API.

## Perubahan

- `features/admin/application-detail.tsx`: parser Zod mempertahankan metadata lampiran; kartu khusus staff/admin/village_head; pilihan cepat Foto KTP buram, Pengantar RT/RW belum ditandatangani, Foto KK buram. Pilihan menambahkan catatan, menjaga catatan sebelumnya dan batas 1.000 karakter; tidak otomatis mengirim status.
- `features/admin/applicant-documents.tsx`: tiga dokumen dengan status Ada/Belum/Dihapus sesuai masa simpan; pesan audit; isi lewat session request yang membungkus `adminRequest()` sebagai blob. Gambar dalam dialog Radix dengan perbesar/perkecil dan putar 90°, gulir keyboard, fokus kembali ke pemicu. PDF pada tab object URL tanpa opener; sessionStorage salinan pada about:blank dikosongkan sebelum navigasi agar token petugas tidak ikut ke tab dokumen. Pop-up diblokir menampilkan pesan, bukan unduh diam-diam.
- Object URL dicabut saat tutup/ganti dokumen, unmount (pindah permohonan/route/logout), dan pagehide. Penutupan tab PDF diperiksa tiap 500 ms; tombol Tutup dokumen menutup tab sekaligus melepas URL. Pembatalan/respons terlambat tidak membuat URL. Tidak ada URL storage langsung, token pada URL, penyimpanan file browser, atau unduh massal.
- `features/admin/application-detail.module.css`: token, kartu, dialog, fokus dan tombol lama; viewport gambar dapat digulir tanpa meluapkan halaman.
- `scripts/test-applicant-documents.mjs`: pengujian UI deterministik memakai API tiruan lokal dan Chrome CDP, tanpa dependensi baru. Tes API Laravel terpisah tetap otoritas pembuktian izin/audit.
- `ROADMAP.md`, `docs/integrasi.md`: catatan L4 dan batas pelaksanaan produksi.

## Verifikasi

- `npm run lint`: lulus.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus, 57 halaman statis. Warning Next.js tentang `package-lock.json` di direktori pengguna di luar repositori tetap ada.
- `php artisan test --filter=AttachmentAccessTest` dari `backend/`: 19 tes, 303 assertions lulus. Mencakup staff/admin/village_head membuka gambar dan PDF dengan audit setiap pembukaan; KIM mendapat 403 termasuk token ability bocor; RT/RW ditolak, 401/404/410, penggantian dan retensi. Tidak mengubah file backend.
- `node scripts/test-applicant-documents.mjs` dengan `ADMIN_TEST_DIR=C:/Users/Christian/AppData/Local/Temp/opencode/l4-admin`: lulus pada Chrome headless nyata dengan API tiruan. Staff/admin/kades, guard menu/route KIM tanpa fetch data pemohon, status Ada/Belum/purged, blob bearer header, perbesar/perkecil/putar, Escape dan fokus kembali, tutup tab PDF bawaan/tombol, token tab PDF kosong sebelum/sesudah navigasi sementara sesi asal utuh, batal/response terlambat, cleanup SPA/logout, galat 401/403/404/500/jaringan/MIME/decode/pop-up. Setiap URL yang dibuat dicabut tepat sekali; tab dokumen ditutup. Pilihan cepat menambah catatan lama, fokus textarea, tidak mengirim status otomatis, dan tunduk batas 1.000 karakter.
- Screenshot kartu dan penampil diperiksa langsung pada 390px dan 1440px: tidak ada overflow halaman, tombol penampil ≥48px, gulir gambar tetap dalam penampil. Berkas lokal `documents-{390,1440}.png` dan `documents-image-{390,1440}.png` pada direktori di atas; tidak masuk Git.
- `git diff --check`: lulus (peringatan konversi LF/CRLF Git, bukan whitespace error).

## Batas

- UI memakai API tiruan; izin/audit backend dibuktikan terpisah lewat suite Laravel, bukan satu alur browser end-to-end Laravel.
- Cleanup membuktikan pencabutan object URL dan pelepasan referensi penampil; waktu garbage collection/heap fisik dikendalikan browser, bukan klaim pengukuran heap.
- Tidak menguji deployment/penjadwal retensi produksi atau seluruh suite backend. Tes memakai data/berkas fiktif; tidak ada data warga nyata.
- Tidak push/deploy. Perubahan lokal lain tidak masuk commit.
