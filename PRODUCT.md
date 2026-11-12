# Watuagung — Konteks Produk

<!-- impeccable:product-schema 1 -->

> Revisi jenis layanan 8 November 2026: enam jenis sesuai contoh surat desa, menggantikan empat layanan lama; SKU dan pengantar KTP/KK tidak menerima pengajuan online baru, kode tetap untuk data lama. Rancangan dan pertanyaan terbuka ada di `docs/PROMPTS-SURAT.md`. Keputusan 2 November 2026 tetap berlaku: persetujuan RT/RW nonaktif secara bawaan, menggantikan alur aktif 20 Oktober; kode dipertahankan. Keputusan baru ditandai **[BARU]**. Keputusan yang masih menunggu konfirmasi ditandai **[SEMENTARA]**. Verifikasi perubahan 2 November lulus pada SQLite/PostgreSQL dan frontend; hasil serta batas pengujian ada di `docs/progres-2026-11-02.md` (bukan bukti verifikasi perubahan 8 November).

## Platform

web (desktop dan browser ponsel)

## Users

Pengguna utama adalah warga Desa Watuagung yang ingin:

1. mengajukan surat keterangan,
2. mengecek status pengajuan,
3. mencari informasi desa (profil, berita, BUMDes, UMKM, kontak).

**[BARU] Target usia 25 tahun ke atas, dengan perhatian khusus pada pengguna 30+.** Banyak di antaranya membuka website dari ponsel, tidak terbiasa dengan pola antarmuka aplikasi modern, dan membaca dengan teliti sebelum menekan tombol. Akibatnya:

- teks dasar minimal 18px di desktop dan 17px di ponsel; tidak ada teks penting di bawah 15px,
- tombol dan area sentuh minimal 48px tingginya,
- setiap tombol menu memakai teks, bukan ikon saja (ikon tiga garis selalu disertai kata "Menu"),
- istilah sehari-hari ("Ajukan Surat", "Cek Status Surat"), bukan istilah teknis atau singkatan yang tidak dijelaskan.

Ukuran pastinya diatur di `DESIGN.md`.

Pengguna panel bawaan adalah **petugas desa**, **kepala desa**, **admin**, dan **KIM (Media Informasi)** (`kim`). KIM hanya mengelola berita dan UMKM, termasuk foto; tidak dapat mengakses data pemohon/pengajuan, dashboard/ringkasan, buku registrasi, PDF surat, pembuatan ulang kode akses, akun pengguna, atau konten situs. KIM tetap dapat melihat field pemilik UMKM yang diizinkan pada detail panel; larangan akses pemohon bukan larangan seluruh data pribadi pemilik UMKM. Peran **ketua RT** dan **ketua RW** tetap ada dalam kode, tetapi aksesnya dinonaktifkan saat persetujuan RT/RW mati. Bila diaktifkan melalui konfigurasi backend, keduanya hanya menangani pengajuan sesuai wilayahnya. Panel tidak aktif di deployment demo Vercel; jangan menampilkannya seolah layanan operasional sudah tersedia.

## Product Purpose

Portal informasi dan pelayanan Desa Watuagung, bukan halaman pemasaran produk teknologi. Pengalaman berhasil jika warga bisa menemukan informasi, memahami persyaratan, memilih layanan, mengisi formulir, menyimpan bukti pengajuan, serta memahami status dan langkah berikutnya.

**[BARU] Beranda mendahulukan tugas, bukan slogan.** Tiga tugas utama (Ajukan Surat, Cek Status Surat, Sampaikan Pengaduan) harus terlihat tanpa scroll di desktop dan langsung setelah hero di ponsel.

Tujuan pelayanan harus dibedakan dari kemampuan yang sudah tersedia. Tidak ada target kuantitatif, janji waktu pelayanan, atau klaim resmi yang telah disepakati.

## Operating Context

