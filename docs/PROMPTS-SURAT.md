# Layanan Surat Final — Rancangan dan Prompt Sesi S1–S4

> Keputusan 8 Nov 2026: layanan surat yang **tetap (fix)** adalah enam jenis sesuai contoh surat dari desa. Rancangan ini menggantikan F9b. Dipetakan terhadap `main` @ `7e87fe0` (R1–R10 selesai).
>
> **Contoh surat dari desa berisi data warga asli (nama, NIK, No. KK).** File `.doc` aslinya JANGAN di-commit ke repo, dilampirkan ke agent, atau dipakai sebagai data tes. Semua yang dibutuhkan agent sudah disarikan di dokumen ini dengan data fiktif.

---

## Enam jenis surat

| Kode | Judul surat | Ganti dari | Isi khusus selain data diri |
|---|---|---|---|
| `DOMISILI` | SURAT KETERANGAN DOMISILI | Domisili lama | — (keterangan: berdomisili di alamat pemohon) |
| `BELUM_MENIKAH` | SURAT KETERANGAN BELUM MENIKAH | baru | — (keterangan: belum pernah menikah di KUA manapun) |
| `SKTM` | SURAT KETERANGAN TIDAK MAMPU | SKTM lama | Keperluan (mis. "Pendaftaran PIP") |
| `KERAMAIAN` | SURAT KETERANGAN IZIN KERAMAIAN | baru | Acara, tempat, tanggal mulai–selesai, jenis hiburan, nomor telepon |
| `KEHILANGAN` | SURAT KETERANGAN KEHILANGAN | baru | Barang/dokumen yang hilang |
| `UMUM` | SURAT KETERANGAN | baru | Isi keterangan + tujuan penggunaan |

**Dihapus dari layanan online:** `SKU` (Surat Keterangan Usaha) dan `KTP_KK` (pengantar KTP/KK). Kode enum tetap ada agar data lama/tes tidak rusak, tetapi tidak bisa diajukan lagi.

### Data diri yang tercantum di surat

Urutan di surat: Nama · Jenis kelamin · Tempat/tgl. lahir · Agama · Kewarganegaraan · Status perkawinan · Pendidikan · Pekerjaan · Nomor NIK · Nomor KK (di surat tertulis "Nomor KSK") · Alamat (Dusun, RT, RW, Desa Watuagung Kec. Prigen Kab. Pasuruan).

| Field | Sudah ada? | Isian | Keterangan |
|---|---|---|---|
| nama, jenis_kelamin, tempat_lahir, tanggal_lahir, nik, no_kk, alamat, rt, rw, telepon | Ada | — | NIK, KK, alamat, telepon, tempat/tgl lahir sudah terenkripsi |
| `dusun` | **Baru** | Pilihan: Watuagung, Talang, Sekar | Alamat di surat ditulis "Dusun … RT … RW …" |
| `agama` | **Baru** | Pilihan: Islam, Kristen, Katolik, Hindu, Buddha, Konghucu, Kepercayaan terhadap Tuhan YME | **Dienkripsi** (data sensitif) |
| `kewarganegaraan` | **Baru** | WNI / WNA, bawaan WNI → dicetak "Indonesia" | Contoh desa menulis "Jawa / Indonesia" — **suku tidak dikumpulkan** |
| `status_perkawinan` | **Baru** | Belum Kawin, Kawin, Cerai Hidup, Cerai Mati | **Dienkripsi** |
| `pendidikan` | **Baru** | Pilihan baku KK: Tidak/Belum Sekolah, Belum Tamat SD/Sederajat, Tamat SD/Sederajat, SLTP/Sederajat, SLTA/Sederajat, Diploma I/II, Akademi/Diploma III/Sarjana Muda, Diploma IV/Strata I, Strata II, Strata III | |
| `pekerjaan` | **Baru** | Teks bebas ≤ 60 karakter, dengan saran (Pelajar/Mahasiswa, Karyawan Swasta, Petani/Pekebun, Wiraswasta, Mengurus Rumah Tangga, …) | |

