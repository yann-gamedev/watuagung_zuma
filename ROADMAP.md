# Watuagung — Roadmap Pengembangan

> Disusun 15 Oktober 2026; status disinkronkan 22 Oktober 2026 terhadap kode pada `2f788bf` dan catatan progres. Urutan modul mengikuti ketergantungan; jangan memulai modul sebelum modul yang dibutuhkannya selesai.
>
> `[x]` berarti butir tersebut selesai dengan bukti verifikasi yang dicatat, bukan seluruh modul siap produksi. `[ ]` berarti belum selesai: belum dibuat, menunggu pengujian, atau menunggu keputusan/data. Implementasi dan pengujian lanjutan dipisahkan agar tidak tertukar. Hasil tes di bawah adalah riwayat sesi terkait, bukan hasil menjalankan ulang tes saat sinkronisasi ini.

## Ringkasan status terkini

| Modul | Status | Sisa utama |
|---|---|---|
| M0 — Fondasi | Sebagian selesai | Aturan backend, logo penuh/512px, logo sederhana |
| M1 — UI | Mayoritas implementasi selesai | Verifikasi berita (masih dikunci pengguna) dan review visual tertunda |
| M2 — Status/peran | Selesai sesuai checklist | Perluasan RT/RW dicatat di M2a |
| M2a — RT/RW | Implementasi dan uji API selesai | Review visual antrean 390px/1440px |
| M3 — Dashboard | Sebagian selesai; manajemen akun sudah ada | Ringkasan per status, uji manual akun dan review visual |
| M3a — Register | Implementasi dan uji konkurensi PostgreSQL selesai | Uji browser dengan Laravel |
| M4 — Pengaduan | Dialihkan ke Google Form desa (24 Okt 2026); tautan selesai | URL Google Form dari desa (`NEXT_PUBLIC_COMPLAINT_FORM_URL`) |
| M5 — CMS | Belum dibuat; menunggu K2/K4 | Hosting, pengelola konten, backend dan frontend |
| M6 — Lampiran persyaratan | Belum dibuat | Unggah privat, batas file, retensi; berbeda dari unggah surat final M7 |
| M7 — PDF/QR | Implementasi dengan template sementara selesai | Format resmi desa, uji browser Laravel dan pindai QR; TTE di luar lingkup |
| M8 — Produksi | Belum siap operasional | Infrastruktur, privasi/retensi, prosedur bantuan, verifikasi keamanan |

Sumber: kode/route API, file yang terlacak Git, `docs/progres-2026-10-21.md`, `docs/progres-2026-10-22.md`, dan verifikasi sesi perbaikan layout (`603b267`, `2f788bf`). Status ini menggambarkan branch kerja lokal, bukan bukti semua perubahan telah digabung ke `main` atau di-deploy.

## Kondisi awal — arsip 15 Oktober 2026

**Sudah ada saat itu (bukan daftar kemampuan terkini):**

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
| K3 | Database produksi: PostgreSQL 16+; SQLite tetap untuk pengembangan cepat | M8 | **Disetujui 24 Oktober 2026**; suite dan migration diverifikasi pada PostgreSQL 18.6 lokal, bukan deployment produksi |
| K4 | Siapa di desa yang mengisi dan memperbarui konten? | M5 | Belum |
| K5 | Library PDF (perlu persetujuan dependensi) | M7 | **Disetujui 21 Oktober 2026:** `barryvdh/laravel-dompdf` + `bacon/bacon-qr-code` |

> **Catatan K2:** demo Vercel saat ini berupa static export. Konten dari API (M5) tidak akan muncul tanpa build ulang, kecuali konten diambil di sisi browser atau hosting diganti ke server. Putuskan K2 sebelum M5.

---

## M0 — Dokumen dan fondasi

