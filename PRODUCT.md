# Watuagung — Konteks Produk

<!-- impeccable:product-schema 1 -->

> Revisi 15 Oktober 2026. Menggantikan versi sebelumnya. Keputusan baru ditandai **[BARU]**. Keputusan yang masih menunggu konfirmasi ditandai **[SEMENTARA]**.

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

Pengguna panel adalah **ketua RT**, **ketua RW**, **petugas desa**, **kepala desa**, dan **admin**. Ketua RT/RW hanya menangani pengajuan sesuai wilayahnya. Panel tidak aktif di deployment demo Vercel; jangan menampilkannya seolah layanan operasional sudah tersedia.

## Product Purpose

Portal informasi dan pelayanan Desa Watuagung, bukan halaman pemasaran produk teknologi. Pengalaman berhasil jika warga bisa menemukan informasi, memahami persyaratan, memilih layanan, mengisi formulir, menyimpan bukti pengajuan, serta memahami status dan langkah berikutnya.

**[BARU] Beranda mendahulukan tugas, bukan slogan.** Tiga tugas utama (Ajukan Surat, Cek Status Surat, Sampaikan Pengaduan) harus terlihat tanpa scroll di desktop dan langsung setelah hero di ponsel.

Tujuan pelayanan harus dibedakan dari kemampuan yang sudah tersedia. Tidak ada target kuantitatif, janji waktu pelayanan, atau klaim resmi yang telah disepakati.

## Operating Context

- Informasi publik: profil desa, sejarah, visi-misi, perangkat desa, berita, agenda, potensi, transparansi, kontak, BUMDes, UMKM, dan statistik.
- Alur pelayanan: pilih jenis surat → baca persyaratan → isi formulir → terima nomor pengajuan (dan kode akses pada mode API) → cek status → ambil surat di kantor desa.
- Alur persetujuan (disetujui 20 Oktober 2026): DOMISILI, SKTM, dan pengantar KTP/KK melewati Ketua RT → Ketua RW → petugas desa → kepala desa. SKU tidak berubah dan langsung ke petugas desa. Pengajuan yang sudah melewati tahap awal sebelum fitur ini tidak diulang dari RT/RW.
- Persetujuan RT/RW tetap dicatat di sistem; tidak ada surat pengantar PDF, tanda tangan elektronik (TTE), stempel digital, atau notifikasi.
- **[BARU] Penerbitan surat (21 Oktober 2026):** surat sah setelah Kepala Desa menyetujui (`APPROVED`). Sistem mencatat siapa dan kapan, lalu membuat PDF final dari template sementara dengan QR verifikasi. Karena template resmi desa belum diterima, petugas juga dapat mengunggah surat yang disusun manual (QR ditempel, ditandatangani basah, distempel, lalu dipindai) untuk menggantikan PDF otomatis. PDF hanya untuk kantor desa dan Kepala Desa; warga tetap mengambil surat fisik di kantor desa.
- Empat formulir: SKU, domisili, SKTM, dan pengantar KTP/KK.
- Prototipe Vercel berjalan sebagai demo statis dengan data fiktif, bukan layanan resmi. Status pengajuan demo tidak bergerak otomatis.
- Bukti simulasi hanya tersedia di browser/origin yang sama; menghapus penyimpanan browser menghapus riwayat. Alur demo hanya menambah jenis surat pada bukti tersimpan dan tidak menyimpan identitas pemohon; bukti demo lama tanpa jenis surat tidak menampilkan linimasa.
- Mode API Laravel (pengembangan lokal) adalah alur terpisah. Di mode ini cek status membutuhkan nomor pengajuan **dan** kode akses rahasia; jangan samakan dengan demo tanpa API.

## Capabilities and Constraints

### Sudah tersedia