**Kecuali Izin Keramaian:** surat ini hanya memuat nama, tempat/tgl lahir, jenis kelamin, kewarganegaraan, alamat, nomor telepon, dan maksud. Namun NIK dan KK tetap diminta untuk verifikasi petugas (tidak dicetak).

### Isian khusus per jenis

| Jenis | Field baru | Validasi |
|---|---|---|
| SKTM | `keperluan` (sudah ada) | wajib, ≤ 200 |
| KEHILANGAN | `barang_hilang` | wajib, ≤ 200 (mis. "KTP", "Buku Nikah") |
| KERAMAIAN | `acara`, `tempat_acara`, `tanggal_mulai`, `tanggal_selesai`, `jenis_hiburan` | acara/tempat/hiburan wajib ≤ 120; tanggal mulai ≥ hari ini, selesai ≥ mulai, rentang ≤ 7 hari |
| UMUM | `isi_keterangan`, `keperluan` | isi ≤ 500, keperluan ≤ 200; **petugas dapat menyunting isi_keterangan** sebelum surat dibuat (kalimat ini dicetak sebagai pernyataan resmi desa) |
| DOMISILI, BELUM_MENIKAH | — | `keperluan` tetap diisi warga untuk catatan petugas, tidak dicetak |

Semua field baru teks bebas disimpan sebagai teks biasa (dirender aman). Field baru yang hanya relevan untuk satu jenis disimpan **nullable**, bukan kolom wajib.

### Nomor surat

Semua contoh memakai `470/{urut}/424.314.2.02/{tahun}` — kode klasifikasi 470 untuk keenam jenis, tanpa bulan romawi. Penomoran sekarang sudah satu urutan per tahun untuk semua jenis; itu dipertahankan.

- `letters.format` → `{kode_klasifikasi}/{urut}/{kode_desa}/{tahun}`
- `letters.kode_desa` → `424.314.2.02`
- `kode_klasifikasi` → `470` untuk keenam jenis
- ⚠️ Contoh Izin Keramaian memakai `35.314.10.2.02`; dianggap salah ketik, pakai `424.314.2.02` (lihat Pertanyaan 2).

### Kop dan tanda tangan

- Kop: logo Kabupaten Pasuruan (kiri) · "PEMERINTAH KABUPATEN PASURUAN" · "KECAMATAN PRIGEN" · **"KEPALA DESA WATUAGUNG"** (besar, tebal) · "Jl. Taman Safari II No. 01 Desa Watuagung Kec. Prigen Tlp. (0343) 7660001 Kode Pos 67157" · garis ganda di bawah.
- Logo: `logo-kabupaten-pasuruan.jpg` (diekstrak dari contoh surat desa, 206×245 px) → simpan di `backend/resources/letters/logo-kabupaten-pasuruan.jpg`.
- Judul bergaris bawah, tebal; nomor di bawahnya.
- Pembuka: "Yang bertanda tangan di bawah ini Kepala Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan, menerangkan dengan sebenarnya bahwa :"
- Tanggal: "Watuagung, {d F Y}" (contoh SKTM menulis "Pasuruan" — diseragamkan "Watuagung").
- Tanda tangan kanan: "Kepala Desa Watuagung" + nama tebal bergaris bawah. **KEHILANGAN dan BELUM_MENIKAH** juga punya kolom kiri "Yang bersangkutan" + nama pemohon.
- QR verifikasi tetap di kiri bawah (untuk dua tanda tangan: di bawah kolom "Yang bersangkutan").
- Kalimat penutup per jenis mengikuti contoh (lihat prompt S2).

---

## Pertanyaan ke desa (tidak memblokir S1–S4)

1. SKU dan pengantar KTP/KK benar-benar dihapus dari layanan online?
2. Kode di nomor Izin Keramaian `35.314.10.2.02` salah ketik, atau memang berbeda?
3. Surat Keterangan Umum: contoh desa juga berisi keterangan tanah, riwayat tanah, nikah siri, kematian, dan surat ke bank. Saran: surat-surat itu **tetap dilayani langsung di kantor**, karena butuh pemeriksaan dokumen dan saksi. Online hanya untuk keterangan tentang diri pemohon (mis. "bekerja di Surabaya", "memiliki kesenian ludruk").
4. Persyaratan dokumen tiap jenis (KTP/KK asli? pengantar RT?) — sementara ditulis "Bawa KTP dan KK asli saat mengambil surat".
5. Untuk Izin Keramaian: apakah perlu tembusan ke Polsek/Koramil di surat?