- [x] Commit `PRODUCT.md`, `DESIGN.md`, `ROADMAP.md`, dan `AGENTS.md` ke repo — semuanya sudah terlacak Git.
- [x] Pengaman file Claude (`8f057f5`): abaikan `CLAUDE.md` dan `.claude/` di semua tingkat folder tanpa membedakan huruf besar/kecil; file Claude lama dilepas dari pelacakan tanpa menghapus salinan lokal. Hook `pre-push` dan self-test tersedia; aktif di clone ini, perlu aktivasi di clone lain. Markdown lain tetap boleh di-push. Hook lokal bukan larangan server GitHub dan tidak menghapus riwayat lama.
- [ ] Putuskan aturan `backend/AGENTS.md` yang masih berisi bootstrap Laravel Boost: pasang Boost dengan persetujuan dependensi, atau ganti dengan aturan backend sendiri. File `CLAUDE.md` tetap privat dan tidak menjadi dokumen repo.
- [x] Logo teroptimasi 128px tersimpan dan terlacak di `public/brand/logo-watuagung-128.png`.
- [ ] Lengkapi logo penuh dan versi teroptimasi 512px di `public/brand/` — belum terlacak di lokasi ini.
- [ ] Minta desainer membuat logo versi sederhana (siluet satu warna) untuk favicon dan header kecil

## M1 — Redesign UI (frontend saja)

Dasar: `DESIGN.md` + kanvas mockup. Tidak menyentuh `backend/`. Satu butir = satu sesi/PR.

- [x] Token warna + font Plus Jakarta Sans di `globals.css` dan `layout.tsx`
- [x] Header sticky 3 keadaan + panel menu (desktop dan ponsel), hapus topbar
- [x] Footer baru dengan logo dan atribusi foto
- [x] Beranda: hero, panel tugas, daftar layanan, cara mengajukan — implementasi, lint, tsc, build, dan tes demo selesai; pemeriksaan visual 390px/1440px diambil alih pengguna, menunggu hasil review.
- [x] Beranda: profil singkat, kabar desa, BUMDes/UMKM, kontak — implementasi, lint, tsc, build, tautan dan pengukuran layout 390px/1440px selesai; review visual screenshot tertunda karena tab browser alat tidak terlihat.
- [x] Halaman `/pelayanan` dan detail layanan (persyaratan lengkap) — daftar bersama beranda, panel “Siapkan dulu”, PageHeading ringkas; lint, tsc, build, pemeriksaan 390px/1440px lulus. Perbaikan “Cara mengajukan surat” (`603b267`) memakai tiga langkah bernomor dan catatan alur terpisah; lint, tsc, build serta pengukuran layout 390px/1440px lulus, screenshot perbaikan belum diperiksa.
- [x] Formulir pengajuan: hanya tampilan, logika tetap — kelompok field, input dan error terbaca; pengajuan SKU fiktif tanpa URL API sampai halaman sukses terverifikasi di browser.
- [x] Halaman sukses dan cek status: hanya tampilan, logika tetap — salin terpisah, peringatan kode akses, badge dan linimasa 5 tahap; lint, tsc, build, tes demo, alur simulasi, serta pemeriksaan visual 390px/1440px lulus. UI mode API diuji dengan respons tiruan, bukan backend langsung.
- [x] Halaman informasi (`[slug]`: profil, sejarah, visi-misi, perangkat desa, pengumuman, agenda, potensi, transparansi, kontak) — kartu terbaca, tombol bawah profil dipertahankan, kontak placeholder; lint, tsc, build seluruh 9 slug dan pengukuran 390px/1440px lulus. Baris navigasi di bawah PageHeading dihapus sesuai koreksi pengguna; screenshot profil/perangkat desa diperiksa ulang. Isi dan susunan kartu profil dipertahankan.
- [x] Halaman BUMDes dan statistik — CSS module BUMDes dipindah ke pola `.info-page` + token global; statistik angka 32px, label 16px, batang usia memakai token, catatan data contoh dipertahankan. Lint, tsc, build, dan pemeriksaan 390px/1440px lulus.
- [ ] Halaman berita — redesign sudah ada di riwayat (`4f53046`), tetapi belum diverifikasi terhadap checklist M1.
- [x] Penjelasan "Pengaduan — segera hadir" di `/kontak` — badge dan arahan menyampaikan pengaduan langsung ke kantor desa, tanpa formulir palsu atau route baru.
- [x] Panel admin: sesuaikan token dan tipografi saja — forest/cream, logo 128px ditampilkan 56px, tabel 15–16px, sidebar hanya mode API; lint, tsc, build, build demo dan pemeriksaan 390px/1440px lulus dengan API tiruan. Logika login/filter/status tetap.
- [x] Audit polish M1 di luar berita — CSS berkurang bersih 262 baris, dua eyebrow ekonomi dihapus, 1.254 tautan internal valid; pengecualian hex/teks kecil dicatat di `docs/progres-2026-10-17.md`. Halaman berita tetap dikunci pengguna; M1 keseluruhan belum dinyatakan selesai.

