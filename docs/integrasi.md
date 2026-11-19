# Integrasi pelayanan Watuagung

## Arsitektur saat ini

Frontend menggunakan Next.js App Router, React, TypeScript, dan Tailwind CSS. Form menggunakan React Hook Form dan Zod. Backend pelayanan menggunakan Laravel 13 dan Sanctum. Petunjuk Google Apps Script sebelumnya sudah tidak berlaku; tidak ada migrasi backend dalam pembaruan layout ini.

- `components/`: komponen bersama.
- `features/`: formulir, hasil pengajuan, cek status, dan panel petugas.
- `services/pelayanan.ts`: transport JSON API, multipart unggah, dan simulasi browser.
- `lib/validation.ts` dan `types/pelayanan.ts`: validasi dan kontrak frontend.
- `backend/routes/api.php`: endpoint Laravel.

## Mode simulasi dan API

Tanpa `NEXT_PUBLIC_API_URL`, pelayanan publik memakai simulasi. localStorage menyimpan maksimal 50 receipt (nomor, status, penanda sukses, `jenis_surat`), bukan identitas formulir. Receipt demo lama tanpa `jenis_surat` tetap terbaca, tetapi linimasanya tidak ditampilkan. Contoh status tersedia di adapter pelayanan. Panel petugas tidak aktif dalam mode ini. Gunakan data fiktif.