---

## Urutan sesi

| Sesi | Isi | Ukuran | Bergantung pada |
|---|---|---|---|
| S1 | Backend: jenis surat, field baru, validasi, nomor | Sedang | — |
| S2 | Backend: template PDF enam jenis + kop resmi | Sedang | S1 |
| S3 | Formulir warga + halaman layanan | Sedang | S1 |
| S4 | Panel petugas: tampilan field baru + sunting isi keterangan | Kecil–sedang | S1 (S2 untuk pratinjau) |

S2, S3, S4 boleh paralel setelah S1 di-merge. Pakai **Pembuka** dari `PROMPTS-FINALISASI.md`, lalu tambahkan: "Rancangan ada di docs/PROMPTS-SURAT.md (commit file ini lebih dulu); baca bagian yang disebut tugas."

---

## S1 — Backend jenis surat final

Branch: `feat/letters-final-types` · Tulis rencana dulu, tunggu persetujuan.

```text
## Tujuan
Backend menerima enam jenis surat final (docs/PROMPTS-SURAT.md bagian
"Enam jenis surat") dengan data yang dibutuhkan masing-masing.

## Tugas
1. App\Domain\LetterType: tambah BELUM_MENIKAH, KERAMAIAN, KEHILANGAN,
   UMUM. SKU dan KTP_KK tetap sebagai case, tapi `isOffered()` false →
   POST pengajuan baru dengan jenis itu 422. Tambahkan label resmi
   (judul surat) per jenis di satu tempat.
2. Migration: kolom nullable dusun, agama (text, terenkripsi),
   kewarganegaraan, status_perkawinan (text, terenkripsi), pendidikan,
   pekerjaan, barang_hilang, acara, tempat_acara, tanggal_mulai,
   tanggal_selesai, jenis_hiburan, isi_keterangan. Kolom usaha (SKU)
   tidak dihapus. Model: casts encrypted untuk agama dan
   status_perkawinan, keduanya masuk $hidden seperti NIK.
3. Validasi pengajuan per jenis sesuai tabel "Data diri" dan "Isian
   khusus per jenis" (enum untuk pilihan; data diri lengkap wajib untuk
   semua jenis kecuali KERAMAIAN yang tidak wajib agama, status
   perkawinan, pendidikan, pekerjaan; field yang bukan milik jenisnya
   ditolak/diabaikan — pilih satu, jelaskan di rencana). Pesan galat
   bahasa Indonesia.
4. config/letters.php: format `{kode_klasifikasi}/{urut}/{kode_desa}/{tahun}`,
   kode_desa `424.314.2.02`, kode_klasifikasi 470 untuk keenam jenis
   (SKU/KTP_KK juga 470 agar data lama tetap bisa diberi nomor).
   Hapus placeholder. Perbarui tes penomoran yang memakai bulan romawi.
5. Respons detail petugas memuat field baru (didekripsi); respons daftar
   dan cek status publik TIDAK memuat agama/status perkawinan.
6. Endpoint petugas untuk menyunting `isi_keterangan` (UMUM) selama
   status belum WAITING_APPROVAL, tercatat di application_events
   sebagai catatan "Isi keterangan disunting" (tanpa isi lama/baru di
   audit_logs).
7. Demo (services/pelayanan.ts) dan types/pelayanan.ts mengikuti
   kontrak baru; formulir belum diubah (S3).
8. Tes: tiap jenis sukses; field wajib per jenis; SKU/KTP_KK 422;
   enkripsi agama/status di database; daftar tidak membocorkan;
   tanggal keramaian; sunting isi keterangan (boleh/tidak boleh per
   status dan peran); nomor format baru. SQLite + PostgreSQL.
9. docs/integrasi.md, backend/README.md, ROADMAP (F9b diganti S1–S4).

## Batasan
Tanpa dependensi baru. Template PDF belum diubah (S2) — pastikan
pembuatan PDF untuk jenis baru tidak error (sementara boleh memakai
template generik).

Commit: feat(api): final letter types per village templates
```

