# Watuagung — Roadmap Pengembangan

> Disusun 15 Oktober 2026 dari kondisi repositori saat itu. Urutan modul mengikuti ketergantungan; jangan memulai modul sebelum modul yang dibutuhkannya selesai. Tandai `[x]` saat selesai dan terverifikasi.

## Kondisi awal

**Sudah ada:**

- `POST /api/v1/applications`: pengajuan 4 jenis surat, rate limit 5/menit, field sensitif terenkripsi.
- `POST /api/v1/applications/status`: cek status dengan nomor + kode akses (di-hash), rate limit 10/menit.
- `POST /api/v1/staff/login` dan `/logout`: token Sanctum dengan ability `applications:manage`. Role yang diterima: `staff` dan `admin`.
- `GET /api/v1/staff/applications`: daftar berpaginasi dengan filter status.
- `PATCH /api/v1/staff/applications/{request_id}/status`: transisi status dengan aturan; catatan wajib untuk `REJECTED` dan `NEED_REVISION`; riwayat disimpan di `application_events`.
- Tabel `residents` (dummy, terenkripsi) dan feature test.

**Status saat itu:** `SUBMITTED → VERIFIED → PROCESSING → WAITING_APPROVAL → APPROVED`, plus `REJECTED` dan `NEED_REVISION`. Alur terbaru ada di M2 dan M2a.

## Keputusan yang dibutuhkan sebelum mulai

| # | Keputusan | Menentukan modul | Status |
|---|---|---|---|
| K1 | DOMISILI/SKTM/KTP_KK: RT → RW → petugas desa → kepala desa → siap diambil; SKU tetap langsung petugas desa | M2, M2a | **Disetujui 20 Oktober 2026** |
| K2 | Hosting produksi: tetap static export (Vercel) + API terpisah, atau Next.js server penuh? | M5, M8 | Belum |
| K3 | Database produksi: tetap SQLite atau PostgreSQL/MySQL? | M8 | Belum |
| K4 | Siapa di desa yang mengisi dan memperbarui konten? | M5 | Belum |
| K5 | Library PDF (perlu persetujuan dependensi) | M7 | Belum |

> **Catatan K2:** demo Vercel saat ini berupa static export. Konten dari API (M5) tidak akan muncul tanpa build ulang, kecuali konten diambil di sisi browser atau hosting diganti ke server. Putuskan K2 sebelum M5.

---

## M0 — Dokumen dan fondasi

- [ ] Commit `PRODUCT.md`, `DESIGN.md`, `ROADMAP.md`, dan `AGENTS.md` ke repo
- [ ] Putuskan nasib `backend/AGENTS.md` / `backend/CLAUDE.md` (bootstrap Laravel Boost): pasang Boost dengan sadar, atau ganti dengan aturan backend sendiri
- [ ] Simpan logo di `public/brand/` (penuh + versi teroptimasi 512px dan 128px)
- [ ] Minta desainer membuat logo versi sederhana (siluet satu warna) untuk favicon dan header kecil

## M1 — Redesign UI (frontend saja)

Dasar: `DESIGN.md` + kanvas mockup. Tidak menyentuh `backend/`. Satu butir = satu sesi/PR.