Untuk API lokal, isi `.env.local` dengan:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
```

Jangan menimpa konfigurasi lokal yang sudah digunakan. Variabel NEXT_PUBLIC disertakan dalam bundle browser dan tidak boleh berisi kredensial. Restart server frontend setelah perubahan konfigurasi, atau build ulang untuk hosting statis.

Jalankan Laravel sesuai [README backend](../backend/README.md). Atur `FRONTEND_ORIGINS` backend sesuai origin frontend. Integrasi memakai bearer token, bukan cookie lintas-origin.

## Kontrak API

Path berikut relatif terhadap `/api/v1`. Transport menggunakan `Accept: application/json` dan `Content-Type: application/json`, tanpa field `action`; pengecualian: unggahan berkas, termasuk `POST /applications`, memakai `multipart/form-data`.

| Metode | Path | Permintaan / kegunaan |
| --- | --- | --- |
| POST | `/applications` | Publik, 5/menit | **Multipart**: field sesuai [Submission](../types/pelayanan.ts) dan [aturan per jenis surat](#enam-jenis-surat-final-s1-8-november-2026) + file wajib `lampiran[KTP]`, `lampiran[KK]`, `lampiran[PENGANTAR_RT_RW]` ([lampiran](#lampiran-persyaratan-m6-16-november-2026)); JSON tanpa lampiran → 422 per dokumen; SKU/KTP_KK → 422. Respons 201 menambah `lampiran: AttachmentKind[]` |
| POST | `/applications/letter` | Publik, 10/menit per IP + kunci kode akses bersama cek status | `request_id`, `lookup_secret`; PDF scan surat (attachment). 404 belum tersedia, 410 masa unduh berakhir. Lihat [alur online](#alur-online-unduh-surat-oleh-warga-19-november-2026) |
| POST | `/applications/attachments` | Publik, 5/menit + kunci kode akses bersama cek status | Multipart `request_id`, `lookup_secret`, satu atau lebih `lampiran[KIND]`; hanya saat `NEED_REVISION` (lain 422); respons [AttachmentReplaceResponse](../types/pelayanan.ts). Lihat [penggantian lampiran](#akses-petugas-penggantian-dan-retensi-lampiran-17-november-2026) |
| POST | `/applications/status` | `request_id` dan `lookup_secret`; 5 kode salah per nomor → 429 selama 15 menit. Respons menambah `lampiran: AttachmentKind[]` (jenis yang diterima saja), `letter_available: boolean`, dan `letter_available_until: string \| null` |
| POST | `/staff/login` | `username` dan `password`; kompatibilitas klien lama: `email` dan `password`; respons bearer token |
| POST | `/staff/logout` | Ability `panel`: mencabut token petugas aktif |
| GET | `/staff/me` | Ability `panel`, profil petugas pemilik token: `{ name, username, role, rt, rw, must_change_password, features: { neighborhood_approval: boolean }, abilities: string[] }`; enam peran tetap dikenal, tetapi RT/RW mendapat 403 saat fitur mati; `rt`/`rw` nullable (3 digit untuk ketua RT/RW); dipakai untuk memvalidasi sesi dan kemampuan panel |
| GET | `/staff/users` | Admin: daftar akun dan `warnings` wilayah tanpa ketua aktif |
| POST | `/staff/users` | Admin: `name`, `username`, `role`, kata sandi sementara (min. 10), `rt`/`rw` sesuai peran |
| PATCH | `/staff/users/{id}` | Admin: `name`, `role`, `is_active`, `rt`, `rw`; nonaktif → token dicabut |
| POST | `/staff/users/{id}/reset-password` | Admin: kata sandi sementara baru (min. 10), wajib ganti, semua token akun dicabut |
| POST | `/staff/me/password` | Semua peran: `old_password` + kata sandi baru (min. 10); token lain dicabut |
| GET | `/staff/summary` | Ability `applications:manage` (bukan KIM), lima peran pelayanan: `by_status`, `my_queue`, `today`, `oldest`; scope wilayah/jenis sama dengan daftar, `Cache-Control: private, no-store` |
| GET | `/staff/applications` | Ability `applications:manage` (bukan KIM), daftar paginasi, dibatasi wilayah dan jenis surat RT/RW (tanpa SKU) untuk `rt_head`/`rw_head` (`page` ≥ 1, 20 per halaman). Filter opsional `status` (satu) **atau** `statuses[]` (beberapa), tidak boleh keduanya; `q` (maksimal 100 karakter) mencari sebagian nomor/nama secara literal dan tidak peka huruf besar/kecil, `jenis_surat` = `DOMISILI`/`SKTM`/`BELUM_MENIKAH`/`KERAMAIAN`/`KEHILANGAN`/`UMUM` serta kode lama `SKU`/`KTP_KK`, `sort` = `terbaru` (bawaan)/`terlama`. Tiap item ([StaffApplication](../types/pelayanan.ts)) memuat `allowed_transitions`, tanpa data pribadi sensitif atau catatan bebas |
| GET | `/staff/applications/{request_id}` | Detail terotorisasi untuk lima peran pelayanan dengan `applications:manage` (bukan KIM): data pemohon (termasuk data diri surat final), isian khusus per jenis, usaha (data lama), keperluan, catatan, `allowed_transitions`, dan riwayat status. Ketua RT/RW hanya untuk wilayahnya (di luar wilayah → 404) dan menerima versi terbatas. Respons `Cache-Control: no-store`; akses berhasil dicatat di `audit_logs` |
| PATCH | `/staff/applications/{request_id}/isi-keterangan` | Staff/admin, 30/menit: `isi_keterangan` (2–500) untuk UMUM sebelum `WAITING_APPROVAL`; respons [StaffStatementResponse](../types/pelayanan.ts). Lihat [sunting isi keterangan](#sunting-isi-keterangan-umum) |
| PATCH | `/staff/applications/{request_id}/status` | Ability `applications:manage` (bukan KIM), `status` dan `catatan`; respons ([StaffStatusResponse](../types/pelayanan.ts)) memuat `allowed_transitions` baru |
| GET | `/staff/applications/{request_id}/letter.pdf` | Staff/admin/village_head: draf (PROCESSING/WAITING_APPROVAL) atau final (sejak APPROVED); diaudit |
| POST | `/staff/applications/{request_id}/letter.pdf` | Staff/admin: multipart `file` PDF ≤ 5 MB (scan surat bertanda tangan), saat APPROVED/READY_FOR_PICKUP. Saat APPROVED status otomatis → READY_FOR_PICKUP; respons `{ success, status, letter }`. Lihat [alur online](#alur-online-unduh-surat-oleh-warga-19-november-2026) |
| GET | `/staff/applications/{request_id}/letter-qr.png` | Staff/admin: PNG QR verifikasi |
| GET | `/staff/applications/{request_id}/attachments/{id}` | Staff/admin/village_head (bukan RT/RW, bukan KIM), 60/menit: isi lampiran didekripsi; audit `attachment.viewed` setiap kali. Lihat [akses lampiran](#akses-petugas-penggantian-dan-retensi-lampiran-17-november-2026) |
| GET | `/verify/{kode}` | Publik, 30/menit: [LetterVerification](../types/pelayanan.ts) |
| GET | `/posts` | Publik, 60/menit: berita terbit, 10 per halaman ([PublicPostsPage](../types/posts.ts)) |
| GET | `/posts/{slug}` | Publik, 60/menit: detail + `body`; draf/terhapus/belum waktunya 404 |
| GET/POST | `/staff/posts` | Admin/staff/kim (`media:manage`): daftar (`status`, `q`, `page`) / buat berita |
| GET/PATCH/DELETE | `/staff/posts/{id}` | Admin/staff/kim (`media:manage`): detail, ubah sebagian, soft delete + hapus file sampul |
| POST/DELETE | `/staff/posts/{id}/cover` | Admin/staff/kim (`media:manage`), berbagi 10/menit per akun: unggah multipart `file` / hapus sampul; 200 detail berita terbaru |
| GET/POST | `/staff/businesses` | Admin/staff/kim (`media:manage`): daftar / buat UMKM |
| GET/PATCH/DELETE | `/staff/businesses/{id}` | Admin/staff/kim (`media:manage`): detail termasuk field pemilik, ubah, soft delete + hapus file foto |
| POST/DELETE | `/staff/businesses/{id}/photo` | Admin/staff/kim (`media:manage`), 10/menit: unggah / hapus foto |

Pengajuan berhasil mengembalikan HTTP 201 dengan `success`, `request_id`, `status`, `jenis_surat`, `requires_neighborhood_approval: boolean`, dan `lookup_secret`. Cek status mengembalikan `request_id`, `jenis_surat`, `requires_neighborhood_approval: boolean`, `status`, serta catatan, bukan identitas sensitif. Boolean dihitung oleh `LetterType` backend dari konfigurasi aktif; frontend memilih tahap RT/RW dari boolean ini, bukan tabel jenis surat duplikat. Penolakan RT/RW historis tetap diberi awalan "Ditolak oleh Ketua RT/RW". Respons validasi gagal menggunakan HTTP 422. Frontend membatasi waktu tunggu JSON API menjadi 20 detik, unggah pengajuan 120 detik, dan memvalidasi respons pelayanan dengan Zod.

**Keputusan klien 2 November 2026:** RT/RW nonaktif secara bawaan; verifikasi SQLite/PostgreSQL lulus, lihat `docs/progres-2026-11-02.md`. Satu-satunya sakelar adalah `letters.neighborhood_approval` dari env backend `LETTER_NEIGHBORHOOD_APPROVAL=false`, ditambahkan ke `backend/config/letters.php` yang sudah ada tanpa menimpa konfigurasi penerbitan surat. Tidak ada env frontend untuk sakelar ini. Teks publik statis dan simulasi memakai alur bawaan langsung ke kantor. Formulir tidak lagi mengimpor/menampilkan autofill identitas dummy; kolom alamat RT/RW, file `lib/dummy-residents.ts`, dan tes fixture dipertahankan. Model/tabel/migration `residents` tetap hanya untuk seeder/tes, tanpa referensi route atau fitur produksi.

### Peran dan ability panel (KIM)

`kim` berlabel **KIM (Media Informasi)**. Enam peran dikenal; empat dapat masuk secara bawaan (admin, staff, village_head, kim), RT/RW hanya saat fitur aktif. Ability dikirim sebagai array `abilities` oleh `/staff/me`, bersama field profil dan `features` yang sudah ada. Token dan hak peran/akun aktif tetap diperiksa server, bukan hanya menu frontend.

| Ability / akses | Peran |
|---|---|
| `panel`: `/staff/me`, logout, ganti kata sandi sendiri | Semua peran yang boleh masuk panel |
| `applications:manage`: pengajuan, detail pemohon, status, ringkasan/dashboard | staff, admin, village_head; rt_head/rw_head hanya saat fitur aktif dan sesuai wilayah |
| `media:manage`: berita, UMKM, sampul/foto | admin, staff, kim; controller memakai `User::canManageMedia()` |
| `site:manage`: konten situs, gambar struktur, dokumen transparansi | admin, staff; `User::canManageContent()` memeriksa `site:manage` |
| `/staff/users…` dalam grup `applications:manage` | Hanya admin; ability pelayanan tidak memberi hak kelola akun kepada peran lain |

Pembatasan pelayanan yang lebih ketat tetap berlaku: buku registrasi/PDF hanya peran kantor sesuai endpoint; buat ulang kode akses bukan untuk village_head. KIM tidak dapat mengakses pemohon/pengajuan, dashboard/ringkasan, register, PDF/QR surat, buat ulang kode akses, akun pengguna, atau konten situs. Detail UMKM di panel tetap mengirim field pemilik yang diizinkan untuk pengelolaan; izin publik hanya menentukan penayangan kontak ke pengunjung.

Migration `2026_11_08_000001_revoke_staff_tokens_for_abilities` menghapus seluruh baris `personal_access_tokens` agar token lama tidak mempertahankan ability lama. Semua sesi harus login ulang setelah migration; `down()` tidak memulihkan token yang dihapus.

### Ringkasan dashboard dan tautan kartu

`GET /staff/summary` mengembalikan `StaffSummary`: `{ by_status: Record<Status, number>, my_queue: number, today: number, oldest: StaffApplication[] }` (item `oldest` hanya enam field daftar: `request_id`, `nama`, `jenis_surat`, `status`, `created_at`, `allowed_transitions`). Seluruh status hadir termasuk jumlah nol; `oldest` maksimal lima, urut waktu masuk lalu ID internal menaik. ID internal tidak dikirim.

Token wajib memiliki `applications:manage` dan akun panel aktif; tanpa token 401, ability/peran/akun salah 403. Seluruh respons termasuk kegagalan `private, no-store`. Semua angka memakai `forUser()`; RT/RW hanya wilayah dan surat yang memerlukan persetujuannya. `my_queue` diturunkan dari transisi `ApplicationStatus` per peran **dan jenis surat**, bukan salinan daftar status. Agregat dikerjakan database. `today` memakai rentang 00.00 hari ini hingga sebelum 00.00 besok pada zona waktu aplikasi.

Daftar `/staff/applications` menambah filter boolean `my_queue` dan `today` (`0`/`1`, opsional; invalid 422), digabung AND dengan filter yang sudah ada. Kartu Dashboard memakai `my_queue=1`, `today=1`, `status=WAITING_APPROVAL`, atau `status=READY_FOR_PICKUP` (bukan gabungan APPROVED). Filter dipertahankan pada pagination, detail, dan kembali; Hapus filter menghapusnya. Angka merupakan hasil saat permintaan, bukan pembaruan otomatis; Muat ulang mengambil ringkasan terbaru.

Dashboard bawaan tersedia bagi staff/admin/village_head; hanya saat fitur RT/RW aktif, kelima peran pelayanan (bukan KIM) dapat mengaksesnya dan kartu RT/RW menuju antrean masing-masing dengan `view=all`, yang mendukung filter status. Pembatasan server tetap berlaku. Demo tidak menampilkan dashboard/login dan tidak menghubungi API. Data ringkasan hanya di state halaman, tidak disimpan di browser storage.

### Berita (CMS C1–C2)

Rancangan: `docs/PROMPTS-CMS-BERITA.md`. Tipe API tetap `types/posts.ts` (tidak ada perubahan kontrak C4). Halaman publik memakai API melalui `services/posts.ts`; panel C3 sudah di-commit pada `1b2e6dd`, dengan verifikasi dan batas di `docs/progres-2026-11-02-c3.md`.

**Halaman publik C4:** `/berita/` memuat daftar di browser, dengan keadaan memuat/kosong/galat, coba lagi dan Muat lebih banyak. Beranda mengambil maksimal tiga item pertama; kosong/galat menyembunyikan bagian Kabar desa. `listPosts(page)` dan `getPost(slug)` memvalidasi respons Zod, timeout 20 detik, `cache: no-store`, tanpa token atau browser storage. API gagal tidak pernah diganti berita contoh. `NEXT_PUBLIC_SHOW_SAMPLE_CONTENT` hanya mengatur fallback berita bila tanpa API; build demo tetap memaksa tanpa API. Label Konten contoh hanya untuk item fallback.

Detail `/berita/baca/?slug=...` membaca query dalam `Suspense`, memperbarui `document.title`, dan merender paragraf teks (bukan HTML). Slug kosong atau API 404 menampilkan Berita tidak ditemukan; gangguan jaringan/format/server menampilkan coba lagi. Sampul native img hanya menerima URL HTTP(S), alt judul, lazy dan rasio tetap; tanpa sampul memakai pola visual lama.

**Kompatibilitas static export:** `generateStaticParams` tetap hanya slug demo (atau `belum-ada` bila contoh dimatikan), tanpa fetch API saat build. Route lama yang diekspor melakukan `location.replace` ke detail query dalam mode API. Slug lama lain ditangani komponen redirect di `app/not-found.tsx`; hosting wajib menyajikan `out/404.html` untuk path tidak dikenal, bukan halaman 404 bawaan hosting. Respons awal tetap HTTP 404 sebelum redirect browser; tanpa JavaScript tidak ada redirect. Tautan baru selalu detail query sehingga berita baru tidak membutuhkan HTML per slug atau build ulang. Env URL API tetap ditentukan saat build, bukan konfigurasi runtime.

**CORS (diperbaiki 6 November 2026):** `backend/config/cors.php` kini mengizinkan `GET, POST, PUT, PATCH, DELETE, OPTIONS` untuk origin `FRONTEND_ORIGINS` saja. Hapus berita/sampul dan UMKM/foto lewat panel lintas-origin (lokal `:3000` → `:8000`) berhasil; diuji E2E. Preflight bukan otorisasi: DELETE tetap butuh token dan peran yang benar. Produksi satu domain tidak memerlukan preflight.

- **Publik** (`/posts`, `/posts/{slug}`): tanpa token, `Cache-Control: public, max-age=60`. Hanya `status=published` dengan `published_at` ≤ sekarang, urut `published_at` menurun. Item: `slug`, `title`, `category`, `category_label`, `summary`, `published_at`, `cover_url` (URL publik absolut atau `null` bila tanpa sampul); detail menambah `body`. ID internal tidak dikirim.
- **Petugas** (`/staff/posts…`): token `media:manage` + peran `admin`/`staff`/`kim` aktif (`User::canManageMedia()`), termasuk endpoint sampul; tanpa token 401, peran lain 403. Respons `private, no-store`. Daftar 20 per halaman urut `updated_at` menurun, filter `status` = `draft`/`published`, `q` (maks. 100, potongan judul literal, tidak peka huruf besar/kecil); item = [StaffPost](../types/posts.ts) tanpa `body`. Berita terhapus 404 di semua endpoint.
- **Input**: `title` (≤160), `category` (`kegiatan_desa`, `pemerintahan`, `pembangunan`, `pemberdayaan`, `layanan_publik`, `ekonomi_lokal`, `pengumuman`), `summary` (≤300), `body` (≤20.000), `status`. Semua wajib saat POST, sebagian saat PATCH. Spasi luar dibuang; karakter kontrol ditolak (422), kecuali baris baru/tab di `body`. HTML tidak diproses: disimpan apa adanya, **frontend wajib merender sebagai teks**; paragraf dipisah baris kosong.
- **Terbit**: terbit pertama mengisi `published_at` = sekarang; kembali ke draf dan terbit ulang mempertahankan tanggal lama.
- **Slug**: `Str::slug(title)` (kosong → `berita`), unik termasuk berita terhapus dengan akhiran `-2`, `-3`. Mengikuti judul hanya selama belum pernah terbit; setelah itu tetap.
- **Audit**: `post.created`, `post.updated`, `post.published`, `post.deleted` (`subject_type=post`), hanya ID dan aksi. Unggah/hapus sampul memakai `post.updated`, tanpa nama file asli atau metadata gambar.
- **Sampul C2**: POST `/staff/posts/{id}/cover` menerima multipart `file` (FormData; jangan tetapkan Content-Type sendiri), DELETE menghapus sampul; keduanya berbagi 10/menit per akun. Respons 200 `StaffPostCoverResponse` = `StaffPostDetail`, `cover_url` terbaru atau null setelah hapus, `private, no-store`. Kontrak input/response di `types/posts.ts`, diekspor ulang lewat `types/pelayanan.ts`. Tanpa token 401, peran/ability salah 403, ID hilang/soft-deleted 404, invalid 422 (`errors.file`), throttle 429.
- **Validasi/proses**: JPG/JPEG/PNG/WebP ≤ 3.072 KiB, dimensi 1×1 sampai 6.000×6.000 px. Ukuran 600×400 px adalah saran ketajaman, bukan syarat unggah; foto lebih kecil diterima. Galat validasi file memakai bahasa Indonesia. GD membaca isi, kanvas piksel baru membuang EXIF/GPS; lebar maksimal 1.600 px, rasio tetap, tanpa memperbesar. WebP kualitas 80 bila didukung; selain itu JPEG kualitas 82 (transparansi putih). GD hilang → 503. UUID acak di `storage/app/public/posts`, tidak menyimpan file asli.
- **URL media**: `MEDIA_URL` URL dasar absolut disk public, tanpa `/posts`; kosong/tidak diisi memakai `${APP_URL}/storage` Laravel (`php artisan storage:link` untuk lokal). Produksi `MEDIA_URL=https://[DOMAIN]/media`, sesuai `APP_URL`; hasil `/media/posts/<uuid>.webp` atau `.jpg`. Cache ulang konfigurasi setelah mengganti env. Jangan memakai `/media/posts` sebagai MEDIA_URL karena path tersimpan sudah diawali `posts/`.
- **Siklus file**: transaksi mengunci berita dan menyimpan path + audit; kegagalan DB membersihkan file baru, mempertahankan file lama. Penggantian/hapus sampul menghapus file lama setelah commit. Gagal hapus file lama → 500 dengan pesan sampul sudah diperbarui; administrator perlu membersihkan sisa. Soft delete berita mengosongkan `cover_path` dalam transaksi lalu menghapus file sampul setelah commit; berita yang dipulihkan lewat database tidak bersampul. Gagal hapus file tidak membatalkan penghapusan (dicatat di log). File publik tetap dapat dibaca bila URL diketahui, termasuk draf/terhapus; bukan tempat dokumen pribadi. Retensi permohonan F10 tidak menyentuh berita; pembersihan berkala: `php artisan media:prune [--dry-run]` (harian) menghapus file `posts/` dan `businesses/` yang tidak dirujuk berita/UMKM aktif dan berumur > 1 jam, serta mengosongkan path pada baris yang sudah terhapus.

### UMKM warga (API, 5 November 2026)

Tipe: `types/business.ts`, diekspor ulang lewat `types/pelayanan.ts`. Pola sama dengan berita C1–C2.

**Layar (5 November 2026):** panel `/admin/umkm/` (daftar + filter nama/kategori/status), `/admin/umkm/tambah/`, `/admin/umkm/ubah/?id=` untuk admin/staff/kim, menu "UMKM". Formulir: nama, kategori, dusun, deskripsi, foto, nama pemilik, WhatsApp, centang izin "Pemilik sudah mengizinkan nama dan nomornya ditampilkan di website"; teks disimpan dulu lalu foto (pola editor berita). Publik `/umkm/` (tombol filter kategori `aria-pressed`, kartu berfoto, Muat lebih banyak) dan `/umkm/lihat/?slug=` (tombol **Chat WhatsApp** ke `wa.me` di tab baru hanya bila server mengirim nomor). Kartu beranda "UMKM Watuagung" menampilkan 3 usaha terbaru (`sort=latest`); kosong/galat/demo tetap "Segera hadir". `services/businesses.ts` memvalidasi Zod ketat, timeout 20 detik, no-store, tanpa token; mode demo/tanpa API mengembalikan daftar kosong dan tidak memanggil API (tidak ada UMKM contoh). Menu header/footer menautkan `/umkm`.