---

## S2 — Template PDF enam jenis + kop resmi

Branch: `feat/letters-final-templates` · Setelah S1. Tulis rencana dulu.

```text
## Tujuan
PDF surat sama dengan format surat desa (docs/PROMPTS-SURAT.md bagian
"Kop dan tanda tangan"), dengan data fiktif saat diuji.

## Tugas
1. Simpan logo di backend/resources/letters/logo-kabupaten-pasuruan.jpg
   (file dari saya), sisipkan sebagai data URI di layout.
2. layout.blade.php: kop resmi (logo kiri, 4 baris teks, garis ganda),
   judul bergaris bawah, nomor, kalimat pembuka resmi, tabel data diri
   bernomor 1–11 dengan urutan dan label persis: Nama, Jenis Kelamin,
   Tempat/Tgl. Lahir (format dd-mm-yyyy), Agama, Kewarganegaraan,
   Status Perkawinan, Pendidikan, Pekerjaan, Nomor NIK, Nomor KSK,
   Alamat (Dusun … RT : xxx RW : xxx, baris kedua "Desa Watuagung
   Kecamatan Prigen Kabupaten Pasuruan"). RT/RW 3 digit.
   Hapus kalimat "Berdasarkan pengantar Ketua RT" (alur RT/RW sudah
   tidak dipakai).
3. Bagian "KETERANGAN :" bernomor per jenis:
   - DOMISILI: "Orang tersebut diatas adalah benar-benar berdomisili di
     Dusun {dusun} RT : {rt} RW : {rw} Desa Watuagung Kecamatan Prigen
     Kabupaten Pasuruan."
   - BELUM_MENIKAH: 1) benar-benar penduduk Desa Watuagung …; 2) "Orang
     tersebut di atas sampai saat ini belum pernah menikah di Kantor
     Urusan Agama (KUA) manapun."
   - SKTM: 1) benar-benar penduduk Dusun … RT … RW … Desa Watuagung …;
     2) "Keterangan ini dipergunakan untuk : {keperluan}."
   - KEHILANGAN: 1) benar-benar penduduk …; "Yang bersangkutan telah
     kehilangan : **{barang_hilang}**."
   - UMUM: "- Menerangkan dengan sebenarnya bahwa orang tersebut diatas
     benar-benar penduduk Desa Watuagung." + "- {isi_keterangan}"
     (versi yang sudah disunting petugas).
   - KERAMAIAN: format berbeda — tabel a–g (Nama Lengkap, Tempat/tgl
     lahir, Jenis Kelamin, Kewarganegaraan, Alamat, Nomor Telepon,
     Maksud), lalu "Nama tersebut diatas Bermaksud Permohonan ijin :"
     dan tabel Acara, Tempat, Hari/Tanggal (nama hari Indonesia, rentang
     bila > 1 hari, mis. "Selasa–Rabu, 06–07 Oktober 2026"), Jenis
     Hiburan. Tanpa NIK/KK di cetakan.
   Penutup: "Demikian Surat Keterangan ini diberikan kepada yang
   bersangkutan untuk dapat dipergunakan sebagaimana mestinya."
   (KERAMAIAN: "Demikian atas ijin permohonan ini kami sampaikan dan
   semoga dapat dipergunakan sebagaimana mestinya.")
4. Tanda tangan: "Watuagung, {tanggal}" + "Kepala Desa Watuagung" + nama
   kepala desa tebal bergaris bawah (dari config). KEHILANGAN dan
   BELUM_MENIKAH: dua kolom, kiri "Yang bersangkutan" + nama pemohon
   tebal bergaris bawah. QR verifikasi tetap ada; letakkan agar tidak
   menabrak tanda tangan; muat dalam 1 halaman A4 untuk isi normal.
5. Hapus template SKU/KTP_KK? TIDAK — biarkan agar surat lama tetap bisa
   dirender.
6. Tes: tiap jenis menghasilkan PDF berisi judul, nomor format baru, dan
   teks keterangan yang benar (cek teks, bukan visual); data fiktif saja.
7. Buat 6 PDF contoh dengan data fiktif ke folder temp (bukan repo) dan
   laporkan path-nya agar saya periksa visual terhadap surat asli.

Commit: feat(api): official letter templates for six letter types
```

