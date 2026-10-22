# Indeks dokumentasi Watuagung

Dokumentasi aktif tetap berada pada lokasi yang dirujuk aturan proyek. Catatan progres tidak dipindahkan agar tautan dan pola `docs/progres-YYYY-MM-DD.md` tetap berlaku.

## Panduan aktif

| Dokumen | Kegunaan |
| --- | --- |
| [README utama](../README.md) | Mulai lokal, peta folder, verifikasi, demo Vercel, dan pengaman push |
| [PRODUCT.md](../PRODUCT.md) | Tujuan, pengguna, batas produk, dan keputusan produk |
| [DESIGN.md](../DESIGN.md) | Token visual, komponen, responsivitas, dan aksesibilitas |
| [ROADMAP.md](../ROADMAP.md) | Status implementasi, pengujian tertunda, dependensi, dan keputusan berikutnya |
| [AGENTS.md](../AGENTS.md) | Aturan kerja dan kontribusi repositori |
| [README backend](../backend/README.md) | Setup Laravel, akun/peran, endpoint, keamanan, dan persiapan produksi |
| [Integrasi](integrasi.md) | Kontrak frontend–API, mode demo/API, sesi, dan alur surat |

Status proyek terkini dirangkum di roadmap. Jika panduan dan kode berbeda, periksa implementasi serta keputusan terbaru sebelum mengubah perilaku; jangan menganggap catatan historis sebagai spesifikasi baru.

## Catatan progres — terbaru lebih dahulu

| Catatan | Pokok pekerjaan |
| --- | --- |
| [22 Oktober 2026](progres-2026-10-22.md) | Manajemen akun petugas dan perbaikan build |
| [21 Oktober 2026](progres-2026-10-21.md) | Buat ulang kode akses, penomoran/register, PDF dan QR |
| [20 Oktober 2026](progres-2026-10-20.md) | Persetujuan RT/RW |
| [18 Oktober 2026](progres-2026-10-18.md) | Pengembangan panel dan alur status |
| [17 Oktober 2026](progres-2026-10-17.md) | Redesign dan audit UI |
| [15 Oktober 2026](progres-2026-10-15.md) | Progres awal redesign Oktober |
| [29 September 2026](progres-2026-09-29.md) | Fondasi integrasi pelayanan |

Hasil tes pada catatan berlaku untuk sesi/commit yang disebutkan, bukan jaminan versi terbaru atau deployment sudah diuji. Catat pengujian nyata, keterbatasan, dan pekerjaan tertunda; gunakan data fiktif tanpa kredensial atau identitas warga.

## Batas penataan folder

- Kode aplikasi tetap di `app/`, `components/`, `features/`, `services/`, `lib/`, `types/`, dan `backend/`; detailnya ada di README utama.
- Dokumen pedoman tetap di root; panduan teknis/progres di `docs/`; petunjuk API di `backend/README.md`.
- `build/`, `db/`, `drizzle/`, dan `examples/` merupakan tooling/contoh yang masih dipertahankan, bukan folder untuk dipindahkan atau dihapus tanpa audit referensi.
- `CLAUDE.md` dan `.claude/` tetap lokal di semua tingkat folder. Jangan menyalin isinya ke dokumentasi publik. Markdown lainnya boleh dilacak Git.
