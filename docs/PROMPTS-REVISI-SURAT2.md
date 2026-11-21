# Revisi Alur Surat (21 Nov 2026) — Prompt V1–V3 + Rencana Berbagi Berita dan Backup

> Terhadap `main` @ `367b173` (O1–O2, E1–E4 selesai). Pengerasan keamanan (H1) dipindah ke **akhir**, setelah fitur di dokumen ini selesai.
>
> Pakai **Pembuka** dari `PROMPTS-FINALISASI.md`. Satu prompt = satu sesi = satu branch/PR.

## Keputusan

| # | Keputusan |
|---|---|
| 1 | **Izin Keramaian dilayani langsung di Balai Desa.** Tidak ada formulir online; halaman layanan berisi pemberitahuan, jam layanan, dan kontak. |
| 2 | **Setelah kepala desa menyetujui, surat langsung bisa diunduh/dicetak.** Tidak ada lagi tanda tangan basah dan unggah scan oleh petugas. Penanda keaslian adalah **QR** yang mengarah ke halaman verifikasi website resmi (keputusan Sekdes). |
| 3 | QR dipindah ke **tengah blok tanda tangan** (di antara "Kepala Desa Watuagung" dan nama), menggantikan ruang tanda tangan. |
| 4 | Di bawah QR: **"Masa surat efektif berlaku 7 hari sejak surat dirilis oleh Pelayanan Desa Watuagung"** + tanggal batasnya. |
| 5 | Masa unduh disamakan dengan masa berlaku: **7 hari** (`LETTER_DOWNLOAD_DAYS=7`). Mengunduh surat yang sudah tidak berlaku tidak ada gunanya; warga mengajukan ulang. |
| 6 | Halaman verifikasi menjadi satu-satunya bukti keaslian, jadi harus menampilkan **Sah / Kedaluwarsa / Dibatalkan**, nomor, jenis, tanggal rilis, batas berlaku, dan **nama lengkap** pemohon (bukan disamarkan) agar penerima bisa mencocokkan dengan surat cetak. Kode QR 32 karakter acak, tidak bisa ditebak. |

**Konsekuensi yang perlu disadari desa (tidak memblokir):**
- Surat cetak bisa difotokopi atau diedit, dan QR-nya bisa ditempel ke surat palsu. Satu-satunya pengaman adalah **penerima surat benar-benar memindai QR dan mencocokkan isinya**. Karena itu poin 6 penting, dan teks di bawah QR mengajak penerima memindai.
- Surat Kehilangan dan Belum Menikah punya kolom **"Yang bersangkutan"**. Usulan: kolom itu tetap ada sebagai ruang tanda tangan pemohon sendiri setelah mencetak (pernyataan pemohon), sedangkan tanda tangan kepala desa digantikan QR. Konfirmasi ke Sekdes bila kolom itu ingin dihapus.
- Penerima surat di luar desa (sekolah, KUA) mungkin belum terbiasa dengan surat ber-QR tanpa tanda tangan basah. Bila ada penolakan, warga bisa datang ke Balai Desa (jalur "Hubungi Petugas").

## Urutan sesi

| Sesi | Isi | Ukuran |
|---|---|---|
| V1 | Izin Keramaian menjadi layanan di kantor | Kecil |
| V2 | Backend: siap unduh saat disetujui, masa berlaku 7 hari, verifikasi, template QR tengah | Sedang |
| V3 | Frontend: teks alur, cek status, verifikasi, panel | Sedang |
| (rencana) | Berbagi berita ke media sosial — lihat § Rencana A | — |
| (rencana) | Backup yang bisa diunduh admin — lihat § Rencana B | — |
| H1 | Pengerasan keamanan (`PROMPTS-DEPLOY.md`) — setelah semua di atas | Kecil–sedang |

V1 boleh paralel dengan V2. V3 setelah V2.

---

## V1 — Izin Keramaian dilayani di Balai Desa

Branch: `feat/keramaian-offline` · Ukuran kecil.

