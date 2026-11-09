# Progres 9 November 2026 — Navigasi antarhalaman

## Lingkup
- Tombol **Kembali** di awal breadcrumb semua halaman yang memakai `PageHeading` (profil, sejarah, visi-misi, struktur, statistik, transparansi, berita, UMKM, pelayanan, verifikasi, kebijakan privasi, BUMDes).
  - Ada riwayat di situs pada tab ini → `router.back()` (kembali ke halaman asal).
  - Dibuka langsung/dari luar situs → tautan biasa ke halaman induk breadcrumb (`parent.href`) atau Beranda.
  - Riwayat dicatat `NavHistoryTracker` di `PublicShell` lewat `sessionStorage` (dibungkus try/catch); Ctrl/Cmd/Shift-klik tetap membuka tautan cadangan.
- Komponen `ProfileLinks` menggantikan deretan tautan profil yang ditulis ulang; kini tampil di Profil, Sejarah, Struktur, **Visi dan Misi** (baru), dan **Statistik** (baru). Halaman aktif tidak ditampilkan.

## File
- `components/back-link.tsx` (baru), `components/profile-links.tsx` (baru)
- `components/site.tsx` — `BackLink` di breadcrumb, `NavHistoryTracker` di `PublicShell`
- `components/site-text-page.tsx`, `components/structure-page.tsx` — pakai `ProfileLinks`
- `app/[slug]/page.tsx` (visi-misi), `app/statistik/page.tsx` — tambah `ProfileLinks`
- `app/globals.css` — `.back-link`, `.breadcrumb-divider` (token yang ada, area sentuh 48px)

## Verifikasi yang dijalankan
- `npm run lint` lulus, `npx tsc --noEmit` lulus, `npm run build` lulus.
- Screenshot Chrome headless dari `out/`: 1440px sejarah dan visi-misi tampil benar.
- 390px: Chrome headless memotong viewport (lebar minimum ~500px), termasuk header yang tidak diubah, jadi belum terverifikasi akurat.
- Perilaku klik Kembali (`router.back()`) belum diuji otomatis; perlu cek manual di browser.

## Sisa
- Cek manual 390px (DevTools device mode) dan alur Profil → Sejarah → Kembali.
- Beranda tidak punya `PageHeading`, jadi tidak ada tombol Kembali (memang halaman akar).