- Informasi publik: profil desa, sejarah, visi-misi, perangkat desa, berita, agenda, potensi, transparansi, kontak, BUMDes, UMKM, dan statistik.
- Alur pelayanan: pilih jenis surat → baca persyaratan → isi formulir → terima nomor pengajuan (dan kode akses pada mode API) → cek status → ambil surat di kantor desa.
- **[BARU] Alur bawaan (keputusan klien 2 November 2026, jenis layanan diperbarui 8 November):** semua jenis surat langsung ke petugas desa → Kepala Desa → siap diambil → selesai. Status: `SUBMITTED → VERIFIED → PROCESSING → WAITING_APPROVAL → APPROVED → READY_FOR_PICKUP → COMPLETED`. Keputusan 2 November berlaku untuk empat jenis lama; alur yang sama dipertahankan untuk enam layanan terkini.
- Kode persetujuan RT/RW dipertahankan, tetapi hanya dikendalikan konfigurasi backend `letters.neighborhood_approval`, env `LETTER_NEIGHBORHOOD_APPROVAL=false` secara bawaan. Tidak ada sakelar frontend atau tabel jenis surat duplikat. Saat true, semua jenis selain SKU melalui RT lalu RW (termasuk KTP_KK pada data lama); SKU lama tetap langsung ke kantor. `LetterType` menentukan kebutuhan ini dan `ApplicationStatus` menggunakannya.
- Persetujuan RT/RW bila diaktifkan tetap hanya dicatat di sistem; tidak ada surat pengantar PDF, tanda tangan elektronik (TTE), stempel digital, atau notifikasi. Mengganti konfigurasi pada database berisi pengajuan wajib mengikuti prosedur di `backend/README.md`; bukan migrasi otomatis status.
- **[BARU] Penerbitan surat (21 Oktober 2026):** surat sah setelah Kepala Desa menyetujui (`APPROVED`). Sistem mencatat siapa dan kapan, lalu membuat PDF final dari template sementara dengan QR verifikasi. Contoh surat resmi desa telah diterima 8 November dan disarikan di `docs/PROMPTS-SURAT.md`; penerapan template resmi dilacak terpisah di S2. Selama template sementara masih dipakai, petugas juga dapat mengunggah surat yang disusun manual (QR ditempel, ditandatangani basah, distempel, lalu dipindai) untuk menggantikan PDF otomatis. PDF hanya untuk kantor desa dan Kepala Desa; warga tetap mengambil surat fisik di kantor desa.
- **[BARU] Enam layanan online (keputusan 8 November 2026):** `DOMISILI` — Surat Keterangan Domisili; `SKTM` — Surat Keterangan Tidak Mampu; `BELUM_MENIKAH` — Surat Keterangan Belum Menikah; `KERAMAIAN` — Surat Keterangan Izin Keramaian; `KEHILANGAN` — Surat Keterangan Kehilangan; `UMUM` — Surat Keterangan. SKU dan pengantar KTP/KK tidak ditawarkan lagi; enum, data lama, dan template lama dipertahankan, bukan dihapus. Ini menggantikan daftar empat formulir sebelumnya.
- **[SEMENTARA] Persyaratan enam layanan:** "Bawa KTP dan KK asli saat mengambil surat." dengan label "menunggu konfirmasi desa". Waktu pelayanan juga menunggu konfirmasi desa; tidak ada janji jumlah hari. Deskripsi dan contoh keperluan membantu memilih layanan, bukan ketentuan resmi.
- Surat Keterangan (`UMUM`) online ditujukan untuk keterangan tentang diri pemohon. Petugas dapat menyesuaikan isi keterangan sebelum surat dibuat; cakupan keterangan tanah, riwayat tanah, nikah siri, kematian, atau kebutuhan saksi/dokumen lain masih perlu keputusan desa (lihat pertanyaan terbuka di `docs/PROMPTS-SURAT.md`).
- Prototipe Vercel berjalan sebagai demo statis dengan data fiktif, bukan layanan resmi. Status pengajuan demo tidak bergerak otomatis.
- Bukti simulasi hanya tersedia di browser/origin yang sama; menghapus penyimpanan browser menghapus riwayat. Demo memakai alur bawaan tanpa persetujuan RT/RW dan tidak menyimpan identitas pemohon; bukti demo lama tanpa jenis surat tidak menampilkan linimasa.
- Mode API Laravel (pengembangan lokal) adalah alur terpisah. Di mode ini cek status membutuhkan nomor pengajuan **dan** kode akses rahasia; jangan samakan dengan demo tanpa API.

