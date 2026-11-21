# Progres 21 November 2026 — V1: Izin Keramaian dilayani di Balai Desa

Branch `feat/keramaian-offline` (dari `main` @ `a091fec`). Rancangan: `docs/PROMPTS-REVISI-SURAT2.md` § V1 (di-commit lebih dulu).

## Lingkup

- **Backend:** `LetterType::Keramaian->isOffered()` false (pola SKU/KTP_KK). Pesan 422 per jenis lewat `LetterType::notOfferedMessage()`; KERAMAIAN: "Izin Keramaian dilayani langsung di Balai Desa." Enum, template PDF, `requiresFullPersonalData()`, `specificFields()`, dan data lama tidak berubah.
- **Frontend:** `services` di `lib/data.ts` mendapat `mode: "online" | "office"`. KERAMAIAN tetap tampil di daftar layanan dengan pill "Layanan di kantor", daftar "Dokumen yang dibawa ke Balai Desa", dan tautan "Datang ke Balai Desa" (layanan lain: "Ajukan online").
- `/pelayanan/keramaian/`: kartu "Dilayani langsung di Balai Desa" (alamat + jam pelayanan dari `useContact`), aside "Dokumen yang dibawa" (KTP, Kartu Keluarga, Surat Pengantar RT/RW asli — "Menunggu konfirmasi desa"), dan `HubungiPetugas`. Tanpa field input.
- `offeredServiceCodes` tanpa KERAMAIAN; Zod (dipakai juga demo) menolak KERAMAIAN dengan pesan yang sama dengan API. Cabang KERAMAIAN di formulir dan validasi tanggal keramaian dihapus (tidak lagi bisa dicapai).

## File

`backend/app/Domain/LetterType.php`, `backend/app/Domain/LetterSubmission.php`, `backend/tests/Feature/LetterTypesTest.php`, `backend/README.md`, `docs/integrasi.md`, `types/pelayanan.ts`, `lib/data.ts`, `lib/validation.ts`, `features/pelayanan/application-form.tsx`, `components/service-list.tsx`, `app/pelayanan/[service]/page.tsx`, `app/globals.css` (judul kartu 26px/800 seperti kartu persiapan, tanpa warna baru), `scripts/test-demo.mjs`.

## Tes yang diubah

- Baru: `test_keramaian_is_served_at_village_hall_not_online` (422 + pesan, tidak ada baris/lampiran tersimpan).
- Dihapus karena perilakunya sengaja tidak ada lagi: `test_keramaian_dates`, `test_keramaian_does_not_require_but_still_validates_personal_choices`, baris KERAMAIAN di `requiredFields` dan `fields_belonging_to_another_type`.
- Detail petugas dan retensi memakai KERAMAIAN **data lama** yang dibuat langsung di database (`legacyKeramaian()`), bukan lewat POST. Tes PDF KERAMAIAN tetap tanpa perubahan.
- `test-demo.mjs`: lima payload online; KERAMAIAN terdaftar sebagai `office`; demo menolak KERAMAIAN dengan pesan Balai Desa; halaman office tanpa `input/select/textarea/form`.

## Verifikasi (benar-benar dijalankan)

- `php artisan test`: lulus, 500 tes / 25.140 asersi.
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo`: lulus.
- Visual (Chrome headless via DevTools, build demo): `/pelayanan/keramaian/` dan `/pelayanan/` pada 390px dan 1440px. Tidak ada scroll horizontal (scrollWidth = clientWidth), kartu dan pill tampil sesuai.

## Sisa / keputusan

- Daftar dokumen yang dibawa dan jam layanan masih menunggu konfirmasi desa.
- Langkah "Cara mengajukan surat" dan teks alur tanda tangan basah di `/pelayanan` belum diubah (bagian V3).
- `PRODUCT.md` (lokal Tech Lead) perlu catatan bahwa Izin Keramaian sekarang layanan di kantor.
