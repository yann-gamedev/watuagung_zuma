# Sistem Informasi dan Pelayanan Digital Desa Watuagung

Portal informasi desa dan prototipe pelayanan administrasi: frontend Next.js dan API Laravel dalam satu repositori. **Konten desa masih contoh; gunakan data fiktif. Belum siap menerima data warga nyata.**

## Mulai dari sini

- [Indeks dokumentasi](docs/README.md) — panduan, struktur folder, dan catatan progres.
- [Roadmap dan status pekerjaan](ROADMAP.md) — implementasi selesai, pengujian tertunda, dan keputusan yang dibutuhkan.
- [Panduan backend](backend/README.md) — setup Laravel, akun, endpoint, dan keamanan.
- [Integrasi frontend–API](docs/integrasi.md) — kontrak data dan perbedaan mode API/demo.
- [Konteks produk](PRODUCT.md), [sistem desain](DESIGN.md), dan [aturan kontribusi](AGENTS.md).

## Fitur saat ini

- Informasi publik: profil, berita, pengumuman, agenda, potensi, BUMDes, statistik, transparansi, dan kontak; konten belum dikelola melalui CMS.
- Pengajuan SKU, domisili, SKTM, dan pengantar KTP/KK; cek status API memakai nomor pengajuan dan kode akses rahasia.
- Lima peran panel: Ketua RT, Ketua RW, Petugas, Kepala Desa, dan Admin. RT/RW dibatasi wilayahnya.
- Daftar/detail pengajuan, pencarian/filter, riwayat status, audit akses, serta antrean persetujuan.
- Manajemen akun oleh Admin: tambah/ubah/nonaktifkan, reset kata sandi sementara, dan wajib ganti kata sandi. Sesi bertahan saat refresh melalui `sessionStorage` tab, dengan validasi server dan batas kedaluwarsa.
- Penomoran otomatis, buku register, draf/final PDF, unggah surat manual hasil pindaian, dan verifikasi QR. **Template dan format nomor masih sementara; QR bukan TTE tersertifikasi.** Warga tetap mengambil surat fisik.
- Bantuan buat ulang kode akses melalui petugas/RT/RW setelah pemeriksaan identitas; bukan pemulihan mandiri melalui OTP.

Domisili, SKTM, dan KTP/KK: **warga → RT → RW → petugas desa → Kepala Desa → petugas menyiapkan surat → diambil warga**. SKU langsung ke petugas desa tanpa RT/RW. Hanya Kepala Desa yang memutuskan persetujuan akhir.

## Struktur repositori

| Lokasi | Tanggung jawab |
| --- | --- |
| `app/` | Route dan layout Next.js App Router |
| `components/`, `components/ui/` | Komponen bersama dan komponen UI shadcn |
| `features/admin/`, `features/pelayanan/` | Panel petugas dan alur pelayanan warga |
| `services/`, `types/` | Transport API/simulasi dan kontrak data frontend |
| `lib/`, `hooks/` | Validasi, alur surat, data contoh, utilitas, dan hook React |
| `public/` | Aset publik, logo, dan foto; atribusi foto tetap ada di footer |
| `backend/` | API Laravel, migration, template surat, storage privat, dan tes |
| `docs/` | Panduan integrasi, indeks, dan catatan progres |
| `scripts/`, `.githooks/` | Build/demo, pemeriksaan, dan pengaman Git |
| `vendor/` | CSS pihak ketiga beserta lisensinya; bukan dependensi Composer backend |
| `build/`, `db/`, `drizzle/`, `examples/` | Tooling Sites/Vite/Cloudflare dan contoh D1; bukan database pelayanan Laravel |

Konfigurasi `vite.config.ts`, `drizzle.config.ts`, dan `.openai/` terkait tooling alternatif masih dipertahankan; alur npm utama memakai Next.js. `build/` berisi sumber plugin, **bukan** folder hasil build yang boleh dihapus sembarangan. `.next/`, `out/`, `node_modules/`, dan `backend/vendor/` adalah hasil build/dependensi lokal, bukan tempat menulis fitur.

## Menjalankan lokal

Prasyarat: **Node.js ≥ 22.13, PHP ≥ 8.3, Composer**, dan ekstensi PHP yang diperlukan dependensi (termasuk SQLite dan GD untuk QR PNG). Contoh perintah memakai PowerShell. Jalankan backend dan frontend pada **dua terminal terpisah**.

### 1. Backend Laravel

Dari folder `backend/`, untuk instalasi baru:

```powershell
composer install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Jika Composer tidak ada di PATH tetapi `composer.phar` lokal tersedia, gunakan `php ..\composer.phar install`. **Hanya untuk instalasi baru yang belum memiliki APP_KEY**, jalankan:

```powershell
php artisan key:generate
```

Lanjutkan:

```powershell
if (!(Test-Path database/database.sqlite)) { New-Item database/database.sqlite -ItemType File }
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Jangan menimpa `.env`, database, atau mengganti `APP_KEY` setelah data terenkripsi tersimpan. Health check: http://127.0.0.1:8000/up. Untuk QR, sesuaikan `LETTER_VERIFY_URL` di `.env` backend dengan alamat halaman frontend `/verifikasi/` yang dapat dijangkau pemindai; localhost komputer tidak dapat dibuka langsung dari ponsel lain.

### 2. Frontend Next.js

Dari root repositori:

```powershell
npm ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Untuk mode API, isi `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1` dan pastikan `NEXT_PUBLIC_DEMO_MODE` bukan `true`. Lalu:

```powershell
npm run dev
```

Buka http://127.0.0.1:3000. Restart dev server setelah mengubah environment. Origin frontend harus diizinkan dalam `FRONTEND_ORIGINS` backend; lihat [integrasi frontend](backend/README.md#integrasi-frontend). Variabel `NEXT_PUBLIC_*` terlihat di browser: jangan isi dengan rahasia.

Tanpa URL API, formulir publik memakai simulasi browser dan panel petugas tidak aktif. `npm run start` saat ini juga menjalankan **dev server**, bukan server produksi.

### 3. Akun dan alur uji

Tidak ada akun/kata sandi bawaan. Dari `backend/`, buat admin lokal pertama:

```powershell
php artisan staff:create admin-lokal --role=admin --name="Admin Lokal"
```

Kata sandi diminta secara tersembunyi. Selanjutnya login di `/admin` dan kelola akun melalui `/admin/akun`; lihat [panduan akun](backend/README.md#akun-petugas) untuk peran dan wilayah.

1. Ajukan surat dengan data fiktif di `/pelayanan`.
2. Pada mode API, simpan nomor pengajuan **dan kode akses** dari halaman berhasil. Jangan masukkan kode akses ke URL.
3. Buka `/pelayanan/status` untuk memeriksa perkembangan. Jika kode hilang, bantuan buat ulang tersedia melalui RT/RW atau kantor desa dengan pemeriksaan KTP/KK; kode lama akan tidak berlaku.
4. Proses pengajuan dengan akun sesuai peran sampai selesai. Surat yang memerlukan RT/RW harus memakai wilayah yang cocok dengan akun penguji.
5. Uji PDF/unggah manual/QR dengan Laravel langsung; checklist pengujian yang belum tuntas ada di [roadmap](ROADMAP.md).

## Verifikasi pengembangan

Dari root repositori:

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run build:demo
npm run test:demo
node scripts/test-admin-filters.mjs
node scripts/test-private-files.mjs
```

Dari `backend/`: `php artisan test`. Perubahan UI juga diperiksa pada lebar **390px dan 1440px**. Build/test lokal tidak membuktikan deployment maupun alur produksi berhasil.

## Demo Vercel tanpa backend

`vercel.json` memakai `npm run build:demo` untuk static export. Script memaksa demo dan mengabaikan URL API lama, termasuk localhost di dashboard Vercel.

- Root Directory: root repositori; Framework Preset: Next.js.
- Build Command: `npm run build:demo`; instalasi: `npm ci`; Node.js 22.x atau 24.x yang didukung Vercel.
- Output Directory: **default, Override nonaktif**. Jangan isi `out`: adapter Next.js perlu membaca manifest `.next`.
- Tidak membutuhkan PHP, Composer, database, atau backend Laravel.
- Panel petugas dan verifikasi surat tidak tersedia. Simulasi tidak menerbitkan surat atau memproses layanan pemerintah.
- Maksimal 50 bukti simulasi disimpan di browser/origin yang sama, tanpa identitas pemohon. Menghapus storage menghapus riwayat; status tidak bergerak otomatis.

Untuk demo lokal:

```powershell
$env:NEXT_PUBLIC_DEMO_MODE="true"
npm run dev
```

Sebelum kembali ke mode API, hentikan server, hapus override sesi PowerShell dengan `Remove-Item Env:NEXT_PUBLIC_DEMO_MODE`, pastikan `.env.local` tidak memaksa demo, lalu jalankan ulang. Setelah deploy, periksa formulir, cek status, refresh route bertingkat, mobile, dan pembatasan panel pada **URL Vercel sebenarnya**.

## File lokal dan pengaman push

`CLAUDE.md` dan folder `.claude/` di semua tingkat folder, tanpa membedakan huruf besar/kecil, tidak boleh dilacak atau dikirim ke GitHub. **Markdown lainnya tetap diperbolehkan.** Salinan lokal dipertahankan; riwayat yang sudah terbit tidak dihapus.

Aktifkan hook di **setiap clone**, dari root:

```powershell
git config --local core.hooksPath .githooks
node scripts/test-private-files.mjs
```

Hook `pre-push` memeriksa isi akhir dan perubahan commit yang akan dikirim, termasuk file yang ditambahkan lalu dihapus. Untuk branch baru, commit yang sudah tercatat pada remote tujuan dikecualikan dari pemeriksaan riwayat; jalankan `git fetch` agar referensi mutakhir. Node.js wajib tersedia; kegagalan pemeriksaan membatalkan push. Hook lokal dapat dilewati dengan `--no-verify`, bukan pengganti aturan server GitHub.

Gabungkan pengaturan berikut ke `.claude/settings.json` **lokal**, tanpa menimpa pengaturan lain, untuk menonaktifkan atribusi otomatis Claude pada commit/PR berikutnya:

```json
{
  "attribution": { "commit": "", "pr": "" },
  "includeCoAuthoredBy": false
}
```

Pengaturan ini tidak menghapus atribusi lama. Jangan commit `.env`, database, token, file build, atau folder `assets/` lokal yang belum disetujui. Gunakan branch per tugas dan Conventional Commits; jangan push/deploy tanpa permintaan.

## Batas prototipe

Belum ada pengaduan warga, CMS, unggah **lampiran persyaratan warga**, atau OTP mandiri. Unggah surat final oleh petugas sudah ada dan merupakan fitur berbeda. Template resmi, konten desa, hosting/database produksi, backup, kebijakan privasi/retensi, serta uji keamanan dan operasional masih perlu dituntaskan sesuai [ROADMAP.md](ROADMAP.md). QR hanya membantu verifikasi; surat tetap memerlukan tanda tangan basah dan stempel sampai ada TTE tersertifikasi.