## Capabilities and Constraints

### Sudah tersedia

- Frontend Next.js 16 / React 19 / TypeScript; backend Laravel 13 + Sanctum di folder `backend/` dalam repositori yang sama.
- API pengajuan surat dan cek status (kode akses di-hash, rate limit).
- Login petugas, daftar pengajuan dengan pencarian nomor/nama, filter, dan urutan; halaman detail pemohon untuk peran berwenang `applications:manage` (bukan KIM) dengan audit akses; perubahan status dengan aturan transisi; dan riwayat perubahan di `application_events`.
- Manajemen akun petugas melalui panel oleh `admin`: tambah/ubah akun, nonaktifkan, reset kata sandi sementara, dan ganti kata sandi sendiri. Kata sandi sementara wajib diganti saat login pertama; akun nonaktif langsung kehilangan sesi. Satu wilayah hanya punya satu ketua RT/RW aktif.
- Status "Siap diambil" (`READY_FOR_PICKUP`) dan "Selesai" (`COMPLETED`), serta enam peran panel: `rt_head` (ketua RT), `rw_head` (ketua RW), `staff` (petugas), `village_head` (kepala desa), `admin`, `kim` (KIM (Media Informasi)). Hanya kepala desa yang memutuskan pengajuan yang menunggu persetujuan; wewenang dijaga di server (lihat `backend/README.md`).
- **[BARU] Persetujuan RT/RW nonaktif secara bawaan:** status `RT_APPROVED` dan `RW_APPROVED` serta pembatasan wilayah tetap disimpan dalam kode. Saat fitur mati, login RT/RW mendapat 401 generik; token lama mendapat 403. Pembuatan, penetapan peran/wilayah, atau aktivasi akun RT/RW ditolak 422 dengan pesan jelas; akun RT/RW lama tetap boleh dinonaktifkan.
- Ability panel dipisah: `panel` untuk semua peran aktif yang boleh masuk; `applications:manage` untuk staff/admin/village_head serta RT/RW saat fitur aktif; `media:manage` untuk admin/staff/kim; `site:manage` untuk admin/staff. Pengelolaan akun tetap khusus admin. Migration `2026_11_08_000001_revoke_staff_tokens_for_abilities` menghapus seluruh `personal_access_tokens`: semua sesi wajib login ulang, dan `down()` tidak dapat memulihkan token.
- `GET /staff/me` menyertakan `abilities: string[]` selain field profil yang sudah ada dan `features: { neighborhood_approval: boolean }`. Respons pengajuan dan cek status publik menyertakan `requires_neighborhood_approval` dari `LetterType`; frontend memakai boolean ini untuk linimasa, bukan menebak kebutuhan dari jenis surat.
- Field sensitif pemohon (NIK, KK, telepon, alamat, tempat/tanggal lahir, agama, dan status perkawinan) dienkripsi di database. Agama dan status perkawinan tidak tampil pada respons daftar atau cek status publik.
- **[BARU] Data diri surat:** dusun (Watuagung, Talang, Sekar), agama, kewarganegaraan, status perkawinan, pendidikan, dan pekerjaan mengikuti format desa; suku tidak dikumpulkan. Izin Keramaian tidak meminta agama, status perkawinan, pendidikan, atau pekerjaan; NIK/KK tetap untuk verifikasi petugas, tidak dicetak pada surat tersebut. Isian khusus per jenis mengikuti `docs/PROMPTS-SURAT.md`; status verifikasi S1–S4 dicatat di `ROADMAP.md`.
- Model, tabel, dan migration `residents` terenkripsi dipertahankan hanya sebagai fondasi seeder/tes; tidak dihubungkan ke route atau fitur produksi.
- Autofill identitas dummy dihapus dari impor dan UI formulir publik. Warga mengisi data sendiri; kolom alamat RT/RW tetap ada. `lib/dummy-residents.ts` dan tes fixture dipertahankan, bukan akses Dukcapil atau verifikasi identitas.