- [ ] Tuntaskan review visual 390px/1440px yang masih tertunda: beranda atas/bawah dan perbaikan langkah `/pelayanan`. Pengukuran layout bukan pengganti pemeriksaan visual; verifikasi berita tetap butir terpisah di atas.

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
- [x] Verifikasi teknis: `php artisan test`, lint, tsc, build, build demo, test:demo lulus (20 Okt 2026); uji API manual SKTM sampai COMPLETED lulus.
- [ ] Pemeriksaan visual antrean RT/RW pada 390px/1440px — menunggu pengguna.

## M3 — Dashboard admin

Bergantung pada M2, kecuali fondasi sesi dan kerangka (disetujui pengguna untuk dikerjakan lebih dulu).

- [x] Fondasi: sesi petugas persisten per tab (`sessionStorage` + `GET /staff/me`), token kedaluwarsa 480 menit (`SANCTUM_EXPIRATION`) dan prune terjadwal, 401 kembali ke login dengan pesan; kerangka sidebar + bilah atas + panel geser ≤ 900px; menu hanya Dashboard/Permohonan/Surat disetujui. Backend test, lint, tsc, build, build:demo, dan pemeriksaan browser 390px/1440px dengan Laravel lokal lulus.
- [ ] Ringkasan jumlah pengajuan per status (endpoint baru) — sesi A4
- [x] Pencarian berdasarkan nomor pengajuan — juga nama pemohon (nama di `q` disetujui pengguna), filter status/jenis surat, urutan, dan pagination dengan query string.
- [x] Halaman detail pengajuan: data pemohon untuk staff/admin/village_head, riwayat status dari `application_events`, aksi dari `allowed_transitions`, dan audit `application.viewed` di `audit_logs`. Akses RT/RW dengan pembatasan wilayah dan data ditambahkan di M2a.
- [x] Antrean kepala desa: daftar yang menunggu persetujuan (`/admin/persetujuan`, dikerjakan bersama M2)
- [x] Implementasi manajemen akun petugas (khusus `admin`) — tambah/ubah/nonaktifkan akun, reset kata sandi sementara, ganti kata sandi sendiri, batas satu ketua RT/RW aktif per wilayah, dan peringatan wilayah tanpa ketua aktif. Backend dicakup `StaffAccountsTest`; lint, tsc, build, build demo dan test:demo lulus setelah perbaikan build (lihat `docs/progres-2026-10-22.md`).
- [x] Perbaikan layout dialog reset kata sandi (`2f788bf`): memakai gaya dialog bersama; lint, tsc, build lulus. Pengukuran markup contoh dengan CSS hasil build pada 390px/1440px menunjukkan dialog terpusat tanpa overflow; bukan uji alur backend atau pemeriksaan screenshot.
- [ ] Uji manual akun dengan Laravel: admin membuat akun → login dengan kata sandi sementara → wajib ganti kata sandi → reset kata sandi/nonaktifkan akun → pastikan sesi lama tidak berlaku.
- [ ] Pemeriksaan visual halaman akun dan dialog pada 390px/1440px dengan alur aplikasi sebenarnya.

## M3a — Penomoran dan buku registrasi surat

Dipisahkan dari M7/PDF atas persetujuan pengguna 21 Oktober 2026; bergantung pada M2 dan detail M3, tidak memerlukan library PDF.