- [x] Token warna + font Plus Jakarta Sans di `globals.css` dan `layout.tsx`
- [x] Header sticky 3 keadaan + panel menu (desktop dan ponsel), hapus topbar
- [x] Footer baru dengan logo dan atribusi foto
- [x] Beranda: hero, panel tugas, daftar layanan, cara mengajukan — implementasi, lint, tsc, build, dan tes demo selesai; pemeriksaan visual 390px/1440px diambil alih pengguna, menunggu hasil review.
- [x] Beranda: profil singkat, kabar desa, BUMDes/UMKM, kontak — implementasi, lint, tsc, build, tautan dan pengukuran layout 390px/1440px selesai; review visual screenshot tertunda karena tab browser alat tidak terlihat.
- [x] Halaman `/pelayanan` dan detail layanan (persyaratan lengkap) — daftar bersama beranda, panel “Siapkan dulu”, PageHeading ringkas; lint, tsc, build, pemeriksaan 390px/1440px lulus.
- [x] Formulir pengajuan: hanya tampilan, logika tetap — kelompok field, input dan error terbaca; pengajuan SKU fiktif tanpa URL API sampai halaman sukses terverifikasi di browser.
- [x] Halaman sukses dan cek status: hanya tampilan, logika tetap — salin terpisah, peringatan kode akses, badge dan linimasa 5 tahap; lint, tsc, build, tes demo, alur simulasi, serta pemeriksaan visual 390px/1440px lulus. UI mode API diuji dengan respons tiruan, bukan backend langsung.
- [x] Halaman informasi (`[slug]`: profil, sejarah, visi-misi, perangkat desa, pengumuman, agenda, potensi, transparansi, kontak) — kartu terbaca, tombol bawah profil dipertahankan, kontak placeholder; lint, tsc, build seluruh 9 slug dan pengukuran 390px/1440px lulus. Baris navigasi di bawah PageHeading dihapus sesuai koreksi pengguna; screenshot profil/perangkat desa diperiksa ulang. Isi dan susunan kartu profil dipertahankan.
- [x] Halaman BUMDes dan statistik — CSS module BUMDes dipindah ke pola `.info-page` + token global; statistik angka 32px, label 16px, batang usia memakai token, catatan data contoh dipertahankan. Lint, tsc, build, dan pemeriksaan 390px/1440px lulus.
- [ ] Halaman berita — redesign sudah ada di riwayat (`4f53046`), tetapi belum diverifikasi terhadap checklist M1.
- [x] Penjelasan "Pengaduan — segera hadir" di `/kontak` — badge dan arahan menyampaikan pengaduan langsung ke kantor desa, tanpa formulir palsu atau route baru.
- [x] Panel admin: sesuaikan token dan tipografi saja — forest/cream, logo 128px ditampilkan 56px, tabel 15–16px, sidebar hanya mode API; lint, tsc, build, build demo dan pemeriksaan 390px/1440px lulus dengan API tiruan. Logika login/filter/status tetap.
- [x] Audit polish M1 di luar berita — CSS berkurang bersih 262 baris, dua eyebrow ekonomi dihapus, 1.254 tautan internal valid; pengecualian hex/teks kecil dicatat di `docs/progres-2026-10-17.md`. Halaman berita tetap dikunci pengguna; M1 keseluruhan belum dinyatakan selesai.

**Selesai jika:** lint, tsc, dan build lulus; dicek di 390px dan 1440px; tidak ada perubahan perilaku formulir/API.

## M2 — Status lengkap dan peran

Bergantung pada K1.

- [x] Tambah status `READY_FOR_PICKUP` (Siap diambil) dan `COMPLETED` (Selesai/diambil)
- [x] Alur: `APPROVED → READY_FOR_PICKUP → COMPLETED`
- [x] Peran: `staff` (petugas), `village_head` (kepala desa), `admin` (pengelola sistem dan konten)
- [x] Wewenang per peran (diputuskan pengguna 18 Okt 2026, menggantikan rumusan "ability per peran"): satu ability `applications:manage`, peran diperiksa di `app/Domain/ApplicationStatus.php`. Hanya `village_head` yang boleh `WAITING_APPROVAL → APPROVED/REJECTED/NEED_REVISION`; `staff` dan `admin` menangani sisanya; admin tidak bisa menyetujui. Manajemen akun lewat panel tetap di M3.
- [x] Perbarui `types/pelayanan.ts`, label status, badge, dan simulasi demo
- [x] Tes: setiap transisi yang diizinkan dan ditolak per peran (`StatusWorkflowTest`)

## M2a — Persetujuan RT/RW berurutan

Bergantung pada M2 dan M3 (detail permohonan). Disetujui pengguna 20 Oktober 2026. Centang hanya setelah diverifikasi.