- **[BARU] Surat PDF dan verifikasi QR:** draf PDF bertanda DRAF untuk kantor, PDF final ber-QR saat `APPROVED`, unggah surat manual hasil pindaian, dan halaman publik `/verifikasi/` yang hanya menampilkan nomor surat, jenis surat, tanggal terbit, nama tersamar, serta status sah/dibatalkan. Kop, nama Kepala Desa, dan isi template masih `[PLACEHOLDER]`.

- **[BARU] Direktori UMKM warga (5–6 November 2026):** admin/staff/KIM menambah, menyunting, menerbitkan, dan menghapus UMKM di panel `/admin/umkm/`. Warga melihat `/umkm` (filter kategori) dan detail `/umkm/lihat/?slug=`; beranda menampilkan 3 usaha terbaru, atau "Segera hadir" bila kosong. Nama pemilik dan WhatsApp disimpan terenkripsi dan **hanya tampil bila pemilik sudah mengizinkan** (centang di panel); tanpa izin, tombol Chat WhatsApp tidak ada. Demo tanpa API tidak menampilkan UMKM karangan. Data UMKM resmi dan formulir izin pemilik dari desa belum diterima.
- **[BARU] Konten profil, kontak, sejarah, transparansi, struktur, dan video** dikelola admin/staff dengan `site:manage` di panel `/admin/konten/` (R4–R8), bukan KIM; visi-misi tetap statis. Berita dan foto sampul dikelola admin/staff/KIM dengan `media:manage`.

### **[BARU] Catatan hukum: QR verifikasi bukan TTE**

QR verifikasi **bukan** Tanda Tangan Elektronik tersertifikasi. TTE yang sah setara tanda tangan basah membutuhkan sertifikat dari Penyelenggara Sertifikasi Elektronik (misalnya BSrE). Sampai integrasi itu ada, surat tetap dicetak dan ditandatangani basah serta distempel oleh Kepala Desa, dan QR hanya berfungsi sebagai alat cek keaslian. Jangan menulis di halaman mana pun bahwa surat "ditandatangani secara elektronik".

- **[BARU] Pengaduan warga melalui Google Form desa (24 Oktober 2026):** pengaduan tidak dibangun di website. Bila `NEXT_PUBLIC_COMPLAINT_FORM_URL` berisi URL Google Forms (`https://forms.gle/` atau `https://docs.google.com/forms/`), semua pintu masuk pengaduan menjadi tautan "Sampaikan pengaduan" yang dibuka di tab baru dengan keterangan bahwa formulir dikelola Pemerintah Desa Watuagung melalui Google Forms. Formulir tidak disematkan (tanpa iframe). `/kontak` mengingatkan warga agar tidak menulis NIK, nomor KK, atau data pribadi lain di formulir, dan datang ke kantor desa untuk hal mendesak. Bila URL kosong atau tidak valid, tetap tampil "Segera hadir". Data pengaduan disimpan di Google, bukan di sistem ini.

### Belum tersedia

- Unggah dokumen persyaratan.
- Penerapan template surat resmi enam jenis (S2; contoh sudah diterima) dan Tanda Tangan Elektronik tersertifikasi (BSrE).
- Pengelolaan konten BUMDes melalui backend. Berita memiliki API CMS; halaman publik membaca berita terbit di browser tanpa build ulang (C4, 2 November 2026). Mode tanpa API tetap memakai contoh `lib/data.ts` sesuai `NEXT_PUBLIC_SHOW_SAMPLE_CONTENT`. Panel C3 sudah di-commit pada `1b2e6dd`; lihat `docs/progres-2026-11-02-c3.md` untuk verifikasi dan batasnya.
- Pemulihan kode akses / OTP.

