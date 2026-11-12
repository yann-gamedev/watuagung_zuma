# Progres 13 November 2026 — Kredit BEM Fasilkom di footer

## Lingkup
Bagian kredit/penanda pembuat di footer: website dikembangkan oleh Kepanitiaan Fasilkom Zuma, Bidang Pengabdian Masyarakat, BEM Fakultas Ilmu Komputer UPN "Veteran" Jawa Timur, beserta dua logo.

## File yang diubah
- `public/brand/logo-bem-fasilkom-160.png` (baru): dari `assets/logo/bem-fasilkom-logo.svg`, dipangkas, 160px, ~11 KB.
- `public/brand/logo-pengmas-160.png` (baru): dari `assets/logo/Logo Pengabdian Masyarakat .PNG` (1514px, 290 KB), dipangkas, 160px, ~8 KB, tanpa metadata.
- `components/site.tsx`: blok `.footer-credit` di antara grid link dan `.footer-bottom`.
- `app/globals.css`: gaya `.footer-credit*`; garis pemisah dan jarak 48px dipindah dari `.footer-bottom` ke `.footer-credit`.

Logo ditampilkan 56px di atas kotak `--cream` (radius 12px) agar biru/oranye tetap terbaca di latar `--forest-deep`. Warna logo tidak diubah. Tidak ada hex baru. Atribusi foto `/village.jpg` tetap ada.

## Verifikasi yang dijalankan
- `npm run lint`: lulus
- `npx tsc --noEmit`: lulus
- `npm run build`: lulus
- Screenshot Chrome headless `/kontak/` pada 1440px dan 390px (lewat iframe): logo + teks tampil, teks membungkus di bawah logo pada 390px.

## Perlu keputusan
- Tata letak kotak logo krem adalah keputusan visual baru di luar `DESIGN.md`; mohon konfirmasi Tech Lead dan catat di `DESIGN.md` bila disetujui.
- Belum di-commit.

## Revisi tata letak (permintaan pengguna: kurang menyatu)
- Kotak krem di belakang logo dihapus; kedua logo sudah dicek tetap terbaca langsung di atas `--forest-deep`.
- Kredit dipindah ke kolom identitas desa (di bawah kontak) sebagai `<section>` berjudul "Dikembangkan oleh", memakai gaya judul yang sama dengan kolom link footer. Pita/garis tambahan dihapus; `.footer-bottom` kembali `margin-top: 48px`.
- Logo 48px, teks tiga baris: nama kepanitiaan (cream, 16px/700), bidang, dan BEM Fasilkom (muted, 15px).
- Verifikasi ulang: lint, tsc, build lulus; screenshot 1440px dan 390px (iframe) dicek. Pada 390px kredit tampil sebelum kolom Layanan.
- Keputusan "kotak krem" di atas tidak berlaku lagi; tata letak kredit tetap perlu dicatat di `DESIGN.md` bila disetujui.

## Revisi 2: baris teks kredit
- Baris dipisah dengan `<br />` di markup (tidak bergantung CSS): nama kepanitiaan / "Bidang Pengabdian Masyarakat" / "BEM Fasilkom UPN "Veteran" Jawa Timur". "Jawa Timur" memakai `&nbsp;` agar tidak terpisah.
- Lint, tsc, build lulus; screenshot 1440px (2 baris rapi) dan 390px (baris BEM membungkus, "Jawa Timur" utuh).