```text
## Tujuan
Izin Keramaian tidak lagi diajukan online; warga diarahkan ke Balai Desa.
Rancangan: docs/PROMPTS-REVISI-SURAT2.md (commit dulu).

## Tugas
1. Backend: KERAMAIAN dibuat tidak ditawarkan (LetterType::isOffered()
   false, pola yang sama dengan SKU/KTP_KK) → POST pengajuan baru 422
   dengan pesan "Izin Keramaian dilayani langsung di Balai Desa." Enum,
   template, data lama, dan tes lama tetap. Tambah tes 422.
2. lib/data.ts services: KERAMAIAN tetap tampil di daftar layanan dengan
   penanda "Layanan di kantor" (atau properti mode: "office"), bukan
   formulir.
3. app/pelayanan/[service]/page.tsx: untuk layanan mode office, ganti
   formulir dengan kartu "Dilayani langsung di Balai Desa": alamat, jam
   pelayanan (useContact), dokumen yang dibawa (KTP, KK, Surat Pengantar
   RT/RW asli — tandai "menunggu konfirmasi desa" bila belum pasti),
   dan komponen HubungiPetugas. Tanpa field input apa pun.
4. /pelayanan: kartu Izin Keramaian menunjukkan "Datang ke Balai Desa"
   alih-alih "Ajukan online".
5. Demo mode dan scripts/test-demo.mjs mengikuti.

## Selesai jika
php artisan test, lint, tsc, build, build:demo, test:demo lulus; cek
390px/1440px halaman Izin Keramaian.
Commit: feat: serve crowd permit in person at village hall
```

---

## V2 — Backend: surat langsung siap unduh setelah disetujui

Branch: `feat/letters-qr-release` · Tulis rencana dulu, tunggu persetujuan.

```text
## Tujuan
Persetujuan kepala desa (dari panel ATAU email) langsung merilis surat:
PDF sistem ber-QR bisa diunduh pemohon selama 7 hari dan diverifikasi
publik. Rancangan: docs/PROMPTS-REVISI-SURAT2.md § Keputusan.

## Tugas
1. Transisi WAITING_APPROVAL → APPROVED (StaffController dan jalur
   email E3) langsung diteruskan dalam transaksi yang sama ke
   READY_FOR_PICKUP ("Siap diunduh"): PDF final dibuat dari template,
   disimpan terenkripsi, letter.source = 'system', ready_at = waktu
   persetujuan. Satu event riwayat "Disetujui dan dirilis" (atau dua
   event berurutan — pilih, jelaskan). Notifikasi email pemohon (E1)
   terkirim satu kali untuk status akhir ini, bukan dua.
2. Unduhan warga (POST /v1/applications/letter): izinkan source
   'system' maupun 'uploaded'. Masa unduh dari config
   letters.download_days, bawaan dan .env.production.example → 7.
3. Unggah scan oleh petugas: tidak lagi wajib dan tidak lagi
   mengubah status. Pertahankan endpoint sebagai cadangan "Ganti PDF"
   (mis. perbaikan manual) hanya selama masa berlaku; jelaskan di
   rencana bila lebih baik dihapus.
4. Masa berlaku: tambah `valid_until` = ready_at + 7 hari
   (letters.validity_days, env LETTER_VALIDITY_DAYS=7) — terpisah dari
   download_days walau nilainya sama sekarang.
5. Template (resources/views/letters/layout.blade.php):
   - Blok tanda tangan kanan: "Watuagung, {tanggal}" / "Kepala Desa
     Watuagung" / QR di tengah (ukuran ±2,5 cm, menggantikan ruang
     tanda tangan) / nama kepala desa tebal bergaris bawah.
   - Di bawah nama, teks kecil rata tengah: "Masa surat efektif berlaku
     7 hari sejak surat dirilis oleh Pelayanan Desa Watuagung (berlaku
     s.d. {d F Y})." dan "Scan QR untuk memeriksa keaslian surat di
     desawatuagung.com." Hapus "QR bukan tanda tangan elektronik" dan
     kata "Pindai".
   - KEHILANGAN dan BELUM_MENIKAH: kolom kiri "Yang bersangkutan" tetap
     dengan ruang kosong untuk tanda tangan pemohon; kolom kanan seperti
     di atas. Tetap 1 halaman A4.
6. Verifikasi GET /v1/verify/{code}: tambah valid_until dan status
   'valid' | 'expired' | 'revoked' (expired bila sekarang > valid_until);
   nama dikembalikan LENGKAP (bukan maskName) agar bisa dicocokkan
   dengan surat cetak. Tetap no-store dan throttle.
7. letters:expire-downloads tetap menutup READY_FOR_PICKUP yang lewat
   masa unduh → COMPLETED.
8. Tes: setuju dari panel dan dari email → Siap diunduh + PDF ada;
   unduh oleh warga tanpa unggah scan; masa unduh 7 hari; verifikasi
   valid/expired/revoked + nama lengkap; email pemohon satu kali; teks
   QR di PDF (cek teks); 1 halaman. SQLite + MariaDB.
9. docs/integrasi.md, backend/README.md, PRODUCT.md (alur baru),
   deploy/hostinger.md (ubah LETTER_DOWNLOAD_DAYS=7 di .env server).

Commit: feat(api): release QR letter on approval with 7-day validity
```