Urutan pengembangannya ada di `ROADMAP.md`.

### **[BARU] Aturan fitur yang belum tersedia**

Desain boleh menampilkan pintu masuk ke fitur yang sudah ada di roadmap (misalnya tombol "Sampaikan Pengaduan"), **dengan syarat**:

- diberi label jelas **"Segera hadir"**,
- tombolnya tidak mengarah ke formulir palsu; arahkan ke halaman penjelasan singkat beserta kontak kantor desa sebagai alternatif,
- teks di halaman lain tidak menyiratkan fitur itu sudah berjalan (misalnya tidak menulis "unggah foto dokumen" selama unggah dokumen belum ada).

### Batasan kerja

- Gunakan data fiktif selama pengujian. Jangan memasukkan identitas warga nyata ke fixture, demo, atau dokumentasi publik.
- Pekerjaan visual tidak boleh mengubah alur pelayanan, validasi, kontrak API, atau backend kecuali diminta.
- Gunakan komponen dan dependensi yang tersedia. Penambahan dependensi atau perubahan arsitektur perlu persetujuan terpisah. **Pengecualian [BARU]:** font Plus Jakarta Sans melalui `next/font/google` sudah disetujui.
- Build lokal yang berhasil tidak membuktikan deployment atau alur produksi berhasil. Klaim kesiapan harus sesuai verifikasi yang benar-benar dijalankan.

## Brand Commitments

Arahan berikut sudah dikonfirmasi pengguna:

- **[BARU] Logo resmi:** logo pohon dalam lingkaran (hijau tua, langit keemasan, batu di akar). Logo ini menggantikan keputusan sebelumnya yang melarang logo pengganti.
  - Versi penuh dipakai di footer dan ukuran ≥ 56px.
  - Untuk header ponsel (≤ 44px) dan favicon, gunakan versi sederhana: siluet pohon satu warna tanpa langit. Versi ini **belum dibuat**; sampai tersedia, pakai versi penuh dan jangan membuat versi sederhana sendiri.
  - Jangan mengubah warna, memotong, atau menambah efek pada logo.
- **Identitas teks [SEMENTARA]:** logo + **WATUAGUNG** dengan subteks **PEMERINTAH DESA** pada identitas publik, dan **ADMINISTRASI DESA** pada sidebar admin.
- Portal harus terasa dirancang dengan sengaja: jelas, tenang, mudah dibaca, dan membantu warga menyelesaikan kebutuhan konkret.
- Bahasa Indonesia yang langsung, spesifik, dan mudah dipahami. Label tindakan, persyaratan, error, dan status harus menjelaskan apa yang terjadi serta langkah berikutnya.
- **[BARU] Judul bagian berisi informasi, bukan slogan.** Tulis "Layanan surat yang tersedia", bukan "Urus keperluan, lebih mudah." Hindari pola berulang label kecil kapital + slogan di setiap bagian.
- Hindari gaya promosi startup, jargon, superlatif tanpa bukti, klaim layanan yang belum ada, dan dekorasi yang tidak membantu pengunjung.
- Pertahankan arah warna hijau tua, krem/putih, dan aksen emas. Token pastinya ada di `DESIGN.md`.
- Pertahankan foto `/village.jpg` sebagai latar hero. Atribusi di footer **wajib tetap ada**; atribusi adalah kewajiban lisensi CC BY-SA 4.0. **[BARU]** Caption hero "Persawahan di Jawa · foto ilustrasi" dihapus atas keputusan pengguna 13 November 2026; jangan menulis teks yang menyebut foto itu sebagai Watuagung.
- **[BARU] CTA hero [SEMENTARA]:** **Ajukan Surat** (utama) dan **Lihat Syarat Surat** (kedua). Menggantikan "Ajukan Layanan / Jelajahi Desa".
- **[BARU] Navigasi:** header mengikuti scroll (sticky) dengan tiga keadaan: transparan di atas foto, krem solid setelah scroll, dan panel menu penuh. Di desktop, 3 link utama + tombol "Ajukan Surat" + tombol "Menu" tetap terlihat. Di ponsel, tombol "Menu" saja ditambah panel menu. Detailnya ada di `DESIGN.md`.
- Panel empat statistik tepat setelah hero tetap dihapus. Angka statistik hanya muncul di bagian profil dan halaman `/statistik`, sebagai placeholder sampai ada data resmi.
- **[BARU] Redesign Oktober 2026 menggantikan keputusan "jangan mengulang redesign".** Acuannya adalah mockup di kanvas "Redesign Watuagung — Gambaran" dan `DESIGN.md`. Kerjakan bertahap per halaman, bukan sekaligus.

