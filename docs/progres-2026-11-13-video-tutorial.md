# Progres 13 November 2026 — Video tutorial di halaman Pelayanan

## Lingkup
Bagian video tutorial pengajuan surat (YouTube `A6kL8-C8OBU`, "Tutorial Pelayanan Surat Online") dipindah ke atas "Layanan surat yang tersedia" dan dibuat rata tengah. Atas permintaan pengguna: **hanya lokal dulu**, belum commit/deploy.

## File yang diubah
- `app/pelayanan/page.tsx`: `<SiteVideo slot="tutorial">` dipindah dari bawah "Cara mengajukan surat" ke awal `.service-page`, kelas `site-video-centered`.
- `app/globals.css`: `.site-video.site-video-centered` (judul, bingkai 960px, judul video di tengah; jarak bawah 64px).
- `lib/data.ts`: cadangan `videos.tutorial` = `A6kL8-C8OBU` / "Tutorial Pelayanan Surat Online" (judul dari oEmbed YouTube) agar demo Vercel menampilkan video.
- `features/admin/video-editor.tsx`: teks lokasi slot tutorial di panel admin.

## Verifikasi yang dijalankan
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test:demo`: lulus.
- Screenshot Chrome headless `/pelayanan/` 1440px dan 390px (iframe): video di tengah di atas daftar layanan, tombol "Putar video" terlihat.

## Revisi: posisi tengah dan ruang kosong
- Pengguna melihat judul rata kiri dan ruang kosong besar di `npm run dev`. Ruang kosong: `.container.service-page` memakai `padding-top: 96px` (desktop ≥901px). Kini 48px bila video tutorial menjadi anak pertama (`:has(> .site-video-centered:first-child)`); tanpa video tetap 96px.
- Judul, bingkai (`margin-inline: auto`), dan judul video ditengahkan eksplisit. Judul rata kiri di dev kemungkinan CSS basi; restart `npm run dev` + hard refresh.
- Diukur di build statis: video mulai 48px di bawah page heading, bingkai 960px di tengah. Lint, tsc, build lulus; screenshot 1440px/390px dicek.

## Sisa / keputusan
- Produksi (mode API) membaca slot dari server; respons server `tutorial: null` menimpa cadangan. Setelah deploy, isi link + judul di `/admin/konten/video/` desawatuagung.com.
- Catat posisi/varian rata tengah di `DESIGN.md` § Video YouTube bila disetujui.
- Di-commit di branch `feat/ui-pelayanan-tutorial-video`; belum push/deploy.