- **Publik** `GET /businesses?category=&sort=&page=` dan `GET /businesses/{slug}`: tanpa token, 60/menit per IP, `Cache-Control: public, max-age=60`. Hanya `status=published` dengan `published_at` ≤ sekarang; daftar 12 per halaman, `sort=name` (bawaan, urut nama) atau `sort=latest` (terbit terbaru); nilai lain 422. `category` harus salah satu kategori (lain 422), `page` ≥ 1. Item: `slug`, `name`, `category`, `category_label`, `description`, `hamlet`, `photo_url`, `published_at`. Draf, terjadwal, terhapus, atau slug tak dikenal → 404. ID internal tidak dikirim.
- **Kontak pemilik**: `owner_name` dan `whatsapp` hanya ditambahkan bila `consent_public_contact` true. Tanpa izin key-nya **tidak ada** (bukan null); `consent_public_contact` sendiri tidak dikirim ke publik. Kedua field memakai cast `encrypted` di database dan tidak pernah muncul di daftar petugas atau audit.
- **Petugas** `/staff/businesses…`: token `media:manage` + `User::canManageMedia()` (admin/staff/kim aktif), termasuk endpoint foto; tanpa token 401, peran lain/akun nonaktif/ability salah 403 sebelum validasi atau pencarian ID. Respons `private, no-store`. Daftar 20 per halaman urut `updated_at`, filter `status`, `category`, `q` (≤100, potongan nama literal, tidak peka huruf besar/kecil); item `StaffBusiness` tanpa deskripsi dan tanpa kontak. Detail/POST (201)/PATCH mengembalikan `StaffBusinessDetail` termasuk kontak. DELETE soft delete; terhapus 404 di semua endpoint.
- **Input**: `name` 1–120, `category` (`makanan_minuman`, `kerajinan`, `pertanian_peternakan`, `jasa`, `perdagangan`, `lainnya`; label "Makanan & Minuman", "Kerajinan", "Pertanian & Peternakan", "Jasa", "Perdagangan", "Lainnya"), `description` 1–3.000 (baris baru boleh, kontrol lain termasuk tab ditolak), `status` wajib saat POST; `hamlet` (`Watuagung`/`Talang`/`Sekar`/null), `owner_name` (≤120, null), `whatsapp` (null atau `62` + 8–13 digit, tanpa `+`/spasi), `consent_public_contact` (boolean, bawaan false) opsional. PATCH sebagian. Spasi luar dibuang; HTML disimpan apa adanya, frontend wajib merender teks.
- **Terbit/slug**: sama dengan berita: terbit pertama mengisi `published_at`, draf ulang mempertahankannya; slug `Str::slug(name)` (kosong → `umkm`), unik termasuk terhapus (`-2`, `-3`), mengikuti nama hanya sebelum pernah terbit.
- **Foto** POST/DELETE `/staff/businesses/{id}/photo`: multipart `file`, 10/menit per akun bersama. `ImageProcessor` JPG/JPEG/PNG/WebP ≤3.072 KiB, dimensi 1×1–6.000×6.000 (600×400 hanya saran ketajaman; foto lebih kecil diterima), galat validasi file bahasa Indonesia, lebar maksimal 1.600 px tanpa memperbesar, EXIF/GPS dibuang, `businesses/<uuid>.webp|.jpg` di disk public. Respons detail terbaru; ganti/hapus menghapus file lama setelah commit; soft delete mengosongkan `photo_path` dan menghapus file setelah commit (sisa dibersihkan `media:prune`). Foto publik bila URL diketahui; jangan unggah dokumen/identitas.
- **Audit**: `business.created`, `business.updated` (termasuk foto), `business.published`, `business.deleted`, `subject_type=business`, hanya aksi dan ID.
- **CORS**: `DELETE` diizinkan sejak 6 November 2026 (lihat catatan CORS di bagian Berita); hapus usaha/foto lewat panel lintas-origin berhasil.

### Bagian situs (backend R3, 3 November 2026)

Tipe: `types/site.ts`, diekspor ulang lewat `types/pelayanan.ts`. **Visi-misi tetap statis** di `lib/data.ts`, berubah saat pergantian Kepala Desa, bukan key CMS.

**Pembaruan R4 (4 November 2026):** `profile` menerima `profileDetails` opsional, bentuk sama dengan `pages.profil.profileDetails` di `lib/data.ts`. Profil lama tanpa details tetap valid; `history` tetap menolak field ini. Bila dikirim, semua field wajib kecuali `stats.*.detail`:

| Field | Aturan |
|---|---|
| `themes` | list 0–6, tiap item 1–160 |
| `stats` | list 0–6 `{ value, label, detail? }`; `value`/`label` 1–160, `detail` bila ada 1–1.000 |
| `location` | 1–1.000 |
| `boundaries` | tepat 4 `{ direction, place }`, urutan `Utara`, `Timur`, `Selatan`, `Barat`; `place` 1–1.000 |
| `institutions` | list 0–20 `{ name, description }`; `name` 1–160, `description` 1–2.000 |
| `source` | 1–1.000 |

Field asing ditolak di tiap tingkat; karakter kontrol ditolak (CR/LF hanya di `blocks.*.text`). `site:import-defaults` mengisi details dari `lib/data.ts` hanya untuk key yang belum ada.

- **Panel**: `/admin/konten/profil/` dan `/admin/konten/sejarah/` (admin/staff; server tetap memeriksa peran). GET staff 404 memulai dari nilai `lib/data.ts`; profil lama tanpa details memakai details statis. Simpan = PUT seluruh objek; peringatan saat meninggalkan perubahan belum disimpan.
- **Kontak kantor (R4, 5 November 2026)**: panel `/admin/konten/kontak/` (admin/staff) menyunting enam field `contact`, dengan pratinjau peta bila URL sematan valid. `/admin/konten/` menampilkan kartu profil/sejarah/kontak dengan "Terakhir diubah …" atau "Belum pernah diubah — website memakai isi bawaan". Publik: `ContactProvider` di `PublicShell` mengambil `GET /site/contact` **sekali per halaman**; `useContact()` dimulai dari `contact` di `lib/data.ts` lalu ditimpa respons yang lolos `contactSchema`. Dipakai beranda (panel tugas), `/kontak/`, menu, footer, dan `/kebijakan-privasi/`. Demo/404/galat tetap memakai nilai statis, tanpa kedip kosong.
- **Galat panel**: 422 dari `/staff/site/{key}` dibaca sebagai `AdminValidationError`; key server `data.<field>` (mis. `data.phone`) dibuang prefix `data.` lalu ditampilkan di bawah field (`aria-invalid`) dan di ringkasan bertaut. Validasi Zod klien memakai pesan yang sama sebelum dikirim. Sukses: "Perubahan tersimpan dan langsung tampil di website." (semua bagian situs, termasuk video).
- **Publik**: `/profil/` dan `/sejarah/` merender `lib/data.ts` lebih dulu, lalu `getSiteSection()` (`services/site.ts`, browser, `no-store`, timeout 20 detik, tanpa token) mengganti isi bila respons lolos skema Zod ketat. Demo, 404, format salah, atau galat jaringan tetap memakai data statis. Peta dan judul halaman tidak dari CMS. Teks dirender sebagai teks React, bukan HTML.

| Metode | Path relatif `/api/v1` | Kontrak |
|---|---|---|
| GET | `/site/{key}` | Publik, 60/menit per IP; 200 `{ key, data, updated_at }`, `public, max-age=60`; belum diisi/key tidak dikenal 404 |
| GET | `/staff/site/{key}` | Staff/admin aktif + ability `site:manage`; objek yang sama, belum diisi 404 |
| PUT | `/staff/site/{key}` | Body `{ "data": { ... } }`; ganti seluruh objek (bukan merge), buat bila belum ada; 200 objek terbaru |
| POST | `/staff/site/{key}/image` | Multipart `file`, 10/menit per akun; hanya `structure` aktif, respons `{ path, url }`; key lain 422 `errors.file` |

Semua endpoint petugas situs, termasuk unggah gambar/dokumen, memeriksa `User::canManageContent()` (`site:manage`) di server. Tanpa token 401; peran lain (termasuk KIM/Kepala Desa/RT/RW), akun nonaktif, atau ability salah 403 **sebelum** pencarian key. Key tidak dikenal 404 setelah otorisasi. Respons petugas, termasuk kegagalan, `private, no-store`. CORS mengizinkan PUT dan (sejak 6 November 2026) DELETE.

Validasi terpusat di `App\\Domain\\SiteSectionRules`, key di enum `App\\Domain\\SiteSection`:

- `profile` dan `history`: `intro` wajib teks 1–2.000 karakter; `blocks` wajib list 1–20 baris. Tiap baris hanya `title` (1–160) dan `text` (1–10.000). Judul halaman/eyebrow tetap milik frontend.
- `contact`: seluruh enam field wajib hadir: `address` (1–1.000), `hours` (1–200), `contactName` (1–160); `phone` (maks. 15), `mapsEmbedUrl`/`mapsLinkUrl` (maks. 2.048) boleh `""` atau `[PLACEHOLDER]`. Nomor selain itu wajib digit `62` diikuti 1–13 digit. Nomor kantor publik berizin, **bukan** telepon warga.
- Embed wajib URL valid berawalan `https://www.google.com/maps/embed?`; link wajib `https://maps.app.goo.gl/` atau `https://www.google.com/maps/`. Tidak menerima HTML iframe, domain tiruan, atau protokol lain.
- `statistics`: key dikenal tetapi seluruh PUT ditolak 422 `errors.data`, termasuk objek kosong; skema menyusul R5.
- **Video YouTube (R8, 5 November 2026)**: `videos` **tersimpan dan dikirim** sebagai `{ profile: { youtubeId, title } | null, tutorial: { youtubeId, title } | null }` (`SiteVideos`). `youtubeId` cocok `^[A-Za-z0-9_-]{11}$`; URL tidak pernah disimpan.
  - **Body PUT berbeda dari respons** (`SiteVideosInput`, `SiteSectionUpdate<'videos'>`): `{ data: { profile: { url, title } | null, tutorial: { url, title } | null } }`. Kedua key wajib hadir (null = tanpa video); field asing di tiap tingkat ditolak, termasuk mengirim `youtubeId` langsung. `url` 1–2.048, `title` 1–160 tanpa karakter kontrol (CR/LF juga ditolak); keduanya di-trim.
  - Server (`SiteSectionRules::youtubeId`) mengekstrak ID dari `http(s)://` host `youtube.com`, `www.youtube.com`, `m.youtube.com` path `/watch?v=<id>`, `/shorts/<id>`, `/embed/<id>` (garis miring akhir boleh), atau `youtu.be/<id>`. Query lain (`t`, `si`, `feature`) dan fragmen diabaikan. Tanpa skema, ID polos, host lain/tiruan (termasuk `youtube-nocookie.com`), userinfo, port, path lain, ID bukan 11 karakter, atau HTML iframe → 422 `errors["data.<slot>.url"]`. `lib/youtube.ts` adalah cermin klien untuk pratinjau; server tetap penentu.
  - Respons tanpa field tambahan (`{ key, data, updated_at }`); tidak ada unggah file, tidak ada nilai awal di `site:import-defaults` (`lib/data.ts` `videos` = keduanya null).
  - Panel `/admin/konten/video/` (admin/staff): dua kartu **Video profil desa** dan **Video tutorial pengajuan surat** berisi link YouTube, judul, pratinjau, dan **Hapus video**. Link dan judul kosong dikirim null; ID tersimpan ditampilkan kembali sebagai `https://www.youtube.com/watch?v=<id>`. Kerangka R4 (Simpan, galat per field, peringatan keluar).
  - Publik: `SiteVideo` memanggil `getSiteSection('videos')` di browser (tanpa token, no-store); demo/404/galat memakai `videos` di `lib/data.ts`. Video profil tampil di `/profil/` (di bawah ringkasan) dan beranda (di atas Kabar desa); tutorial di `/pelayanan/` (di bawah Cara mengajukan surat). Slot null → bagian tidak dirender.
  - `YouTubeEmbed`: gambar mini `https://i.ytimg.com/vi/<id>/hqdefault.jpg` + tombol **Putar video** (≥48px); iframe `https://www.youtube-nocookie.com/embed/<id>?autoplay=1&rel=0` baru dimuat setelah diklik, `title` = judul video, `referrerpolicy="strict-origin-when-cross-origin"`. CSP: lihat `docs/deploy-plan.md`.