## Evidence on Hand

- Foto: `public/village.jpg`. Atribusi: Thomas Fuhrmann, CC BY-SA 4.0, dipotong, dengan tautan sumber di footer.
- Logo: file PNG dari tim (4540×4540px). Simpan di `public/brand/logo-watuagung.png` beserta versi kecil yang sudah dioptimasi.
- Konten publik, statistik, dan berita yang belum bersumber resmi tetap berlabel contoh atau placeholder `[NAMA DATA]`. Enam jenis surat mengikuti contoh desa yang disarikan di `docs/PROMPTS-SURAT.md`, tetapi persyaratan sementara dan waktu pelayanan masih menunggu konfirmasi desa; jangan menjadikannya klaim resmi atau janji waktu.
- Fixture fiktif tersimpan di `lib/dummy-residents.ts` beserta tesnya; tidak lagi menjadi autofill formulir publik (keputusan 2 November 2026).
- Panduan menjalankan aplikasi: `README.md`, `backend/README.md`, dan `docs/integrasi.md`.
- Belum ada bukti persetujuan konten resmi desa, integrasi Dukcapil, atau layanan operasional yang boleh diklaim.

## Product Principles

1. Dahulukan kebutuhan warga dan kejelasan langkah berikutnya daripada promosi atau dekorasi.
2. Bedakan fakta resmi, konten contoh, dan fitur yang belum tersedia secara jujur.
3. Jaga konsistensi istilah dan perilaku dari pemilihan layanan sampai cek status.
4. Pertahankan keputusan yang sudah disetujui; ubah bertahap sesuai lingkup yang diminta.
5. Lindungi identitas warga dan jangan menyamarkan simulasi sebagai proses pemerintahan nyata.
6. **[BARU]** Rancang untuk pembaca 30+ di ponsel terlebih dahulu, lalu sesuaikan ke desktop.

## Accessibility & Inclusion

Keterbacaan dan penggunaan desktop/mobile adalah kebutuhan yang sudah dikonfirmasi. Pertahankan label formulir, pesan validasi, fokus keyboard, skip-link, dan navigasi yang ada.

**[BARU] Target minimum:** kontras teks 4.5:1 (3:1 untuk teks ≥ 24px), area sentuh ≥ 48px, panel menu bisa dibuka dan ditutup dengan keyboard (Esc menutup), dan fokus kembali ke tombol Menu setelah panel ditutup.

Belum ada standar kepatuhan formal; jangan menyatakan sudah tersertifikasi atau sepenuhnya patuh tanpa audit.

## Open Decisions

- Teks identitas dan CTA hero (lihat Brand Commitments) perlu konfirmasi akhir.
- Verifikasi konten resmi, data desa, dan pemilik proses pembaruan informasi.
- Hosting backend operasional, verifikasi pemohon, pemulihan akses, dan kebijakan retensi data sebelum menerima data warga nyata.
- Kebutuhan spesifik perangkat, koneksi, dan aksesibilitas warga yang belum diteliti.

Dokumen ini mencatat arahan dan batas produk. Rencana implementasi ada di `ROADMAP.md`, aturan visual di `DESIGN.md`, dan aturan kerja agent di `AGENTS.md`.