- Frontend Next.js 16 / React 19 / TypeScript; backend Laravel 13 + Sanctum di folder `backend/` dalam repositori yang sama.
- API pengajuan surat dan cek status (kode akses di-hash, rate limit).
- Login petugas, daftar pengajuan dengan pencarian nomor/nama, filter, dan urutan; halaman detail pemohon untuk peran panel dengan audit akses; perubahan status dengan aturan transisi; dan riwayat perubahan di `application_events`.
- Manajemen akun petugas melalui panel oleh `admin`: tambah/ubah akun, nonaktifkan, reset kata sandi sementara, dan ganti kata sandi sendiri. Kata sandi sementara wajib diganti saat login pertama; akun nonaktif langsung kehilangan sesi. Satu wilayah hanya punya satu ketua RT/RW aktif.
- Status "Siap diambil" (`READY_FOR_PICKUP`) dan "Selesai" (`COMPLETED`), serta lima peran panel: `rt_head` (ketua RT), `rw_head` (ketua RW), `staff` (petugas), `village_head` (kepala desa), `admin`. Hanya kepala desa yang memutuskan pengajuan yang menunggu persetujuan; wewenang dijaga di server (lihat `backend/README.md`).
- **[BARU] Persetujuan RT/RW:** status `RT_APPROVED` dan `RW_APPROVED`. Ketua RT/RW hanya melihat pengajuan di wilayahnya, menerima NIK/KK utuh untuk verifikasi, dan tidak menerima telepon, tempat/tanggal lahir, maupun jenis kelamin.
- Field sensitif pemohon (NIK, KK, telepon, alamat) dienkripsi di database.
- Fondasi tabel resident terenkripsi, seeder dummy, dan feature test backend.
- Autofill NIK memakai tiga identitas dummy frontend. Ini bukan akses Dukcapil, bukan verifikasi identitas, dan belum terhubung ke database resident.

- **[BARU] Surat PDF dan verifikasi QR:** draf PDF bertanda DRAF untuk kantor, PDF final ber-QR saat `APPROVED`, unggah surat manual hasil pindaian, dan halaman publik `/verifikasi/` yang hanya menampilkan nomor surat, jenis surat, tanggal terbit, nama tersamar, serta status sah/dibatalkan. Kop, nama Kepala Desa, dan isi template masih `[PLACEHOLDER]`.

### **[BARU] Catatan hukum: QR verifikasi bukan TTE**

QR verifikasi **bukan** Tanda Tangan Elektronik tersertifikasi. TTE yang sah setara tanda tangan basah membutuhkan sertifikat dari Penyelenggara Sertifikasi Elektronik (misalnya BSrE). Sampai integrasi itu ada, surat tetap dicetak dan ditandatangani basah serta distempel oleh Kepala Desa, dan QR hanya berfungsi sebagai alat cek keaslian. Jangan menulis di halaman mana pun bahwa surat "ditandatangani secara elektronik".

### Belum tersedia

- Pengaduan warga.
- Unggah dokumen persyaratan.
- Template surat resmi desa dan Tanda Tangan Elektronik tersertifikasi (BSrE).
- Pengelolaan konten (profil, berita, BUMDes, UMKM) melalui backend; konten masih tersimpan di `lib/data.ts`.
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
- Pertahankan foto `/village.jpg` sebagai latar hero. Caption "foto ilustrasi" dan atribusi di footer **wajib tetap ada**; atribusi adalah kewajiban lisensi CC BY-SA 4.0.
- **[BARU] CTA hero [SEMENTARA]:** **Ajukan Surat** (utama) dan **Lihat Syarat Surat** (kedua). Menggantikan "Ajukan Layanan / Jelajahi Desa".
- **[BARU] Navigasi:** header mengikuti scroll (sticky) dengan tiga keadaan: transparan di atas foto, krem solid setelah scroll, dan panel menu penuh. Di desktop, 3 link utama + tombol "Ajukan Surat" + tombol "Menu" tetap terlihat. Di ponsel, tombol "Menu" saja ditambah panel menu. Detailnya ada di `DESIGN.md`.
- Panel empat statistik tepat setelah hero tetap dihapus. Angka statistik hanya muncul di bagian profil dan halaman `/statistik`, sebagai placeholder sampai ada data resmi.
- **[BARU] Redesign Oktober 2026 menggantikan keputusan "jangan mengulang redesign".** Acuannya adalah mockup di kanvas "Redesign Watuagung — Gambaran" dan `DESIGN.md`. Kerjakan bertahap per halaman, bukan sekaligus.

## Evidence on Hand

- Foto: `public/village.jpg`. Atribusi: Thomas Fuhrmann, CC BY-SA 4.0, dipotong, dengan tautan sumber di footer.
- Logo: file PNG dari tim (4540×4540px). Simpan di `public/brand/logo-watuagung.png` beserta versi kecil yang sudah dioptimasi.
- Konten publik, statistik, berita, persyaratan, dan estimasi waktu yang tampil masih contoh. Jangan jadikan klaim resmi tanpa sumber yang disetujui. Data yang belum ada ditulis sebagai placeholder `[NAMA DATA]`.
- Data autofill: fixture fiktif di `lib/dummy-residents.ts`.
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