---

## S3 — Formulir warga dan halaman layanan

Branch: `feat/letters-final-form` · Setelah S1. Tulis rencana dulu.

```text
## Tujuan
Warga bisa mengajukan enam jenis surat dengan formulir yang jelas dan
sesingkat mungkin.

## Tugas
1. lib/data.ts services: enam layanan sesuai tabel jenis surat (judul,
   deskripsi singkat, contoh keperluan). Persyaratan sementara: "Bawa
   KTP dan KK asli saat mengambil surat." dengan label "menunggu
   konfirmasi desa". Hapus SKU dan pengantar KTP/KK dari daftar, menu,
   beranda, dan tautan lain (grep).
2. Formulir dibagi langkah yang sudah ada; tambah bagian "Data diri
   tambahan" (dusun, agama, kewarganegaraan, status perkawinan,
   pendidikan, pekerjaan) dengan <select> untuk pilihan dan datalist
   saran untuk pekerjaan. Field khusus jenis muncul hanya untuk jenis
   itu. Teks bantuan:
   - Agama dan status perkawinan: "Dicetak di surat sesuai format desa.
     Disimpan terenkripsi."
   - UMUM isi keterangan: contoh "Bekerja di Surabaya" dan catatan
     "Petugas dapat menyesuaikan kalimat sebelum surat dibuat."
   - KERAMAIAN: tanggal mulai/selesai dengan input date; tidak meminta
     agama/status/pendidikan/pekerjaan.
3. Validasi Zod di frontend sama dengan backend (pesan bahasa
   Indonesia). Ringkasan sebelum kirim menampilkan semua isian.
4. Halaman sukses dan cek status memakai label jenis baru.
5. Demo mode mengikuti jenis baru; perbarui scripts/test-demo.mjs.
6. Kebijakan privasi: tambah agama, status perkawinan, pendidikan,
   pekerjaan ke daftar data yang dikumpulkan.

## Selesai jika
lint, tsc, build, build:demo, test:demo lulus. Uji dengan Laravel lokal:
satu pengajuan per jenis (data fiktif) sampai tersimpan. Cek 390px dan
1440px formulir untuk SKTM, KERAMAIAN, UMUM.
Commit: feat(web): application form for six final letter types
```

---

## S4 — Panel petugas untuk jenis baru

Branch: `feat/letters-final-admin` · Setelah S1. Ukuran kecil–sedang.

```text
## Tujuan
Petugas melihat semua data yang dicetak di surat dan dapat merapikan isi
Surat Keterangan Umum sebelum diajukan ke kepala desa.

## Tugas
1. Detail permohonan: kelompok "Data diri" menampilkan field baru;
   agama dan status perkawinan tersamar seperti NIK dengan tombol
   "Tampilkan" (tercatat di audit seperti field sensitif lain).
   Kelompok "Detail permintaan" per jenis (barang hilang, data acara,
   isi keterangan + keperluan).
2. UMUM: kotak "Isi keterangan yang dicetak" bisa disunting oleh staff
   dan admin selama status belum WAITING_APPROVAL; tombol "Simpan
   kalimat"; tampilkan teks asli dari warga di bawahnya sebagai
   pembanding.
3. Filter jenis surat di daftar, dashboard ringkasan, dan buku register
   memakai enam jenis baru (jenis lama tetap tampil untuk data lama).
4. Tombol "Lihat draf PDF" yang sudah ada dipakai untuk memeriksa hasil
   sebelum diajukan ke kepala desa.

## Selesai jika
lint, tsc, build lulus; uji dengan Laravel lokal untuk UMUM dan
KERAMAIAN; cek 390px/1440px halaman detail.
Commit: feat(admin): staff view for final letter types
```