- **Struktur pemerintahan (R7, 5 November 2026)**: `structure` menerima `{ chartImagePath?, chartAlt?, blocks, source }`. `blocks` list 1–20 `{ title, text }` dengan batas/kontrol sama seperti profil (160/10.000; CR/LF hanya teks blok), `source` wajib 1–1.000. `chartAlt` maks. 300, wajib tidak kosong bila ada gambar. Field asing ditolak. Tanpa gambar, hilangkan `chartImagePath` (bukan null/string kosong).
  - `POST /staff/site/structure/image`: JPG/JPEG/PNG/WebP ≤5.120 KiB (5 MiB), dimensi 600×400–6.000×6.000. `ImageProcessor` encode ulang tanpa EXIF/GPS, rasio tetap, lebar maksimal **2.400 px** tanpa memperbesar; WebP kualitas 80 atau JPEG 82. Disk public `site/structure/<uuid>.webp` atau `.jpg`; respons `{ path, url }`. GD tidak tersedia 503; unggahan gagal 422; otorisasi/cache sama dengan endpoint staff situs. `allowsImages()` hanya true untuk Structure.
  - PUT hanya menerima path dengan prefix/nama UUID tersebut dan file yang ada di disk public, bukan URL bebas/path berita. GET publik/staff dan PUT sukses menambah `image_url: string | null` di luar `data`, URL dari disk public. Unggah belum menerbitkan gambar: PUT menyimpan referensi.
  - PUT structure memakai lock per host dari validasi file hingga commit/cleanup. Gambar lama dihapus setelah PUT berhasil mengganti/menghapus referensi; validasi/audit gagal mempertahankan file lama. Unggahan yang belum pernah disimpan belum dibersihkan berkala; multi-host perlu lock bersama. Gambar publik saja, bukan dokumen pribadi.
  - Panel `/admin/konten/struktur/` untuk admin/staff: unggah/ganti/hapus dengan pratinjau, deskripsi pembaca layar, blok nama/jabatan dan sumber. Simpan memakai kerangka R4; perubahan belum disimpan memicu peringatan keluar.
  - Publik `/struktur-pemerintahan/` merender blok dan sumber `lib/data.ts` lebih dulu, lalu `getSiteEnvelope('structure')` di browser tanpa token/no-store. Demo/404/galat tetap statis. Bila ada gambar, tampil sebelum daftar nama/jabatan teks, tombol **Perbesar gambar** membuka file di tab baru tanpa lightbox. Seluruh isi teks React, bukan HTML mentah.
- **Transparansi/APBDes (R6, 5 November 2026)**: `transparency` menerima tepat `{ intro, programs, budgets }`. `intro` 1–2.000; `programs` list 1–20 `{ title, text }` dengan batas sama seperti `blocks`; CR/LF boleh di `programs.*.text`. `budgets` list 0–5 tahun, masing-masing:
  - `year`: integer JSON 2000–2099, unik; `status`: `Rancangan`, `Ditetapkan`, atau `Perubahan`.
  - `revenue`: 1–20 `{ label, amount }`; `spending`: tepat 5 baris dengan label/urutan tetap: Penyelenggaraan Pemerintahan Desa; Pelaksanaan Pembangunan; Pembinaan Kemasyarakatan; Pemberdayaan Masyarakat; Penanggulangan Bencana, Keadaan Darurat, dan Mendesak.
  - `financing`: opsional, list 0–10 `{ label, amount }`. Semua label 1–160; amount **integer JSON** rupiah 0–100.000.000.000, bukan string/desimal/negatif.
  - `source`: wajib 1–1.000. `documentPath`: opsional, `site/documents/<uuid>.pdf` hasil unggah dan harus ada pada disk `public`.
  - **Field total apa pun ditolak** sebagai field asing. Server menyimpan rincian saja. `budgetTotals()` di `lib/transparency.ts` dipakai panel/publik untuk total pendapatan, belanja, pembiayaan, dan surplus/defisit = pendapatan − belanja. Pembiayaan ditampilkan terpisah, bukan pembiayaan netto.
  - GET publik/staff dan PUT sukses untuk key ini menambah `document_urls: { [path]: url }` **di luar `data`**, termasuk `{}` saat kosong. URL dari `Storage::disk('public')->url()`. Key lain tidak berubah.
  - `POST /staff/site/transparency/document`: multipart `file`, 10/menit per akun; PDF magic `%PDF-`, maksimal 10.240 KiB (10 MiB). Sukses `{ path, url }`, nama UUID `.pdf` pada disk public `site/documents/`. Tanpa token 401, peran salah 403, file hilang/bukan PDF/terlalu besar atau key lain 422, key tak dikenal 404 setelah otorisasi. `allowsDocuments()` hanya aktif untuk transparency.
  - PUT transparency memakai `flock` per host dari validasi keberadaan PDF sampai commit/penghapusan; PUT lain menunggu agar tak menerbitkan ulang referensi PDF yang sedang dihapus. Mendukung deployment satu VPS; multi-host memerlukan lock bersama. Setelah PUT berhasil commit, dokumen lama yang tidak dirujuk lagi dihapus. Unggahan yang belum pernah disimpan lewat PUT belum dibersihkan berkala. Dokumen publik saja, jangan unggah data pribadi.
  - Panel `/admin/konten/transparansi/` (admin/staff): pilih/tambah maksimal 5 tahun, baris pendapatan/pembiayaan, 5 bidang belanja, total berjalan, sumber, unggah/lepas PDF, blok program. Unggahan mengunci formulir sementara; Simpan menerbitkan seluruh objek.
  - Publik `/transparansi/`: statis `pages.transparansi` lebih dulu, lalu `getSiteEnvelope('transparency')` sekali di browser; demo/404/galat tetap statis. Program di atas kartu APBDes terbaru dahulu, rincian tabel bergulir, format `Rp1.234.567`, total/selisih/sumber, tautan PDF. Anggaran kosong: **APBDes resmi belum diunggah.** Tanpa grafik/dependensi baru.
- Field asing di semua tingkat ditolak, bukan diabaikan. Semua teks di-trim; karakter kontrol ditolak sebelum trim. **Pengecualian disetujui:** CR/LF boleh hanya di `blocks.*.text` dan `programs.*.text` demi isi multiline saat ini; tab/NUL/DEL/kontrol lain ditolak. HTML disimpan sebagai teks biasa; React wajib merender teks, jangan `dangerouslySetInnerHTML`.

Tabel `site_sections`: `key` primary unik, `data` JSON, `updated_by` FK users nullable/nullOnDelete, timestamps. Data publik saja; jangan simpan identitas warga, NIK/KK, token atau dokumen pribadi. Cast terenkripsi pelayanan tidak berubah; tidak ada endpoint daftar baru yang mengirim data warga.

PUT menyimpan objek dan audit `site.updated` (`subject_type=site_section`, `subject_id=key`) dalam satu transaksi. Audit tanpa isi; gagal audit membatalkan penyimpanan. Native upsert menjaga satu baris saat penulisan pertama bersamaan; objek terakhir menang, belum ada versi/konflik edit. `audit_logs.subject_id` diperluas dari integer ke string 64 agar menampung key; ID audit lama menjadi string, bukan perubahan respons pelayanan. Rollback mempertahankan tipe string dan audit historis.

Jalankan migration lalu `php artisan site:import-defaults` dari `backend/`. Command menyalin `profile`, `contact`, `history` dari snapshot `lib/data.ts` pada `bb6861e`, ditambah R6 `transparency` dari `pages.transparansi` (`intro`, blocks menjadi `programs`, `budgets: []`) dan R7 `structure` dari `pages["struktur-pemerintahan"]` (`blocks`, `source`, tanpa gambar), ditulis ulang di `database/seeders/SiteSectionDefaults.php`; tidak membaca/mengubah TypeScript saat runtime. Hanya key belum ada diisi, bahkan baris dengan data kosong tetap dipertahankan. Idempoten, tidak otomatis dipanggil seeder/migration; seluruh impor + audit sistem (`user_id=null`) satu transaksi. Output hanya jumlah, bukan isi. Placeholder dan sumber konten dipertahankan; bukan pengesahan data baru.

Pemroses `App\\Support\\ImageProcessor` dipakai berita dan structure dengan parameter ukuran/lebar maks terpisah; GD encode ulang, batas/format/kualitas/siklus sampul berita tetap C2. Gambar site hanya aktif untuk structure (R7); key lain tetap menolak sebelum menyimpan file.

### Login username

Frontend mengirim `{ username, password }`. Username unik, 1–64 karakter, diawali huruf kecil/angka, selanjutnya huruf kecil, angka, `_`, atau `-`. Spasi luar dibuang; huruf besar ditolak. Klien lama masih dapat mengirim `{ email, password }`, tetapi kedua identitas tidak boleh dikirim bersama. Identitas tidak dikenal, kata sandi salah, peran di luar enam peran panel, ketua RT/RW tanpa wilayah lengkap, serta akun RT/RW saat fitur mati menghasilkan pesan 401 generik yang sama. Token RT/RW lama yang belum dicabut tetap ditolak 403 pada endpoint panel saat fitur mati. Validasi gagal menghasilkan 422; rate limit tetap 5/menit.

Jalankan migration penambahan username sebelum memakai frontend baru. Akun lama tetap memiliki username nullable dan bisa memakai API login email; untuk form baru, administrator perlu menetapkan username unik pada akun tersebut. Tidak ada akun/kata sandi bawaan atau endpoint pendaftaran publik. Tipe frontend: `StaffLoginRequest` dan `StaffLoginResponse` di `types/pelayanan.ts`.

## Enam jenis surat final (S1, 8 November 2026)

Rancangan dan sumber pilihan: `docs/PROMPTS-SURAT.md`. Aturan ada di `backend/app/Domain/LetterType.php` (jenis, judul resmi `title()`, `isOffered()`, isian khusus) dan `backend/app/Domain/LetterSubmission.php` (aturan validasi, pilihan baku, pesan galat bahasa Indonesia). Controller tidak menyalin tabel ini. Tipe frontend: `serviceCodes`, `offeredServiceCodes`, dan `*Options` di `types/pelayanan.ts`.

| Kode | Judul surat | Isian khusus wajib |
| --- | --- | --- |
| `DOMISILI` | SURAT KETERANGAN DOMISILI | — |
| `SKTM` | SURAT KETERANGAN TIDAK MAMPU | — (`keperluan` dicetak) |
| `BELUM_MENIKAH` | SURAT KETERANGAN BELUM MENIKAH | — |
| `KERAMAIAN` | SURAT KETERANGAN IZIN KERAMAIAN | `acara`, `tempat_acara`, `jenis_hiburan` (2–120), `tanggal_mulai`, `tanggal_selesai` |
| `KEHILANGAN` | SURAT KETERANGAN KEHILANGAN | `barang_hilang` (2–200) |
| `UMUM` | SURAT KETERANGAN | `isi_keterangan` (2–500) |
| `SKU`, `KTP_KK` | (data lama) | tidak dapat diajukan: 422 `Jenis surat ini tidak dapat diajukan secara online.` |