- [x] Nomor otomatis pada PROCESSING → WAITING_APPROVAL; konfigurasi format, klasifikasi per LetterType, satu urutan tahunan lintas jenis, transaksi/penguncian dan constraint unik.
- [x] Nomor batal beserta alasan saat Kepala Desa menolak/meminta perbaikan; nomor tidak dipakai ulang. Tidak ada penomoran retroaktif untuk permohonan lama.
- [x] API buku registrasi untuk staff/admin/village_head; detail kantor memuat riwayat nomor, cek status warga memuat nomor aktif sejak APPROVED.
- [x] `/admin/register`: filter tahun/jenis, pagination, tanda nomor batal; tanpa ekspor/PDF.
- [x] Tes backend (155 tes, 1.668 assertions pada sesi register), lint, tsc, build, build demo, test:demo, dan pemeriksaan register 390px/1440px dengan API tiruan lulus.
- [x] Zona waktu aplikasi dari `APP_TIMEZONE`, bawaan `Asia/Jakarta`; dua tes regresi 31 Desember 23.59 WIB dan 1 Januari 00.01 WIB memastikan tahun/urutan benar. `php artisan test`: 179 tes / 1.856 assertions lulus (24 Oktober 2026; lihat `docs/progres-2026-10-24.md`).
- [x] Uji penomoran simultan multiproses pada PostgreSQL (pilihan K3): tiga kali lulus di PostgreSQL 18.6 lokal, masing-masing 30 proses PHP dan 30 sesi database menunggu bersamaan sebelum dilepas; nomor unik 1..30 tanpa celah, satu counter tahunan bernilai 30. Skrip mandiri `backend/tests/Concurrency/letter-number.php`; bukti di `docs/progres-2026-10-24.md`. Bukan verifikasi server produksi.
- [ ] Uji browser end-to-end register dengan Laravel langsung (bukan API tiruan).

## M4 — Pengaduan warga

**Dialihkan ke Google Form milik desa (keputusan 24 Oktober 2026).** Pengaduan tidak dibangun di website; website hanya menautkan formulir.

- [x] Env `NEXT_PUBLIC_COMPLAINT_FORM_URL` (hanya `https://forms.gle/` atau `https://docs.google.com/forms/`); bila ada, "Segera hadir" pengaduan diganti tautan "Sampaikan pengaduan" (tab baru, `rel="noopener noreferrer"`) di panel tugas beranda, menu desktop/ponsel, footer, dan `/kontak`, plus catatan larangan NIK/KK di `/kontak`. Tanpa iframe. Bila kosong tetap "Segera hadir". Bukti: `docs/progres-2026-10-24.md` (sesi Google Form).
- [ ] URL Google Form resmi dari desa diisi di env build produksi
- ~~Tabel `complaints`, riwayat `complaint_events`, status, endpoint publik/petugas, formulir dan cek status di website~~ — tidak dikerjakan (dialihkan ke Google Form)
- ~~Data dari desa: daftar kategori pengaduan dan penanggung jawab~~ — dikelola desa di Google Form, tidak dikerjakan di website

## M5 — Pengelolaan konten (CMS)

Bergantung pada K2 dan K4.

- [ ] Tabel: `village_profile` (satu baris: nama, alamat, jam layanan, kontak, visi, misi, sejarah, luas, jumlah dusun/penduduk), `officials` (perangkat desa), `posts` (berita/pengumuman), `agendas`, `bumdes_units`, `umkm`
- [ ] Endpoint publik `GET` per jenis konten
- [ ] CRUD di panel admin untuk peran `admin`, termasuk unggah foto konten
- [ ] Frontend membaca dari API, dengan cadangan `lib/data.ts` untuk mode demo
- [ ] Hapus semua keterangan "konten contoh" yang sudah diganti data resmi
  - [x] Konten potensi, BUMDes Watuagung Bangkit, lembaga aktif pada profil, dan program prioritas 2027 tanpa nominal dari RKP Desa 2027. Notice contoh di potensi/transparansi dihapus; notice BUMDes menjadi sumber. Lint, tsc, build, build:demo, test:demo dan visual empat halaman 390px/1440px lulus (25 Oktober 2026, `docs/progres-2026-10-25.md`). Bukan penyelesaian CMS atau seluruh konten situs.

## M6 — Unggah lampiran persyaratan

- [ ] Penyimpanan privat (bukan folder publik); hanya petugas yang bisa membuka
- [ ] Batasan: JPG/PNG/PDF, maksimal 2 MB per file; jumlah dan jenis file per layanan
- [ ] Hapus lampiran otomatis setelah masa retensi (ikut keputusan di M8)
- [ ] Ubah langkah "Cara mengajukan" di beranda setelah fitur aktif

## M7 — Penerbitan surat (PDF)

Bergantung pada K5 dan M2.