---

## V3 — Frontend: alur rilis langsung

Branch: `feat/letters-qr-release-ui` · Setelah V2. Tulis rencana dulu.

```text
## Tujuan
Teks dan layar mengikuti alur: disetujui = langsung bisa diunduh, berlaku
7 hari, keaslian lewat QR.

## Tugas
1. /pelayanan langkah-langkah: "Kepala desa menyetujui → surat langsung
   bisa diunduh dan dicetak sendiri. Berlaku 7 hari." Hapus semua
   penyebutan tanda tangan basah dan unggah scan surat oleh petugas
   (grep "tanda tangan", "scan surat", "bertanda tangan").
2. Label status (components/site.tsx, lib/letter-workflow.ts): tahap
   "Disetujui" dan "Siap diunduh" digabung di linimasa warga; deskripsi
   Siap diunduh: "Surat sudah bisa diunduh dan dicetak. Berlaku sampai
   {tanggal}."
3. Cek status: tombol unduh menampilkan batas berlaku; setelah lewat:
   "Masa berlaku surat sudah habis. Ajukan ulang bila masih diperlukan."
4. Halaman verifikasi (/verifikasi/): tampilan jelas tiga keadaan —
   hijau "SAH" + "Berlaku sampai {tanggal}", kuning "KEDALUWARSA sejak
   {tanggal}", merah "DIBATALKAN"; tampilkan nomor, jenis, nama lengkap,
   tanggal rilis; kalimat "Cocokkan nama dan nomor dengan surat yang
   Anda terima."
5. Panel detail permohonan: kartu "Surat bertanda tangan" (O2) diganti
   "Surat dirilis {tanggal}, berlaku s.d. {tanggal}" + riwayat unduhan;
   unggah PDF pengganti hanya sebagai tindakan sekunder (bila V2
   mempertahankannya).
6. Email pemohon dan email kades: teks mengikuti alur baru (cek
   templat Mailable bila ada teks tanda tangan basah).
7. Kebijakan privasi: halaman verifikasi menampilkan nama lengkap kepada
   siapa pun yang memindai QR surat.

## Selesai jika
lint, tsc, build, build:demo, test:demo lulus; uji alur penuh dengan
Laravel lokal (data fiktif): ajukan → verifikasi → proses → kades setuju
→ unduh → scan QR dengan HP → "SAH" → ubah waktu server +8 hari →
"KEDALUWARSA". Cek 390px/1440px.
Commit: feat(web): instant letter release with QR validity
```

---

## Rencana A — Berbagi berita ke media sosial (belum jadi prompt)

**Tujuan:** berita desa mudah disebarkan ke Instagram, TikTok, dan Facebook, dan pengunjung bisa menemukan akun resmi desa.

**Dua bagian:**

1. **Tombol bagikan di setiap berita** (pola sama dengan tombol WhatsApp di UMKM):
   - **WhatsApp** — `https://wa.me/?text=<judul + tautan>`.
   - **Facebook** — `https://www.facebook.com/sharer/sharer.php?u=<tautan>`.
   - **Instagram dan TikTok tidak punya tautan "bagikan" untuk web.** Yang bisa: tombol **"Bagikan"** memakai Web Share API di HP (membuka lembar bagikan bawaan HP, termasuk aplikasi Instagram/TikTok bila terpasang) dan tombol **"Salin tautan"**. Untuk unggahan rutin, KIM tetap memposting manual di aplikasinya.