- **Data diri, semua jenis:** `nama`, `nik`, `no_kk`, `tempat_lahir`, `tanggal_lahir`, `jenis_kelamin`, `dusun` (Watuagung/Talang/Sekar), `alamat`, `rt`, `rw`, `telepon`, `keperluan` (2–200), `kewarganegaraan` (WNI/WNA; kosong → WNI).
- **Kecuali KERAMAIAN, juga wajib:** `agama` (Islam, Kristen, Katolik, Hindu, Buddha, Konghucu, Kepercayaan terhadap Tuhan YME), `status_perkawinan` (Belum Kawin, Kawin, Cerai Hidup, Cerai Mati), `pendidikan` (pilihan baku KK, lihat `pendidikanOptions`), `pekerjaan` (teks bebas 2–60). Untuk KERAMAIAN keempatnya opsional, tetapi nilai yang dikirim tetap divalidasi.
- **Pilihan bersifat persis** (huruf besar/kecil diperhatikan). Nilai di luar daftar → 422 `… tidak valid. Pilih salah satu pilihan yang tersedia.`
- **Tanggal keramaian:** format `YYYY-MM-DD`; `tanggal_mulai` ≥ hari ini (zona waktu aplikasi, WIB); `tanggal_selesai` ≥ `tanggal_mulai`; rentang paling lama 7 hari kalender **termasuk** hari mulai dan selesai (mis. 10–16 boleh, 10–17 ditolak).
- **Isian milik jenis lain ditolak** (422 `… tidak dipakai untuk jenis surat ini.`), bukan diabaikan: tidak ada data yang tersimpan tanpa disadari dan kesalahan klien langsung terlihat. String kosong/null tetap diterima agar formulir lama tidak gagal.
- **Penyimpanan:** kolom baru semuanya nullable (data lama tetap sah). `agama` dan `status_perkawinan` memakai cast `encrypted` dan masuk `$hidden` seperti NIK. Isian lain teks biasa. `tanggal_mulai`/`tanggal_selesai` dikirim `YYYY-MM-DD`. `isi_keterangan_awal` menyimpan teks asli warga (tidak pernah berubah) sebagai pembanding untuk petugas.
- **Respons:** pengajuan dan cek status publik tidak berubah (tanpa data diri). Daftar petugas, ringkasan, dan buku register tidak memuat field baru. Detail petugas memuat `dusun`, isian khusus, `isi_keterangan`, `isi_keterangan_awal`, dan `can_edit_isi_keterangan` untuk semua peran pelayanan yang berwenang (bukan KIM); `agama`, `status_perkawinan`, `kewarganegaraan`, `pendidikan`, `pekerjaan` hanya untuk peran kantor (tidak untuk Ketua RT/RW), didekripsi. Akses detail tetap tercatat `application.viewed`.
- **RT/RW:** bila `letters.neighborhood_approval` dinyalakan, semua jenis kecuali SKU melalui RT/RW.
- **PDF S2:** enam jenis final memiliki template resmi masing-masing di `resources/views/letters/`; judul dari `LetterType::title()`. Kop JPG data URI, identitas 1–11, RT/RW tiga digit, tanggal lahir `dd-mm-yyyy`, keterangan per jenis. KERAMAIAN memakai tabel a–g tanpa NIK/KK dan rentang tanggal Indonesia. UMUM mencetak `isi_keterangan` terkini hasil suntingan petugas, bukan teks awal warga. BELUM_MENIKAH/KEHILANGAN memakai dua kolom tanda tangan; QR di bawah area tanda tangan. SKU/KTP_KK lama tetap dirender, termasuk data tanpa kolom baru. Tidak ada perubahan kontrak API pada S2.
- **Retensi:** `applications:purge` mengosongkan semua kolom baru.
- **Formulir warga S3 (8 November 2026):** katalog hanya enam jenis final. Kelompok data diri tambahan memakai pilihan baku dan datalist pekerjaan; KERAMAIAN tidak meminta agama/status perkawinan/pendidikan/pekerjaan. Zod memeriksa field per jenis, kalender dan batas tujuh hari inklusif dengan hari ini Asia/Jakarta sebelum ringkasan dan kirim; demo memakai skema sama, SKU/KTP_KK ditolak. Ringkasan memuat semua isian dan dapat dikoreksi tanpa kehilangan nilai. Jenis surat pada bukti sukses disimpan per nomor di sessionStorage tanpa identitas; kode akses tetap terpisah per tab, tidak di URL. Enam pengajuan fiktif ke Laravel lokal tersimpan; bukti dan batas verifikasi di `docs/progres-2026-11-08-s3.md`.

### Lampiran persyaratan (M6, 16 November 2026)

Setiap pengajuan online wajib menyertakan **KTP**, **Kartu Keluarga (KK)**, dan **Surat Pengantar RT/RW**. Daftar wajib per jenis hanya di `LetterType::requiredAttachments()` (saat ini ketiganya untuk keenam jenis yang ditawarkan); enum `App\Domain\AttachmentKind`, tipe frontend `attachmentKinds`/`AttachmentKind`/`SubmissionAttachments` di `types/pelayanan.ts`.

- **Permintaan:** `multipart/form-data` berisi field formulir seperti sebelumnya + `lampiran[KTP]`, `lampiran[KK]`, `lampiran[PENGANTAR_RT_RW]`. Kunci lain di `lampiran` → 422 `Jenis lampiran tidak dikenal untuk surat ini.` Throttle tetap 5/menit.
- **Validasi per file** (pesan di `errors["lampiran.KTP"]` dst., digabung dengan kesalahan isian lain dalam satu respons 422):
  - tidak ada → `KTP wajib dilampirkan.` (label: KTP, Kartu Keluarga (KK), Surat Pengantar RT/RW); bukan file → `… harus berupa file.`;
  - tipe dibaca dari **isi** file (finfo), bukan ekstensi/Content-Type: hanya JPEG, PNG, WebP, PDF; selain itu (mis. teks bernama `.jpg`, GIF) → `… harus berupa foto JPG, PNG, WebP, atau berkas PDF.`;
  - maksimal 5 MB (5.242.880 byte) → `Ukuran … maksimal 5 MB.`;
  - foto: sisi terpendek < 600 px → `Foto terlalu kecil untuk dibaca. …`; sisi terpanjang > 6.000 px → ditolak (batas memori GD); foto rusak → `… tidak dapat dibaca. …`;
  - PDF: wajib diawali `%PDF-`; > 10 halaman → `PDF … maksimal 10 halaman.` Halaman dihitung dari objek `/Type /Page` dan `/Count` tanpa pustaka PDF; PDF yang menyimpan objek di stream terkompresi tidak terhitung sehingga batas halaman **dilewati** (berkas tetap diterima, ukuran ≤ 5 MB tetap berlaku).
  - File ditolak PHP sebelum Laravel → `… gagal diterima server. …`. Badan permintaan di atas `post_max_size` → 413 dari Laravel tanpa pesan per dokumen; lihat batas server di bawah.
- **Pengolahan:** foto digambar ulang dengan GD (lebar maks 2.000 px, tanpa memperbesar) lalu di-encode WebP, atau JPEG bila GD tanpa WebP, sehingga EXIF/GPS hilang. PDF disimpan apa adanya; metadata dokumennya tidak dibuang (tanpa pustaka PDF).
- **Penyimpanan:** `Crypt::encryptString(isi)` ke disk privat `local`, `storage/app/private/attachments/{application_id}/{uuid}.bin`. Nama file asli **tidak pernah** disimpan, dicatat, atau dikembalikan (bisa berisi nama/NIK). Tabel `application_attachments`: `kind`, `original_mime` (hasil deteksi isi), `stored_mime`, `size_bytes` (isi tersimpan sebelum enkripsi), `path`, `sha256` (isi asli yang diunggah), `uploaded_by` (`applicant`/`staff`), `purged_at`, unique (`application_id`, `kind`), FK cascade.
- **Atomik:** baris permohonan, event `SUBMITTED`, dan baris lampiran dalam satu transaksi. Bila penyimpanan gagal di tengah, transaksi dibatalkan dan file yang sudah tertulis dihapus; tidak ada baris atau file yatim.
- **Respons publik** (pengajuan 201 dan cek status): `lampiran: ["KTP", "KK", "PENGANTAR_RT_RW"]` — hanya jenis yang diterima dan belum dihapus retensi; tanpa path, ukuran, MIME, atau hash. Data lama sebelum fitur ini → `[]`.
- **Batas server:** 3 × 5 MB + isian melebihi `post_max_size = 12M` yang sebelumnya tercatat di `deploy/hostinger.md` § C; bahkan 3 × 4 MB (12 MiB) + overhead multipart sedikit melewati 12M. Karena itu § C kini meminta 20M (VPS: `client_max_body_size` Nginx juga perlu dinaikkan). Kompres foto di browser (L3) tetap dianjurkan untuk koneksi warga.
- **Layar warga L3 (17 November 2026):** isian → Unggah dokumen → ringkasan beserta daftar lampiran. Tiap kartu menyediakan Ambil foto (`image/*`, kamera belakang), Pilih file (gambar/PDF), pratinjau lokal atau “PDF terpilih”, Ganti/Hapus. Gambar digambar ulang canvas JPEG kualitas 0,85, sisi panjang maksimal 2.000 px tanpa memperbesar; hasil sisi pendek <600 px atau ukuran ≥1.500.000 byte ditolak dengan petunjuk ambil ulang/PDF. PDF ≤5.242.880 byte, awalan `%PDF-`, isi tidak diubah. Nama asli diganti `foto.jpg`/`dokumen.pdf` sebelum dikirim.
- **Transport L3:** `pelayananService.submit(data, attachments, onProgress)` memakai FormData + XMLHttpRequest tanpa menetapkan Content-Type sendiri, timeout 120 detik; progres persen bila tersedia. 422 menjadi `SubmissionValidationError.errors`, ditampilkan pada kartu terkait; 413/jaringan/timeout memberi petunjuk. File dipertahankan di memori agar bisa diperbaiki/dikirim ulang, tidak masuk localStorage/sessionStorage. Object URL dilepas saat ganti/hapus/keluar; state file dikosongkan setelah diterima. Demo mensimulasikan progres tanpa pengiriman; receipt tersimpan tetap tanpa file/nama/daftar lampiran.
- **Revisi L3:** sesudah cek status dengan kode akses dan `NEED_REVISION`, tombol Ganti dokumen membuka kartu yang sama; pilih minimal satu pengganti. Menggunakan L2 `POST /applications/attachments` dengan nomor dan kode akses di body, bukan URL; status tetap NEED_REVISION setelah sukses. Kode yang sudah lolos cek status ditahan hanya di memori agar perubahan input pencarian tidak menukar kredensial permohonan lama. Demo tidak menampilkan tombol revisi. L2 `e62247d` masuk sebagai induk branch saat L3 dikerjakan; pengguna menyetujui integrasi.
- **Layar petugas L4 (17 November 2026):** detail staff/admin/village_head menampilkan kartu Dokumen warga dengan tiga jenis dan status Ada/Belum/Dihapus sesuai masa simpan. Pembukaan melalui session `request()` yang membungkus `adminRequest()`, bearer token di header, respons blob; tidak memakai URL storage langsung. Gambar dibuka pada dialog dengan perbesar/perkecil dan putar 90°; PDF dibuka pada tab object URL baru; sessionStorage salinan tab dikosongkan sebelum navigasi dan opener dilepas agar token panel tidak ikut. URL dicabut saat tutup/ganti dokumen, pindah halaman, logout, atau pagehide; penutupan tab PDF diperiksa tiap 500 ms. Respons terlambat setelah pembatalan/unmount tidak membuat URL. Pop-up diblokir dan MIME tidak sesuai menampilkan galat. Tidak ada unduh massal. Pilihan cepat catatan menambahkan teks ke textarea (batas 1.000 karakter tetap), tidak langsung mengirim Minta perbaikan. Guard ability R12 tetap menolak menu/route KIM; backend tetap otoritas izin dan audit.
- **Belum diverifikasi:** penjadwal/retensi aktif pada produksi. Privasi menjelaskan mekanisme 30 hari tersedia, tetapi pelaksanaan produksi belum diverifikasi.