- [x] Konfigurasi jenis surat di `backend/app/Domain/LetterType.php` dan cerminannya di `lib/letter-workflow.ts`: DOMISILI, SKTM, KTP_KK memerlukan RT/RW; SKU tidak
- [x] Status `RT_APPROVED` dan `RW_APPROVED`; alur `SUBMITTED → RT_APPROVED → RW_APPROVED → VERIFIED → … → COMPLETED`; RT/RW hanya boleh menyetujui atau menolak (catatan wajib)
- [x] Peran `rt_head` (RT + RW) dan `rw_head` (RW); kolom `rt`/`rw` nullable di `users`, kode wilayah dinormalkan menjadi 3 digit
- [x] Daftar dan detail dibatasi wilayah: detail di luar wilayah 404, perubahan status di luar wilayah 403, transisi melompat 422
- [x] Detail RT/RW: NIK/KK utuh (revisi pengguna 20 Okt 2026); telepon, tempat/tanggal lahir, dan jenis kelamin tidak dikirim; audit akses tetap sama
- [x] Cek status publik mengembalikan `jenis_surat`; demo hanya menambah `jenis_surat` pada bukti tersimpan; bukti demo lama tanpa jenis surat tidak menampilkan linimasa
- [x] Antrean `/admin/antrean-rt` dan `/admin/antrean-rw` dengan pilihan menunggu keputusan/riwayat baca-saja sesuai `DESIGN.md`
- [x] Migration hanya menormalkan kode wilayah; pengajuan lama yang sudah berjalan tidak diulang dari RT/RW
- [x] `staff:create` menerima `--rt`/`--rw`; dokumentasi `backend/README.md` dan `docs/integrasi.md` diperbarui
- [ ] Verifikasi: `php artisan test`, lint, tsc, build, build demo, test:demo lulus (20 Okt 2026); uji API manual SKTM sampai COMPLETED lulus; **pemeriksaan visual 390px/1440px menunggu pengguna**

## M3 — Dashboard admin

Bergantung pada M2, kecuali fondasi sesi dan kerangka (disetujui pengguna untuk dikerjakan lebih dulu).

- [x] Fondasi: sesi petugas persisten per tab (`sessionStorage` + `GET /staff/me`), token kedaluwarsa 480 menit (`SANCTUM_EXPIRATION`) dan prune terjadwal, 401 kembali ke login dengan pesan; kerangka sidebar + bilah atas + panel geser ≤ 900px; menu hanya Dashboard/Permohonan/Surat disetujui. Backend test, lint, tsc, build, build:demo, dan pemeriksaan browser 390px/1440px dengan Laravel lokal lulus.
- [ ] Ringkasan jumlah pengajuan per status (endpoint baru) — sesi A4
- [x] Pencarian berdasarkan nomor pengajuan — juga nama pemohon (nama di `q` disetujui pengguna), filter status/jenis surat, urutan, dan pagination dengan query string.
- [x] Halaman detail pengajuan: data pemohon untuk tiga peran panel, riwayat status dari `application_events`, aksi dari `allowed_transitions`, dan audit `application.viewed` di `audit_logs`.
- [x] Antrean kepala desa: daftar yang menunggu persetujuan (`/admin/persetujuan`, dikerjakan bersama M2)
- [ ] Manajemen akun petugas (khusus `admin`) — tambah/ubah/nonaktifkan akun, reset kata sandi sementara, ganti kata sandi sendiri, batas satu ketua RT/RW aktif per wilayah, dan peringatan wilayah tanpa ketua aktif

## M4 — Pengaduan warga

- [ ] Tabel `complaints`: nomor tiket, kode akses (hash), kategori, judul, isi, lokasi/RT-RW, kontak opsional (terenkripsi), status, catatan tindak lanjut
- [ ] Riwayat di `complaint_events`
- [ ] Status: `RECEIVED → IN_PROGRESS → RESOLVED`, atau `REJECTED` (catatan wajib)
- [ ] Endpoint publik: kirim + cek status (pola sama dengan pengajuan surat, dengan rate limit)
- [ ] Endpoint petugas: daftar, filter, ubah status
- [ ] Frontend: formulir, halaman sukses, cek status; hapus badge "Segera hadir"
- [ ] Data dari desa: daftar kategori pengaduan dan siapa yang menanganinya

