# Progres — hak cipta KIM dan tautan media sosial per berita (22 November 2026)

Branch: `feat/news-copyright-social-links`, dari `origin/main` @ `aa37436`. Permintaan pengguna: teks hak cipta KIM opsional per berita (dicentang = tampil) dan kolom media sosial opsional (TikTok, Instagram, YouTube, Facebook) seperti kolom WhatsApp UMKM.

## Keputusan (dikonfirmasi pengguna di sesi)

- Tautan media sosial **per berita** (tautan unggahan berita yang sama), bukan akun resmi desa. Akun resmi dan tombol bagikan tetap Rencana A (`docs/PROMPTS-REVISI-SURAT2.md`), belum dikerjakan.
- Teks hak cipta: **"© {tahun terbit} KIM Desa Watuagung"** di akhir isi berita; bawaan tidak dicentang.
- Tampilan: tombol sekunder dengan ikon `ExternalLink`; tidak memakai ikon merek (lucide-react 1.31 tidak menyediakannya; tanpa dependensi baru).

## Perubahan

- **Backend**
  - Migration `2026_11_22_000000_add_copyright_and_social_links_to_posts` (+`down()`): `show_copyright` boolean bawaan false, `instagram_url`/`tiktok_url`/`youtube_url`/`facebook_url` string(500) nullable.
  - `App\Domain\SocialPlatform`: label, host resmi, validasi (https, tanpa user/password/port, host tepat).
  - `Post`: fillable/cast, `socialLinks()`.
  - `PostController`: validasi opsional per kolom (422 per kolom; `""`/null mengosongkan; PATCH tanpa kolom mempertahankan nilai). Detail petugas mengirim lima kolom. Detail publik menambah `show_copyright` dan `social_links` (hanya yang terisi, `{}` bila kosong). Daftar publik tidak berubah.
- **Frontend**
  - `types/posts.ts`: kontrak baru.
  - `lib/social-links.ts`: cermin aturan host untuk pesan panel dan penyaringan respons publik.
  - `services/posts.ts`: Zod + `copyrightYear` (tahun terbit WIB) + `socialLinks` tersaring, urutan Instagram, TikTok, YouTube, Facebook.
  - `features/admin/news-data.ts`, `news-editor.tsx`, `news.module.css`: kotak centang hak cipta, bagian "Media sosial (opsional)" dengan empat kolom, contoh, galat per kolom (garis dan teks token galat), dan pratinjau.
  - `features/news/news-article.tsx` + `app/globals.css`: teks hak cipta dan bagian "Lihat juga di" (tab baru, `noopener noreferrer`, keterangan pembaca layar).
- **Tes**
  - `PostCopyrightSocialLinksTest` (bawaan, simpan/kosongkan, publik hanya yang terisi, daftar tidak berubah, draf tidak bocor, 12 kasus 422 termasuk http/javascript:/data:/domain salah/host tiruan/`@`/port/panjang/kontrol, host seluler/pendek, peran lain 403).
  - `PostSocialLinksMigrationTest` (down/up, berita lama bawaan off).
  - `scripts/test-public-news.mjs`: parsing, penyaringan, Zod, render.
- **Dokumen**: `docs/integrasi.md`, `backend/README.md`, `PRODUCT.md`, `DESIGN.md`.

## Verifikasi (benar-benar dijalankan)