### Akses petugas, penggantian, dan retensi lampiran (17 November 2026)

- **Detail petugas** `GET /staff/applications/{request_id}`: untuk staff/admin/village_head menambah `attachments: StaffAttachment[]` (`id`, `kind`, `label`, `stored_mime`, `size_bytes` (isi sebelum enkripsi), `uploaded_at` (terakhir diterima), `purged`), urut KTP, KK, pengantar. Tanpa path, hash, atau MIME asli. Ketua RT/RW tidak menerima field ini.
- **Membuka lampiran** `GET /staff/applications/{request_id}/attachments/{id}`: grup ability `applications:manage` (token KIM → 403), lalu peran staff/admin/village_head (RT/RW dan KIM dengan ability bocor → 403). Permohonan dicari dengan `forUser()` seperti detail; lampiran milik permohonan lain atau id tak dikenal → 404; lampiran yang sudah dihapus retensi → 410. Respons: isi didekripsi, `Content-Type` = `stored_mime`, `Content-Disposition: inline` untuk gambar dan `attachment` untuk PDF dengan nama netral `{request_id}-{KIND}.{webp|jpg|pdf}`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Audit `attachment.viewed` (`subject_type=attachment`, `subject_id` = id lampiran) **setiap kali** dibuka, sebelum isi dikirim (gagal mencatat → 500 tanpa isi). Throttle 60/menit per pengguna/IP.
- **Penggantian oleh warga** `POST /applications/attachments` (multipart): `request_id`, `lookup_secret`, dan satu atau lebih `lampiran[KTP|KK|PENGANTAR_RT_RW]`. Kode akses memakai kunci percobaan yang sama dengan cek status (`lookup:{request_id}`): kode salah di salah satu endpoint dihitung bersama, 5 salah → 429 selama 15 menit untuk keduanya. Hanya saat `NEED_REVISION`; status lain → 422 `Lampiran hanya dapat diganti saat permohonan berstatus perlu perbaikan.` (diperiksa ulang dengan baris terkunci). Validasi file sama dengan pengajuan; tanpa lampiran → 422 `Pilih minimal satu lampiran yang akan diganti.`; jenis lain → 422. Baris lampiran yang sama diperbarui (id tetap), file lama dihapus setelah commit; bila gagal, baris dan file lama tetap dan file baru dibuang. Riwayat: `application_events` dengan `action = ATTACHMENTS_UPDATED`, `from_status = to_status = NEED_REVISION`, `note = "Lampiran diperbarui: KTP, Kartu Keluarga (KK)"` (label, tanpa isi), `user_id` null. Status tidak berubah; petugas tetap memindahkan `NEED_REVISION → VERIFIED`. Panel menampilkan riwayat ini sebagai "Lampiran diganti pemohon". Throttle rute 5/menit.
- **Retensi** `php artisan attachments:purge {--dry-run}`, terjadwal harian: permohonan `COMPLETED`/`REJECTED` dengan `updated_at` lebih tua dari `ATTACHMENT_RETENTION_DAYS` (tidak diset = 30; kosong atau `0` = mati; nilai lain bukan bilangan bulat ≥ 0 → keluar dengan error tanpa perubahan). Per permohonan dalam transaksi: `path` → null, `purged_at` diisi, audit `attachment.purged` per lampiran (`user_id` null); file dihapus setelah commit. Data permohonan tidak dianonimkan. `--dry-run` hanya menampilkan. Idempoten. `applications:purge` (anonimisasi) juga menghapus lampiran permohonan yang dianonimkan dengan cara yang sama.

### Sunting isi keterangan (UMUM)

- `PATCH /staff/applications/{request_id}/isi-keterangan` dengan `{ "isi_keterangan": "…" }` (2–500, dipangkas spasinya).
- Peran `staff`/`admin` saja (lainnya 403). Di luar wilayah/tidak ada → 404. Bukan UMUM → 422 `Isi keterangan hanya ada pada Surat Keterangan Umum.` Status `WAITING_APPROVAL`, `APPROVED`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED` → 422 `Isi keterangan tidak dapat disunting setelah diajukan ke Kepala Desa.` `NEED_REVISION` boleh (kembali ke kantor sebelum diajukan ulang). Aturan ada di `ApplicationStatus::canEditContent()`; frontend memakai `can_edit_isi_keterangan` dari server.
- Tercatat di `application_events` dengan `action: STATEMENT_EDITED`, `from_status` = `to_status` = status saat itu, `note: "Isi keterangan disunting"`. `audit_logs` mencatat `application.statement_edited` dengan ID saja, tanpa isi lama/baru.
- **Panel S4 (8 November 2026):** staff/admin menyunting melalui kotak **Isi keterangan yang dicetak** dan **Simpan kalimat**, mengikuti `can_edit_isi_keterangan` server; teks asli warga tetap di bawahnya. Perubahan belum disimpan memblokir aksi status dan draf PDF agar hasil lama tidak diajukan tanpa sengaja. Riwayat `STATEMENT_EDITED` berlabel **Isi keterangan disunting**.
- **Penyamaran S4, dikonfirmasi pengguna:** NIK/KK tetap tampil utuh sesuai keputusan sebelumnya. Agama/status perkawinan disamarkan di antarmuka; **Tampilkan** mengambil ulang detail terotorisasi dan baru mengungkap nilai setelah berhasil. GET tersebut mencatat `application.viewed`; bukan audit khusus per field. API detail tetap mengirim nilai didekripsi kepada peran kantor, sehingga penyamaran ini bukan pembatasan akses API. Tidak ada endpoint, kontrak, atau dependensi baru.

## Nomor surat dan buku registrasi

- Nomor dialokasikan dalam transaksi yang sama dengan `PROCESSING → WAITING_APPROVAL`. Satu urutan untuk semua jenis surat per tahun, reset pada pergantian tahun sesuai zona waktu aplikasi (`config/app.php`, env `APP_TIMEZONE` dengan bawaan `Asia/Jakarta`): pukul 00.00 WIB tanggal 1 Januari. Nomor yang dibatalkan tidak digunakan ulang.
- Format dari `backend/config/letters.php`: `{kode_klasifikasi}/{urut}/{kode_desa}/{tahun}`, contoh `470/12/424.314.2.02/2026` (sesuai contoh surat desa, tanpa bulan romawi). Kode klasifikasi `470` untuk semua jenis termasuk SKU/KTP_KK lama (`LetterType::classificationCode()`), kode desa `424.314.2.02`. Contoh Izin Keramaian memakai `35.314.10.2.02`; dianggap salah ketik sampai desa menjawab (pertanyaan 2 di `docs/PROMPTS-SURAT.md`).
- `WAITING_APPROVAL → REJECTED/NEED_REVISION` oleh Kepala Desa membatalkan nomor aktif dengan alasan dari catatan wajib. Pengajuan ulang setelah perbaikan mendapat nomor baru. Riwayat nomor lama tetap disimpan; permohonan lama tidak diberi nomor retroaktif.
- **GET `/staff/letter-register`**: token ability `applications:manage`, akun aktif berperan `staff`, `admin`, atau `village_head`; tanpa token 401, RT/RW/peran/ability salah 403. Query opsional `year` (bilangan bulat 1000–9999, bawaan tahun server), `jenis_surat` (delapan kode, termasuk kode lama), `page` (≥1). Filter digabung AND; paginator 20 baris. Kesalahan validasi 422.
- Item daftar hanya `{ number, issued_at, jenis_surat, nama, status }`; `status` adalah `issued` atau `void`, bukan status permohonan. Tidak memuat NIK, KK, telepon, alamat, kode akses, maupun alasan bebas. Respons `Cache-Control: private, no-store`.
- Detail kantor menambahkan `letter_numbers: [{ number, status, void_reason, issued_at }]`; tidak dikirim kepada RT/RW. `void_reason` nullable. Tanggal API tetap ISO 8601 UTC (instan yang sama, bukan waktu lokal tanpa zona). Tipe frontend: `LetterNumber`, `LetterRegisterEntry`, `LetterRegisterPage`.
- Cek status warga menambahkan `letter_number: string | null`; hanya nomor aktif pada `APPROVED`, `READY_FOR_PICKUP`, atau `COMPLETED`, selain itu null. Permohonan lama tanpa nomor tetap null. Kode akses tetap wajib; tidak ada riwayat nomor batal/alasan pembatalan baru pada respons publik.
- Halaman statis `/admin/register/` mengambil data di browser memakai sesi panel, dengan filter tahun/jenis, pagination, dan tanda **Dibatalkan**. Tidak ada ekspor, PDF, atau penyimpanan data register di browser storage. Demo tetap menonaktifkan panel.

## Surat PDF dan verifikasi QR

- Dua jalur: **PDF otomatis** dari enam template resmi S2 (8 Nov 2026, `docs/PROMPTS-SURAT.md`), atau **unggah manual** surat yang disusun petugas, ditandatangani basah, distempel, lalu dipindai. Unggahan menggantikan PDF otomatis; kode QR tetap sama. PDF final yang sudah tersimpan tidak diubah/dibuat ulang oleh perubahan template; hanya draf dan PDF baru memakai template baru.
- Kop/nama Kepala Desa tetap dari `letters.desa`. Alamat kop bawaan diperbarui sesuai contoh resmi; env `LETTER_ALAMAT_KANTOR` lama perlu disesuaikan manual (lihat `.env.example`). Logo tersimpan di `backend/resources/letters/logo-kabupaten-pasuruan.jpg`. Tidak mengubah `.env`, alur status, enkripsi, atau hak akses.
- Tes `LetterPdfTest` mengekstrak teks PDF asli lewat helper Python + pypdf (alat uji lokal, executable `PYTHON_BINARY` opsional). Enam fixture fiktif terbukti satu halaman A4 untuk isi normal. Ekspor contoh ke luar repo menggunakan `LETTER_SAMPLE_DIR`, panduan di `backend/README.md`; QR contoh hanya kode database tes, bukan surat operasional. Teks panjang boleh melanjutkan ke halaman berikutnya, tidak dipotong.
- Saat Kepala Desa menyetujui (`APPROVED`), server mencatat siapa dan kapan serta membuat kode acak 32 karakter. QR berisi `LETTER_VERIFY_URL?kode=<kode>` (bawaan `http://localhost:3000/verifikasi/`), bukan nomor pengajuan atau data pribadi.
- PDF final disimpan terenkripsi di storage privat Laravel dengan SHA-256 dari PDF asli. Unduh hanya staff/admin/village_head; RT/RW 403. Setiap unduhan/draf/unggahan tercatat di `audit_logs` (`letter.downloaded`, `letter.draft_viewed`, `letter.uploaded`).
- Panel detail kantor: "Lihat draf PDF" (PROCESSING/WAITING_APPROVAL), "Unduh surat final", "Unduh QR verifikasi", dan unggah surat hasil pindaian. Berkas diambil dengan `fetch` + bearer token lalu dibuka dari blob; token tidak pernah masuk URL. `adminFetch` mengembalikan `Blob` bila respons bukan JSON.
- Detail kantor menambah `letter: LetterFile | null` (`approved_at`, `source`, `sha256`, `file_updated_at`, `file_purged_at`). `file_purged_at` terisi bila PDF dihapus oleh retensi; unduhan surat itu menjawab **410** dan PDF tidak dibuat ulang. Panel belum menyembunyikan tombol unduh untuk kasus ini.
- **Retensi (mati bawaan):** `php artisan applications:purge [--dry-run]`, dijadwalkan harian, hanya bekerja bila `RETENTION_APPLICATION_DAYS` diisi. Permohonan `COMPLETED`/`REJECTED` dengan `updated_at` lebih tua dari N hari dianonimkan (baris tetap): `nama` menjadi inisial (`S. W.`), field pribadi kosong, PDF final dihapus. Detail panel lalu mengirim string kosong untuk field pribadi; register dan `/verify/{kode}` tetap berjalan (nama tersamar dari inisial, misalnya `S* W*`).
- Halaman publik statis `/verifikasi/` membaca `?kode=` di browser, memanggil `/verify/{kode}`, dan hanya menampilkan nomor surat, jenis surat, tanggal terbit, nama tersamar, serta status sah/dibatalkan (`revoked` bila nomor surat terakhir dibatalkan). Demo menampilkan "Tidak tersedia pada demo".
- QR bukan Tanda Tangan Elektronik tersertifikasi; lihat `PRODUCT.md`.