- [x] Template Blade sementara untuk empat jenis surat (`backend/resources/views/letters/`); format kop resmi masih menunggu. Empat PDF contoh dan draf diperiksa visual (21 Okt 2026).
- [x] Identitas wilayah, alamat kantor, dan penandatangan dari RKP Desa 2027 bagian 7 melalui env `LETTER_KABUPATEN`, `LETTER_KECAMATAN`, `LETTER_ALAMAT_KANTOR`, `LETTER_KEPALA_DESA`. Tes backend 183/1.925 assertions, lint, tsc, build, build:demo, test:demo lulus; empat PDF final + empat draf diperiksa visual (25 Okt 2026, `docs/progres-2026-10-25.md`). Kop resmi, kode desa, dan kode klasifikasi tetap menunggu F9b.
- [ ] Template per jenis surat sesuai format resmi desa (kop, nomor, penandatangan) — menunggu contoh surat asli; sementara petugas dapat mengunggah surat manual
- [ ] Format penomoran surat resmi dari desa — mesin penomoran/register dipisahkan ke M3a; kode klasifikasi dan kode desa masih `[PLACEHOLDER]`
- [x] Draf PDF bertanda DRAF untuk staff/admin/village_head saat PROCESSING/WAITING_APPROVAL; PDF final ber-QR saat `APPROVED`, disimpan terenkripsi di storage privat dengan SHA-256; siapa/kapan Kepala Desa menyetujui dicatat; setiap unduhan diaudit
- [x] Unggah surat manual hasil pindaian (staff/admin) yang menggantikan PDF otomatis dengan kode QR yang sama; unduh PNG QR untuk ditempel
- [x] Verifikasi publik `GET /verify/{kode}` (30/menit) dan halaman statis `/verifikasi/`: nomor, jenis, tanggal terbit, nama tersamar, sah/dibatalkan; catatan hukum TTE/BSrE di `PRODUCT.md`
- [x] Verifikasi teknis sesi PDF: `php artisan test` (177 tes, 1.838 assertions), lint, tsc, build, build demo, test:demo dan `test-admin-filters` lulus; PDF contoh empat jenis + draf diperiksa visual. Bukti di `docs/progres-2026-10-21.md`.
- [ ] Uji manual end-to-end dengan Laravel lokal (alur persetujuan → unduh → unggah → pindai QR dengan ponsel) dan pemeriksaan visual halaman terkait pada 390px/1440px — menunggu pengguna. Pastikan migration dan `LETTER_VERIFY_URL` pada lingkungan uji sudah sesuai.
- [ ] Data dari desa: contoh surat asli tiap jenis, format nomor, nama dan jabatan penandatangan
- [ ] TTE tersertifikasi (BSrE) — di luar lingkup sampai ada kerja sama resmi

## M8 — Kesiapan produksi

Wajib selesai sebelum menerima data warga nyata.

- [ ] Hosting backend + database produksi (K2, K3)
- [x] Kompatibilitas PostgreSQL lokal (24 Oktober 2026): 179 tes / 1.858 assertions pada PostgreSQL 18.6; SQLite tetap lulus 179 tes / 1.856 assertions. Seluruh 13 migration lulus `migrate:fresh`, rollback sampai habis, lalu migrate ulang. Panduan di `backend/README.md`, bukti di `docs/progres-2026-10-24.md`; bukan verifikasi hosting atau konkurensi multiproses.
- [ ] HTTPS, CORS sesuai domain, backup terjadwal
- [ ] Kebijakan retensi dan penghapusan data pemohon (sesuai UU PDP)
- [x] Implementasi bantuan buat ulang kode akses: `POST /staff/applications/{request_id}/lookup-secret` dan dialog di detail permohonan untuk staff/admin/RT/RW, sesuai wilayah; kode lama tidak berlaku, kode baru ditampilkan sekali, riwayat dan audit dicatat. Feature test, lint, tsc dan build lulus pada sesi kode akses (lihat `docs/progres-2026-10-21.md`). Ini bukan OTP/pemulihan mandiri.
- [ ] Uji manual bantuan kode akses dan tetapkan prosedur operasional pemeriksaan KTP/KK serta petugas yang melayani sebelum produksi. OTP WhatsApp/SMS belum dibuat; tidak wajib bila jalur bantuan sudah dipilih dan diverifikasi.
- [x] Tempat dan tanggal lahir pemohon terenkripsi (cast `encrypted`, migration mengenkripsi baris lama, rollback mendekripsi). `nama` tetap teks biasa. SQLite 182 tes / 1.879 assertions dan PostgreSQL 18.6 182 tes / 1.881 assertions lulus (24 Oktober 2026, `docs/progres-2026-10-24.md`).
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
