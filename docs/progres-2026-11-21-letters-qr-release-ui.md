# Progres V3 — layar alur rilis surat QR (21 November 2026)

Branch: `feat/letters-qr-release-ui`, dari `origin/main` @ `90785dc` (`main` lokal tertinggal). Acuan: `docs/PROMPTS-REVISI-SURAT2.md` § Keputusan dan V3. Tidak ada perubahan kontrak API; V2 sudah mengirim `valid_until` ke cek status, verifikasi, dan panel.

## Perubahan

- **Teks alur** (`app/pelayanan/page.tsx`, `app/page.tsx`, `app/pelayanan/[service]/page.tsx`, `features/pelayanan/application-form.tsx`, `features/pelayanan/success.tsx`, `README.md`): "Kepala desa menyetujui → surat langsung bisa diunduh dan dicetak sendiri. Berlaku 7 hari." Semua penyebutan tanda tangan basah, stempel, unggah scan surat oleh petugas, dan masa unduh 30 hari dihapus. "Scan Surat Pengantar RT/RW" (persyaratan warga) tetap.
- **Linimasa** (`lib/letter-workflow.ts`, `components/site.tsx`): tahap Disetujui dan Siap diunduh digabung menjadi "Disetujui, siap diunduh" dengan deskripsi "Surat sudah bisa diunduh dan dicetak. Berlaku sampai {tanggal}." `timelineStatus()` memetakan `APPROVED` lama ke tahap gabungan; deskripsi `APPROVED` lama mengarahkan ke kantor desa tanpa menyebut tanda tangan.
- **Cek status** (`features/pelayanan/status-checker.tsx`): `{tanggal}` dari `valid_until` (demo: `letter_available_until`). Tombol unduh menampilkan "Berlaku sampai …". Setelah lewat: "Masa berlaku surat sudah habis. Ajukan ulang bila masih diperlukan."
- **Verifikasi** (`features/pelayanan/letter-verifier.tsx`): hijau **SAH** + "Berlaku sampai", kuning **KEDALUWARSA** + "Kedaluwarsa sejak", merah **DIBATALKAN**. Menampilkan nomor, jenis, nama lengkap, tanggal rilis, dan "Cocokkan nama dan nomor dengan surat yang Anda terima." Warna memakai kelas status yang sudah ada (`READY_FOR_PICKUP`, `NEED_REVISION`, `REJECTED`); tidak ada token/CSS baru. Klaim "surat sah ditandatangani dan distempel" dihapus; "bukan TTE tersertifikasi" tetap.
- **Panel** (`features/admin/application-detail.tsx`, `applications-table.tsx`): kartu "Surat bertanda tangan" menjadi "Surat dirilis {tanggal} WIB, berlaku s.d. {tanggal} WIB" + jumlah/waktu unduhan warga dan sumber berkas. Ganti PDF dipindah ke `<details>` "Ganti PDF (perbaikan manual)", hanya tampil untuk `READY_FOR_PICKUP`/`COMPLETED` selama masa berlaku (selaras `LETTER_UPLOAD_STATUSES`; server tetap memutuskan). Tombol unduh panel: "Unduh PDF surat".
- **Email** (`backend/`): baris status pemohon Siap diunduh menjadi "Surat Anda sudah disetujui Kepala Desa dan bisa diunduh serta dicetak sendiri di halaman cek status. Berlaku sampai {valid_until}." (listener memakai `valid_until`, fallback batas unduh). Email kades menambah "Bila Anda setuju, surat ber-QR langsung dirilis … berlaku 7 hari sejak dirilis." Templat tidak memuat teks tanda tangan basah. Tes `ApplicantStatusEmailTest` dan `HeadEmailApprovalTest` diperbarui.
- **Privasi** (`app/kebijakan-privasi/page.tsx`): unduhan 7 hari = masa berlaku; butir baru "Verifikasi QR surat": siapa pun yang memindai QR melihat nama lengkap, nomor, jenis, tanggal rilis, batas berlaku, dan status, tanpa NIK/KK/alamat.
- `scripts/test-demo.mjs`: urutan linimasa baru dan `timelineStatus`.

## Verifikasi (benar-benar dijalankan)

- `npm run lint`: 0 error, 1 warning lama (`app/components/LembagaList.tsx`, `<img>`), tidak terkait.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus. `npm run build:demo`: lulus. `npm run test:demo`: lulus.
- `php artisan test --compact`: 528 tes lulus, 25.456 assertions. (Run pertama tumpang-tindih dengan run latar belakang yang belum berhenti sehingga tes lampiran gagal karena berkas bersama; diulang sendiri, lulus.)
- **Uji alur penuh lokal** (Laravel :8010 dengan SQLite sementara di scratchpad, `MAIL_MAILER=log`, akun fiktif; static export :3010; Chrome headless via CDP):
  - Ajukan DOMISILI fiktif lewat API publik (bukan isi formulir di UI) → staf VERIFIED → PROCESSING → WAITING_APPROVAL → kades APPROVED: respons langsung `READY_FOR_PICKUP`.
  - Cek status UI 390/1440: "Disetujui, siap diunduh", "Berlaku sampai 28 November 2026 pukul 12.44 WIB". Klik Unduh → PDF tersimpan (`%PDF-`), status Selesai.
  - Panel detail 390/1440: "Surat dirilis …, berlaku s.d. …", unduhan warga 1, Ganti PDF sekunder.
  - `/verifikasi/?kode=…` 390/1440: SAH + nama lengkap.
  - "+8 hari": jam server **tidak** diubah; `approved_at`/`ready_at`/`valid_until` di DB sementara digeser mundur 8 hari. Verifikasi → KEDALUWARSA; cek status → "Masa berlaku surat sudah habis…"; unduh warga → HTTP 410.
  - Nomor di-`void` di DB sementara → DIBATALKAN.
  - Tidak ada scroll horizontal pada 390/1440; screenshot diperiksa visual.
  - Berkas fiktif yang tertulis ke `backend/storage/app/private` saat uji dihapus; DB dev dan server :3000/:8000 tidak disentuh.
- **Belum**: scan QR dengan HP sungguhan (diganti membuka URL verifikasi di Chrome headless).

## Sisa / keputusan

- `scripts/test-online-letter-browser.mjs` masih memakai alur unggah scan lama (pra-V2) dan akan gagal; perlu diperbarui di sesi terpisah.
- Pada status kedaluwarsa, pesan habis masa berlaku tampil dua kali (pemberitahuan + Langkah berikutnya), mengikuti pola lama; bisa dirapikan bila diinginkan.
- Penerimaan surat ber-QR oleh instansi luar desa tetap perlu verifikasi operasional.