## Alur online: unduh surat oleh warga (19 November 2026)

Rancangan dirujuk sebagai `docs/PROMPTS-ALUR-ONLINE.md` (belum ada di repo). Layar warga dan panel (O2) belum diubah.

1. Kepala Desa menyetujui (`APPROVED`); sistem membuat PDF otomatis ber-QR untuk kantor (tidak dapat diunduh warga).
2. Kantor mencetak, Kepala Desa menandatangani basah dan distempel, lalu kantor mengunggah scan PDF: `POST /staff/applications/{request_id}/letter.pdf` (staff/admin). Dalam satu transaksi dengan baris permohonan terkunci: berkas disimpan terenkripsi (`source = uploaded`), `letters.ready_at = now()`, dan bila status `APPROVED` → `READY_FOR_PICKUP`, `catatan` dikosongkan, event `from APPROVED to READY_FOR_PICKUP` oleh petugas dengan catatan "Scan surat bertanda tangan diunggah", audit `letter.uploaded`. Unggah ulang saat `READY_FOR_PICKUP` mengganti berkas dan memperbarui `ready_at` (masa unduh mulai lagi) tanpa event status. Status lain → 422; village_head, RT/RW, KIM → 403. Transisi manual `APPROVED → READY_FOR_PICKUP` lewat `PATCH …/status` → 422 (`ApplicationStatus::canUploadLetter()`/`afterLetterUpload()`). `APPROVED` tetap masuk antrean kantor (`my_queue`) lewat `ApplicationStatus::awaitsAction()`.
3. Warga mengunduh: `POST /applications/letter` dengan `request_id` dan `lookup_secret` (POST agar kode akses tidak masuk access log). Kunci percobaan `lookup:{request_id}` sama dengan cek status dan penggantian lampiran (5 kode salah gabungan → 429 15 menit), ditambah 10/menit per IP.
   - Tersedia bila status `READY_FOR_PICKUP` atau `COMPLETED`, `letters.source = uploaded`, `ready_at` terisi, berkas belum dihapus, dan sekarang ≤ `ready_at` + `LETTER_DOWNLOAD_DAYS` (bawaan 30).
   - Belum ada scan, draf, PDF otomatis sistem, status lain, atau scan lama tanpa `ready_at` → 404 `Surat belum tersedia untuk diunduh.`
   - Lewat masa unduh atau berkas sudah dihapus retensi → 410 `Masa unduh sudah berakhir. Silakan hubungi petugas di kantor desa.`
   - Sukses: PDF terdekripsi, `Content-Disposition: attachment; filename="Surat-{request_id}.pdf"`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`. Unduhan pertama: `READY_FOR_PICKUP → COMPLETED` dengan event "Surat diunduh pemohon" (`user_id` null). Unduhan ulang tetap boleh selama masa unduh. Setiap unduhan: audit `letter.downloaded` (`user_id` null, `subject_type = application`), dicatat sebelum isi dikirim (gagal → 500 tanpa isi, status tidak berubah).
4. Cek status menambah `letter_available` (bool) dan `letter_available_until` (ISO 8601, tetap diisi setelah lewat; null bila belum ada scan) tanpa path/hash.
5. `php artisan letters:expire-downloads {--dry-run}` harian: `READY_FOR_PICKUP` dengan scan yang `ready_at` lebih tua dari masa unduh → `COMPLETED`, event "Masa unduh berakhir" (`user_id` null). Berkas tidak dihapus; petugas tetap dapat mengunduh. Data lama `READY_FOR_PICKUP` tanpa scan baru tidak disentuh.
6. Retensi: `applications:purge` melewati permohonan yang scan suratnya masih dalam masa unduh (`ready_at` + masa unduh > sekarang), walaupun `updated_at` sudah lama. `attachments:purge` hanya menghapus lampiran persyaratan, tidak pernah berkas surat.

## Akun petugas

Migration `2026_10_22_000000_add_staff_account_fields_to_users_table` membuat `email` nullable dan menambah `is_active` (default true), `must_change_password` (default false), serta `last_login_at`. Akun baru dari panel selalu memakai username, tanpa email, aktif, dan wajib mengganti kata sandi saat login pertama. Akun lama tanpa username tetap bisa login lewat email.

- Seluruh `/staff/users…` berada dalam grup ability `applications:manage`, tetapi hanya `admin` yang boleh mengelolanya; peran lain (termasuk KIM) mendapat 403 dan tanpa token 401. Tidak ada hapus akun; nonaktifkan agar riwayat tetap merujuk ke akun itu.
- `GET /staff/users` mengembalikan `data` (field eksplisit: `id`, `name`, `username`, `role`, `rt`, `rw`, `is_active`, `must_change_password`, `last_login_at`) dan `warnings` `{ role, rt, rw, pending }`. Warning muncul bila ada permohonan `SUBMITTED` di RT/RW tanpa `rt_head` aktif atau `RT_APPROVED` di RW tanpa `rw_head` aktif; saat fitur RT/RW mati `warnings` selalu `[]`.
- Saat `features.neighborhood_approval=false`, server menolak pembuatan, penetapan peran/wilayah, atau aktivasi akun RT/RW dengan 422 dan pesan jelas bahwa fitur nonaktif; menonaktifkan akun RT/RW yang sudah ada tetap diizinkan agar riwayat terjaga. `staff:create` juga menolak peran RT/RW. Panel menyembunyikan pilihan peran RT/RW, peringatan wilayah, dan menu antrean RT/RW berdasarkan `features.neighborhood_approval`; frontend bukan pengaman otorisasi.
- `rt_head` wajib RT+RW dan `rw_head` wajib RW; kode dinormalkan ke 3 digit. Satu wilayah hanya boleh punya satu ketua aktif. Untuk mengganti ketua, nonaktifkan akun lama lebih dulu.
- Admin tidak dapat menonaktifkan atau menurunkan peran akunnya sendiri, dan sistem selalu menyisakan minimal satu admin aktif.
- Reset kata sandi oleh admin menandai `must_change_password=true` dan mencabut semua token akun itu. Nonaktifkan akun juga mencabut semua tokennya saat itu juga.
- `POST /staff/me/password` memakai kata sandi lama + baru (min. 10). Setelah berhasil, `must_change_password=false` dan token lain dicabut; token yang sedang dipakai tetap berlaku.
- Login akun nonaktif memakai pesan 401 yang sama dengan kredensial salah. Login berhasil mencatat `last_login_at` dan menyertakan `must_change_password` di respons.
- Audit `user.created`, `user.updated`, dan `user.password_reset` disimpan di `audit_logs` dengan `subject_type=user`; tidak ada kata sandi, token, atau email di audit.
- Frontend memaksa layar ganti kata sandi sebelum panel dipakai bila flag aktif. Menu akun di bilah atas menyediakan **Ganti kata sandi** untuk semua peran.
- Tipe frontend: `StaffUser`, `StaffUsersResponse`, `StaffAccountWarning`, dan `StaffPasswordRequest` di `types/pelayanan.ts`.

## Kode akses dan autentikasi

- Kode akses diberikan setelah pengajuan API dan disimpan pada sessionStorage tab untuk halaman berhasil. Simpan nomor serta kode di tempat aman; pemulihan belum tersedia.
- Kode akses dikirim pada body POST untuk cek status, tidak dimasukkan ke URL.
- **Buat ulang kode akses:** `POST /staff/applications/{request_id}/lookup-secret` oleh staff, admin, rt_head, rw_head (bukan village_head atau kim), dengan `applications:manage`; RT/RW hanya saat fitur aktif. Permohonan di luar wilayah RT/RW = 404. Status `COMPLETED` = 422. Kode lama langsung tidak berlaku; kunci salah coba dibuka. Respons hanya berisi kode sekali; tidak ada di log. Entri riwayat dengan `action: ACCESS_CODE_RESET` dan catatan audit `application.access_code_reset`. input dinormalkan (tanpa tanda hubung/spasi/huruf kecil tetap diterima). Backend menyimpan HMAC-nya dengan APP_KEY; kode lama 48 karakter tetap berlaku. 5 kode salah per nomor pengajuan → HTTP 429 selama 15 menit; frontend menampilkan pesan dari server.
- Backend menyimpan hash kode akses; NIK, KK, telepon, alamat, tempat lahir, dan tanggal lahir dienkripsi dengan APP_KEY. `nama` tetap teks biasa untuk pencarian.
- Token petugas disimpan di `sessionStorage` tab (`watuagung-staff-token`) oleh `features/admin/session.tsx`. Pindah route admin dan reload tetap login; menutup tab menghapus sesi. Fitur browser "pulihkan tab" atau "duplikat tab" dapat ikut menyalin sessionStorage. Jangan memindahkan token ke URL atau localStorage.
- Saat dibuka atau di-reload, panel memvalidasi token lewat `GET /staff/me` sebelum menampilkan isi. Gangguan jaringan menampilkan pesan "Server belum dapat dihubungi" dengan tombol coba lagi, bukan logout.
- Semua permintaan panel melewati `adminRequest()` (`features/admin/api.ts`). Respons 401 menghapus sesi lalu menampilkan login dengan pesan "Sesi berakhir, silakan masuk lagi."
- Token kedaluwarsa setelah `SANCTUM_EXPIRATION` menit (bawaan 480 = 8 jam kerja), dihitung sejak login, bukan sejak aktivitas terakhir. Tipe frontend: `StaffProfile` di `types/pelayanan.ts`.
- Jangan mengganti APP_KEY pada database berisi data terenkripsi tanpa prosedur migrasi yang benar.
- **18 November 2026:** enkripsi penyimpanan diperluas ke `keperluan`, `isi_keterangan`, `isi_keterangan_awal` (padanan teks asli warga yang tersedia), `barang_hilang`, `pekerjaan`, `pendidikan`, `catatan`, serta salinan di `application_events.note` dan `letter_numbers.void_reason`. Respons API dan PDF tetap plaintext hanya sesuai akses yang sudah ada; tidak ada perubahan kontrak TypeScript. Migration chunk 500 reversible up/down/up; null dan string kosong dipertahankan. Tidak ada filter/pencarian/urutan SQL pada kolom ini. `nama`, nomor, jenis, status, RT/RW, dusun dan tanggal operasional tidak ditambah enkripsi; tanggal lahir yang sebelumnya terenkripsi tetap demikian. Prosedur maintenance, backup, kunci dan rollback ada di `backend/README.md`. Perlindungan ini tidak mencakup kebocoran APP_KEY, server aplikasi aktif, atau backup plaintext sebelum migrasi.

## Status dan batas fitur

Sumber kebenaran kebutuhan persetujuan adalah `backend/app/Domain/LetterType.php`; `ApplicationStatus` menggunakannya, bukan daftar jenis surat tersendiri. Hanya konfigurasi backend `letters.neighborhood_approval` yang mengaktifkan RT/RW:

- Bawaan false, **semua jenis surat**: `SUBMITTED` → `VERIFIED` → `PROCESSING` → `WAITING_APPROVAL` → `APPROVED` → `READY_FOR_PICKUP` → `COMPLETED`.
- Saat true, semua jenis kecuali SKU (DOMISILI, SKTM, BELUM_MENIKAH, KERAMAIAN, KEHILANGAN, UMUM, dan KTP_KK lama): `SUBMITTED` → `RT_APPROVED` → `RW_APPROVED` → `VERIFIED` → lanjutan sama. SKU selalu langsung ke kantor.

Wewenang per peran ditentukan server di `backend/app/Domain/ApplicationStatus.php` (tabel lengkap di [README backend](../backend/README.md#alur-status-dan-wewenang)). `staff` dan `admin` memverifikasi, memproses, mengajukan ke kepala desa, menandai siap diambil, dan menandai sudah diambil; **hanya** `village_head` memutuskan `WAITING_APPROVAL` → `APPROVED`/`REJECTED`/`NEED_REVISION`. Admin tidak dapat menyetujui. Hanya saat fitur aktif, `rt_head` menyetujui/menolak `SUBMITTED` non-SKU di RT-nya dan `rw_head` menyetujui/menolak `RT_APPROVED` di RW-nya; kantor baru bertindak setelah `RW_APPROVED`. `lib/letter-workflow.ts` hanya membentuk tampilan dari `requires_neighborhood_approval` respons publik, tanpa tabel jenis surat duplikat.

Belum ada migrasi data untuk perubahan praproduksi ini. Bila database sudah berisi pengajuan, jangan mengganti flag langsung: hentikan intake, backup, inventarisasi status, dan selesaikan jalur lama `RT_APPROVED`/`RW_APPROVED` saat flag masih true sebelum mematikannya. Setelah off, `SUBMITTED` ditangani kantor; menyalakan kembali dapat mengarahkan `SUBMITTED` non-SKU ke RT/RW. Tahap yang sudah lewat tidak diulang. Cabut token, bersihkan cache konfigurasi, dan login ulang sesuai prosedur [README backend](../backend/README.md#konfigurasi-persetujuan-rtrw--keputusan-2-november-2026).

- Transisi yang tidak ada di alur (melompat, misalnya `SUBMITTED` → `RW_APPROVED`, atau dari status akhir) → 422. Transisi yang ada tetapi bukan wewenang peran, atau pengajuan di luar wilayah ketua RT/RW → 403 dengan pesan jelas.
- Pengajuan yang sudah berjalan sebelum fitur RT/RW tidak diulang; migration hanya menormalkan `rt`/`rw` menjadi 3 digit.
- `NEED_REVISION` dan `REJECTED` memerlukan catatan. Setiap perubahan dicatat di `application_events` dengan `user_id`.
- Frontend **tidak** menyimpan tabel transisi: tombol aksi di halaman detail dibentuk dari `allowed_transitions` respons server, dan hanya label tombol yang ada di `features/admin/application-detail.tsx`. Catatan wajib untuk Tolak/Minta perbaikan; Tolak, Setujui, dan Tandai sudah diambil memakai dialog konfirmasi. Sesudah perubahan, detail dan riwayat dibaca ulang dari server.
- `RT_APPROVED`/`RW_APPROVED` hanya mencatat persetujuan di sistem; tidak ada surat pengantar PDF, TTE, stempel digital, atau notifikasi.
- `APPROVED` berarti disetujui Kepala Desa; PDF final ber-QR dibuat otomatis (hanya untuk kantor). **[19 November 2026]** `READY_FOR_PICKUP` tidak lagi dipilih manual: status berpindah otomatis saat kantor mengunggah scan surat bertanda tangan, sehingga "siap diunduh" selalu berarti berkasnya ada. `COMPLETED` saat warga pertama kali mengunduh, saat masa unduh berakhir, atau ditandai petugas. Lihat [alur online](#alur-online-unduh-surat-oleh-warga-19-november-2026).

Login, sesi persisten per tab, daftar permohonan, filter, pagination, perubahan status, dan logout sudah diimplementasikan. Menu admin: Dashboard (`/admin`), Permohonan (`/admin/permohonan`), Persetujuan (`/admin/persetujuan`, hanya tampil untuk `village_head`; berisi `WAITING_APPROVAL`), dan Siap diambil (`/admin/surat`; berisi `APPROVED` dan `READY_FOR_PICKUP` lewat `statuses[]`). Hanya saat fitur aktif, `rt_head` mendapat Dashboard dan Antrean RT (`/admin/antrean-rt`, bawaan `SUBMITTED`) dan `rw_head` mendapat Dashboard dan Antrean RW (`/admin/antrean-rw`, bawaan `RT_APPROVED`); parameter `view=all` menampilkan semua pengajuan wilayah sebagai riwayat baca-saja pada halaman yang sama. Menyembunyikan menu hanya kenyamanan tampilan; otorisasi tetap di server; halaman konten (berita, pengumuman, potensi, statistik, pengaturan) dihapus dan dibuat ulang saat modulnya dikerjakan. Unggah dokumen persyaratan/revisi, OTP, TTE, notifikasi, dan pengelolaan konten publik belum tersedia.

Frontend adalah static export: halaman `/admin/permohonan/detail/` diekspor tanpa ID database; client membaca `?id=REQ-...` di dalam `Suspense`. Daftar bersama menyimpan `q`, `status`, `jenis_surat`, `sort`, `page`, `my_queue`, dan `today` dalam query string; antrean RT/RW juga menyimpan `view`. Tautan detail membawa `from=permohonan|persetujuan|surat` dan filter tersebut agar tombol kembali memulihkan daftar. Antrean Persetujuan dan Siap diambil membatasi status tetap, termasuk bila URL diubah manual.

### Privasi detail dan audit akses

- Kontrak detail: `StaffApplicationDetail` di `types/pelayanan.ts`; field formulir lengkap ditambah `request_id`, `status`, `created_at`, `updated_at`, `catatan`, `allowed_transitions`, dan `history`; field usaha nullable untuk layanan non-SKU; field surat final nullable untuk data lama. Setiap event berisi `action` (null = perubahan status, `ACCESS_CODE_RESET`, atau `STATEMENT_EDITED`), `from_status` (nullable untuk pengajuan awal), `to_status`, `note`, `staff_name` (nullable untuk sistem/petugas yang dihapus), dan `created_at`.
- NIK/KK tampil utuh untuk lima peran pelayanan berwenang (bukan KIM) (keputusan 20 Okt 2026: dibutuhkan untuk verifikasi). Detail tidak disimpan dalam localStorage/sessionStorage atau dicetak ke console.
- Audit memuat hanya `user_id`, `action=application.viewed`, `subject_type`, `subject_id`, dan `created_at` (selain primary key). Tidak ada isi identitas, catatan, token, maupun payload. Setiap GET detail berhasil, termasuk pemuatan ulang setelah perubahan status, menghasilkan audit. Audit harus tersimpan sebelum respons detail dikirim.
- NIK, KK, telepon, alamat, alamat usaha, tempat lahir, tanggal lahir, agama, dan status perkawinan tetap terenkripsi di database (`tanggal_lahir` tetap dikirim `YYYY-MM-DD` di detail); daftar memakai daftar field eksplisit tanpa nilai tersebut maupun catatan bebas. Hash kode akses tidak pernah dikirim di detail.
- **Pengecualian disetujui 18 Oktober 2026:** nama yang diketik sebagai pencarian boleh berada di `q` pada URL halaman/API. URL dapat tersimpan dalam riwayat browser dan access log infrastruktur; atur redaksi query string pada proxy/web server sebelum produksi. Jangan memasukkan NIK, KK, telepon, alamat, token, atau catatan ke pencarian/URL. Audit aplikasi tidak mencatat query pencarian.
- **Ketua RT/RW:** server mengirim NIK/KK utuh tetapi **tidak** mengirim `telepon`, `tempat_lahir`, `tanggal_lahir`, `jenis_kelamin`, `agama`, `status_perkawinan`, `kewarganegaraan`, `pendidikan`, maupun `pekerjaan` (field opsional di `StaffApplicationDetail`). Audit akses tetap sama untuk semua peran.
- Akses detail memakai ability `applications:manage` dan pemeriksaan lima peran pelayanan di server (staff/admin/village_head serta RT/RW saat fitur aktif; KIM ditolak), ditambah batas wilayah untuk ketua RT/RW. Kemampuan melihat detail tidak memberi hak menyetujui: hanya kepala desa memutuskan `WAITING_APPROVAL`.

## Menjalankan dan memeriksa

```powershell
npm ci
npm run dev
npm run lint
npx tsc --noEmit
node scripts/test-admin-filters.mjs
npm run build
```

Build menghasilkan static export pada `out/`; hosting harus mendukung direktori index.html dan halaman 404. Rute dinamis publik menggunakan generateStaticParams. Laravel dijalankan terpisah.

ESLint mengecualikan dependensi Composer dan output/cache generasi secara spesifik; kode aplikasi tetap diperiksa. Pengujian PHP terpisah dijelaskan pada README backend.

Uji menggunakan data fiktif: formulir kosong, NIK/KK tidak valid, tanggal masa depan, SKU/KTP_KK (422), isian jenis lain (422), tanggal keramaian lampau atau lebih dari 7 hari, pengajuan valid per jenis, sunting isi keterangan UMUM, salin receipt, kode akses salah, perubahan status, filter dan pagination, serta logout. Jangan mengklaim alur API lulus hanya berdasarkan build frontend.

## Kontak kantor dan peta

Satu objek `contact` di `lib/data.ts` menjadi sumber beranda, `/kontak`, footer, menu, baris jam layanan, dan alamat kebijakan privasi. R4 nanti memindahkan pengelolaannya ke panel; saat ini tanpa env dan perlu build ulang static export setelah perubahan.

- Alamat resmi dipertahankan. Jam: **Hari kerja, 08.00–13.00 WIB**; nama hari menunggu konfirmasi. Kontak resmi berizin: **Pelayanan Desa (Bu Ita)**.
- Tech Lead mengisi `phone`, `mapsEmbedUrl`, `mapsLinkUrl` yang masih `[PLACEHOLDER]`. Jangan mengisi nomor rekaan. `getContactLinks()` hanya memakai nomor digit berawalan `62`, embed berawalan `https://www.google.com/maps/embed?`, dan tautan berawalan `https://maps.app.goo.gl/` atau `https://www.google.com/maps/`. Nilai lain dianggap belum diisi.
- Nomor kosong: **Nomor kontak segera diumumkan.** Nomor valid: `tel:` dan tombol **Chat WhatsApp** (`https://wa.me/<nomor>`), area sentuh ≥48px. Email kosong tidak ditampilkan.
- Embed: Google Maps → cari Balai Desa → Bagikan → Sematkan peta → salin isi `src`. Link: Bagikan → Salin link. Komentar pengisian juga ada di objek kontak.
- Iframe memakai title **Peta lokasi Balai Desa Watuagung**, `loading="lazy"`, `referrerpolicy="no-referrer-when-downgrade"`, rasio responsif 4:3. Tanpa embed tidak ada kotak placeholder; alamat tetap tampil. Tautan **Buka di Google Maps** dibuka di tab baru bila valid, independen dari embed.
- Rating tidak diambil terpisah: kartu tempat di embed Google sudah menampilkannya. Tidak ada API rating atau dependensi Maps tambahan. CSP hosting perlu `frame-src https://www.google.com` (lihat `docs/deploy-plan.md`).
- Tes regresi: `node scripts/test-contact.mjs`; memakai nilai fiktif di memori, tidak mengganti kontak produksi.

## Konten publik dan produksi

Konten, statistik, anggaran, jadwal, dan informasi BUMDES masih prototipe atau menunggu verifikasi. Foto persawahan adalah ilustrasi Thomas Fuhrmann dari Wikimedia Commons, CC BY-SA 4.0, dipotong pada tampilan; atribusi di footer. Jangan mengklaimnya sebagai dokumentasi desa.

Noindex prototipe dipertahankan. Sebelum produksi, verifikasi data resmi, domain, HTTPS, CORS, backup, retensi data, dan keamanan backend. Jangan mengaktifkan indeks pencarian sebelum konten dan kesiapan layanan disetujui.