2. **Akun resmi desa**: tautan Instagram, TikTok, Facebook di footer dan halaman berita ("Ikuti kami"). Diisi dari panel (key `site_sections` baru `social`, dikelola admin/staff/KIM; URL divalidasi domain masing-masing). Kosong = tidak tampil.

**Kendala teknis yang harus dipecahkan:** pratinjau tautan (judul, ringkasan, foto) di WhatsApp/Facebook dibaca dari meta tag Open Graph tanpa menjalankan JavaScript. Halaman berita sekarang `/berita/baca/?slug=…` (static export, isi dimuat di browser), jadi pratinjau akan selalu menampilkan judul umum situs. Solusi: endpoint Laravel ringan `GET /bagikan/berita/{slug}` yang mengembalikan HTML kecil berisi meta `og:title`, `og:description`, `og:image` (foto sampul) lalu langsung mengarahkan pengunjung ke `/berita/baca/?slug=…`. Tombol bagikan memakai URL ini. Perlu aturan `.htaccess` agar `/bagikan/` diteruskan ke Laravel.

**Pertanyaan sebelum dijadikan prompt:** alamat akun resmi desa di ketiga platform; apakah UMKM juga perlu tombol bagikan yang sama.

**Perkiraan:** 2 sesi (backend OG + key `social`; frontend tombol + footer).

---

## Rencana B — Backup yang bisa diunduh admin (belum jadi prompt)

**Tujuan:** admin desa memegang salinan data sendiri yang bisa diunduh dan dipindahkan (laptop kantor, flashdisk, Google Drive desa), sekaligus menjaga kapasitas hosting 20 GB dan kotak surat 1 GB.

**Dua jenis unduhan di panel (menu baru "Cadangan data", hanya admin):**

1. **Arsip register (bisa dibaca langsung)** — untuk arsip administrasi desa: buku register surat (nomor, jenis, tanggal, nama pemohon, status) per bulan/tahun dalam **CSV** (bisa dibuka di Excel). Tanpa NIK, KK, alamat, atau scan. Aman disimpan di komputer kantor.
2. **Cadangan lengkap (untuk pemulihan)** — database + file (scan, PDF surat, foto berita/UMKM) dalam satu arsip **ZIP terenkripsi**:
   - dibuat di server oleh perintah antre (bukan saat klik, agar tidak timeout di shared hosting), lalu admin diberi tautan unduh sekali pakai yang kedaluwarsa 24 jam; file di server dihapus setelah diunduh atau 24 jam;
   - admin memasukkan **kata sandi cadangan** saat membuat; tidak disimpan di server. Tanpa kata sandi itu arsip tidak bisa dibuka;
   - isi data pribadi di dalamnya tetap terenkripsi `APP_KEY`, sehingga pemulihan juga butuh `APP_KEY` dari password manager desa — tulis jelas di panel;
   - ekspor dilakukan dengan PHP/Laravel (tidak bergantung `mysqldump`, yang bisa tidak tersedia untuk PHP di shared hosting);
   - setiap pembuatan dan unduhan tercatat di audit.

**Menjaga kapasitas:**
- Rotasi backup otomatis di server (`deploy/backup.sh`) dikurangi menjadi misalnya 7 harian + 4 mingguan setelah admin rutin mengunduh cadangan bulanan.
- Panel menampilkan pemakaian disk (database, scan, surat, media, backup) agar admin tahu kapan harus membersihkan.
- Penghapusan otomatis yang sudah ada (scan 30 hari, surat setelah masa unduh) tetap menjadi penghemat utama.
- **Kotak surat 1 GB:** `notifikasi@` hanya mengirim lewat SMTP, dan pengiriman SMTP Laravel tidak menyimpan salinan di folder Sent. Yang bisa menumpuk adalah balasan warga dan email pantulan (alamat salah). Atur di hPanel: penerusan atau penghapusan otomatis untuk kotak masuk `notifikasi@`, dan cantumkan "Email ini tidak dipantau — hubungi petugas lewat WhatsApp" di setiap email.

**Pertanyaan sebelum dijadikan prompt:** siapa yang memegang kata sandi cadangan; seberapa sering cadangan diunduh (usul: bulanan); ke mana disimpan (usul: Google Drive akun desa, bukan flashdisk pribadi).

**Perkiraan:** 2–3 sesi (ekspor register CSV; cadangan lengkap terenkripsi + antrean; tampilan pemakaian disk).