- `npm run lint`: 0 error, 1 warning lama (`app/components/LembagaList.tsx`).
- `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo`: lulus.
- `php artisan test --compact`: 547 tes lulus, 25.542 assertions. Setelah perubahan gaya terakhir, filter `Post` diulang: 75 lulus.
- **Uji lokal**: Laravel :8010 dengan SQLite sementara di scratchpad, akun KIM fiktif, static export :3010, Chrome headless via CDP.
  - KIM menulis berita di `/admin/berita/tulis/`.
  - Tautan TikTok di kolom Instagram memunculkan galat per kolom dan menahan penyimpanan.
  - Isi Instagram/YouTube/Facebook dan centang hak cipta, lalu terbitkan dan cek pratinjau. Editor dimuat ulang: nilai tersimpan, TikTok kosong.
  - Halaman `/berita/baca/?slug=…` pada 390/1440 menampilkan "© 2026 KIM Desa Watuagung" dan tiga tombol berurutan (tab baru, `noopener noreferrer`), tanpa scroll horizontal.
  - Centang dimatikan dan tautan dikosongkan: halaman publik tidak menampilkan keduanya.
  - Screenshot diperiksa visual.
  - DB dev, storage, dan server :3000/:8000 tidak disentuh. `out/` dibangun ulang dengan env bawaan.

## Sisa / keputusan

- Rencana A (akun resmi desa di footer + tombol bagikan + Open Graph) belum dikerjakan.
- Teks hak cipta tetap "KIM Desa Watuagung" untuk semua berita yang dicentang; bila perlu nama penulis/fotografer per berita, itu fitur terpisah.
- Deploy: jalankan `php artisan migrate` di server.

## Pembaruan: tombol sosmed bergaya Chat WhatsApp UMKM (branch `fix/news-social-buttons-umkm-style`)

Permintaan pengguna setelah PR #104 di-merge: tampilan tautan sosmed di halaman berita disamakan dengan tombol WhatsApp pada detail UMKM.

- `features/news/news-article.tsx`: judul "Lihat juga di" dan tombol sekunder diganti tombol utama `.btn .umkm-chat` per platform berlabel "Lihat di Instagram/TikTok/YouTube/Facebook". Ikon `ExternalLink` 22px tetap dipakai karena lucide-react 1.31 tidak punya ikon merek. Pembungkusnya `nav.article-social-links` dengan `aria-label`, tab baru, `noopener noreferrer`.
- `app/globals.css`: aturan `.article-social` dan `h2` dihapus; `.article-social-links` tetap flex membungkus dengan celah 12px dan margin atas 24px.
- Teks bantuan editor, `DESIGN.md`, `PRODUCT.md`, `docs/integrasi.md`, dan `scripts/test-public-news.mjs` disesuaikan.

Verifikasi:
- lint (0 error, 1 warning lama), tsc, build, build:demo, test:demo: lulus.
- Uji browser (Laravel :8010 SQLite sementara, akun KIM fiktif, static export :3010) pada 390px dan 1440px: keempat tombol tampil berurutan. Gaya terhitungnya identik dengan tombol Chat WhatsApp UMKM: latar `rgb(47, 90, 39)`, teks putih, tinggi 53px, radius 10px, 17px/700. Tanpa scroll horizontal; screenshot diperiksa visual.
- Tidak ada berkas yang diunggah ke storage; `out/` dibangun ulang dengan env bawaan.
- Backend tidak diubah.

## Pembaruan: teks usang di editor berita terbit

Laporan pengguna: editor berita berstatus terbit masih menampilkan "Tautan website disiapkan untuk halaman publik CMS (C4), yang belum tersedia." Halaman publik `/berita/baca/?slug=…` sudah ada sejak C4, dan tombol "Lihat di website" ke alamat itu sudah tampil tepat di atas kalimat tersebut.

- Kalimat usang dihapus dari `features/admin/news-editor.tsx`. Tombol "Lihat di website" ditambah keterangan pembaca layar "(dibuka di tab baru)". Tidak ada tes atau dokumen lain yang merujuk kalimat itu.
- Verifikasi: lint (0 error, 1 warning lama), tsc, build, build:demo, test:demo lulus.
- Tombol dan alamatnya sudah dipakai uji browser sebelumnya (skrip E2E membaca `href` tombol ini lalu membuka halaman publik). Setelah perubahan ini, uji browser ulang tidak dijalankan karena hanya menghapus satu paragraf.