## M5 — Pengelolaan konten (CMS)

Bergantung pada K2 dan K4.

- [ ] Tabel: `village_profile` (satu baris: nama, alamat, jam layanan, kontak, visi, misi, sejarah, luas, jumlah dusun/penduduk), `officials` (perangkat desa), `posts` (berita/pengumuman), `agendas`, `bumdes_units`, `umkm`
- [ ] Endpoint publik `GET` per jenis konten
- [ ] CRUD di panel admin untuk peran `admin`, termasuk unggah foto konten
- [ ] Frontend membaca dari API, dengan cadangan `lib/data.ts` untuk mode demo
- [ ] Hapus semua keterangan "konten contoh" yang sudah diganti data resmi

## M6 — Unggah lampiran persyaratan

- [ ] Penyimpanan privat (bukan folder publik); hanya petugas yang bisa membuka
- [ ] Batasan: JPG/PNG/PDF, maksimal 2 MB per file; jumlah dan jenis file per layanan
- [ ] Hapus lampiran otomatis setelah masa retensi (ikut keputusan di M8)
- [ ] Ubah langkah "Cara mengajukan" di beranda setelah fitur aktif

## M7 — Penerbitan surat (PDF)

Bergantung pada K5 dan M2.

- [ ] Template per jenis surat sesuai format resmi desa (kop, nomor, penandatangan)
- [ ] Format penomoran surat dan urutannya
- [ ] PDF dibuat saat status `APPROVED`; hanya petugas yang bisa mengunduh dan mencetak
- [ ] Data dari desa: contoh surat asli tiap jenis, format nomor, nama dan jabatan penandatangan

## M8 — Kesiapan produksi

Wajib selesai sebelum menerima data warga nyata.

- [ ] Hosting backend + database produksi (K2, K3)
- [ ] HTTPS, CORS sesuai domain, backup terjadwal
- [ ] Kebijakan retensi dan penghapusan data pemohon (sesuai UU PDP)
- [ ] Pemulihan kode akses (OTP WhatsApp/SMS) atau alur bantuan di kantor desa
- [ ] Halaman kebijakan privasi
- [ ] Uji keamanan dasar: rate limit, otorisasi per peran, field sensitif tidak bocor di respons atau log

---

## Pembagian tim (3 orang)

| Peran | Fokus |
|---|---|
| Tech Lead | M0, review semua PR, skema database dan kontrak API (M2–M5), keputusan K1–K5 |
| Frontend | M1, lalu sisi frontend M2–M5 |
| Backend + penghubung desa | Endpoint M2–M7, pengumpulan data dari desa, QA |

M1 dan M2 bisa berjalan paralel karena tidak menyentuh file yang sama. Setelah itu, M3 dan M4 juga bisa paralel.

## Data yang harus diminta ke desa

| Untuk | Data |
|---|---|
| M1/M5 | Nama resmi, alamat kantor, titik peta, jam layanan, nomor WhatsApp/telepon, email |
| M5 | Sejarah, visi-misi, luas dan batas wilayah, jumlah dusun/RW/RT, jumlah penduduk (agregat), struktur perangkat desa (nama, jabatan, foto atas izin), BUMDes, UMKM (atas izin pemilik), berita/agenda awal, ringkasan APBDes |
| M2a | Daftar RT/RW dan ketua yang berwenang (akun dibuat petugas, bukan data warga) |
| M2/M7 | Penandatangan, contoh surat asli tiap jenis, format nomor surat |
| Layanan | Persyaratan resmi dan estimasi waktu tiap jenis surat |
| M4 | Kategori pengaduan dan penanggung jawabnya |
| Foto | Foto kantor desa, kegiatan, dan lingkungan (dengan izin penggunaan) |

Jangan meminta dataset NIK/KK penduduk. Warga mengisi datanya sendiri saat mengajukan.
