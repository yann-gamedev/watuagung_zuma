# Integrasi pelayanan Watuagung

## Arsitektur saat ini

Frontend menggunakan Next.js App Router, React, TypeScript, dan Tailwind CSS. Form menggunakan React Hook Form dan Zod. Backend pelayanan menggunakan Laravel 13 dan Sanctum. Petunjuk Google Apps Script sebelumnya sudah tidak berlaku; tidak ada migrasi backend dalam pembaruan layout ini.

- `components/`: komponen bersama.
- `features/`: formulir, hasil pengajuan, cek status, dan panel petugas.
- `services/pelayanan.ts`: transport JSON API dan simulasi browser.
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

Path berikut relatif terhadap `/api/v1`. Transport menggunakan `Accept: application/json` dan `Content-Type: application/json`, tanpa field `action`.

| Metode | Path | Permintaan / kegunaan |
| --- | --- | --- |
| POST | `/applications` | Publik, 5/menit | Field sesuai [Submission](../types/pelayanan.ts); SKU memerlukan informasi usaha |
| POST | `/applications/status` | `request_id` dan `lookup_secret`; 5 kode salah per nomor → 429 selama 15 menit |
| POST | `/staff/login` | `username` dan `password`; kompatibilitas klien lama: `email` dan `password`; respons bearer token |
| POST | `/staff/logout` | Mencabut token petugas aktif |
| GET | `/staff/me` | Profil petugas pemilik token: `{ name, username, role, rt, rw }` dengan `role` = `staff`, `village_head`, `admin`, `rt_head`, atau `rw_head`; `rt`/`rw` nullable (3 digit untuk ketua RT/RW); dipakai untuk memvalidasi sesi |
| GET | `/staff/applications` | Daftar paginasi, dibatasi wilayah dan jenis surat RT/RW (tanpa SKU) untuk `rt_head`/`rw_head` (`page` ≥ 1, 20 per halaman). Filter opsional `status` (satu) **atau** `statuses[]` (beberapa), tidak boleh keduanya; `q` (maksimal 100 karakter) mencari sebagian nomor/nama secara literal dan tidak peka huruf besar/kecil, `jenis_surat` = `SKU`/`DOMISILI`/`SKTM`/`KTP_KK`, `sort` = `terbaru` (bawaan)/`terlama`. Tiap item ([StaffApplication](../types/pelayanan.ts)) memuat `allowed_transitions`, tanpa data pribadi sensitif atau catatan bebas |
| GET | `/staff/applications/{request_id}` | Detail terotorisasi untuk lima peran panel: data pemohon, usaha, keperluan, catatan, `allowed_transitions`, dan riwayat status. Ketua RT/RW hanya untuk wilayahnya (di luar wilayah → 404) dan menerima versi terbatas. Respons `Cache-Control: no-store`; akses berhasil dicatat di `audit_logs` |
| PATCH | `/staff/applications/{request_id}/status` | `status` dan `catatan`; respons ([StaffStatusResponse](../types/pelayanan.ts)) memuat `allowed_transitions` baru |

Pengajuan berhasil mengembalikan HTTP 201 dengan `success`, `request_id`, `status`, `jenis_surat`, dan `lookup_secret`. Cek status mengembalikan `request_id`, `jenis_surat` (wajib dibaca frontend untuk memilih linimasa), `status`, serta catatan, bukan identitas sensitif. Penolakan oleh RT/RW diberi awalan "Ditolak oleh Ketua RT/RW". Respons validasi gagal menggunakan HTTP 422. Frontend membatasi waktu tunggu API menjadi 20 detik dan memvalidasi respons pelayanan dengan Zod.

### Login username

Frontend mengirim `{ username, password }`. Username unik, 1–64 karakter, diawali huruf kecil/angka, selanjutnya huruf kecil, angka, `_`, atau `-`. Spasi luar dibuang; huruf besar ditolak. Klien lama masih dapat mengirim `{ email, password }`, tetapi kedua identitas tidak boleh dikirim bersama. Identitas tidak dikenal, kata sandi salah, peran di luar lima peran panel, serta ketua RT/RW tanpa wilayah lengkap menghasilkan pesan 401 yang sama. Validasi gagal menghasilkan 422; rate limit tetap 5/menit.

Jalankan migration penambahan username sebelum memakai frontend baru. Akun lama tetap memiliki username nullable dan bisa memakai API login email; untuk form baru, administrator perlu menetapkan username unik pada akun tersebut. Tidak ada akun/kata sandi bawaan atau endpoint pendaftaran publik. Tipe frontend: `StaffLoginRequest` dan `StaffLoginResponse` di `types/pelayanan.ts`.

## Kode akses dan autentikasi

- Kode akses diberikan setelah pengajuan API dan disimpan pada sessionStorage tab untuk halaman berhasil. Simpan nomor serta kode di tempat aman; pemulihan belum tersedia.
- Kode akses dikirim pada body POST untuk cek status, tidak dimasukkan ke URL.
- **Buat ulang kode akses:** `POST /staff/applications/{request_id}/lookup-secret` oleh staff, admin, rt_head, rw_head (bukan village_head). Permohonan di luar wilayah RT/RW = 404. Status `COMPLETED` = 422. Kode lama langsung tidak berlaku; kunci salah coba dibuka. Respons hanya berisi kode sekali; tidak ada di log. Entri riwayat dengan `action: ACCESS_CODE_RESET` dan catatan audit `application.access_code_reset`. input dinormalkan (tanpa tanda hubung/spasi/huruf kecil tetap diterima). Backend menyimpan HMAC-nya dengan APP_KEY; kode lama 48 karakter tetap berlaku. 5 kode salah per nomor pengajuan → HTTP 429 selama 15 menit; frontend menampilkan pesan dari server.
- Backend menyimpan hash kode akses; NIK, KK, telepon, dan alamat dienkripsi dengan APP_KEY.
- Token petugas disimpan di `sessionStorage` tab (`watuagung-staff-token`) oleh `features/admin/session.tsx`. Pindah route admin dan reload tetap login; menutup tab menghapus sesi. Fitur browser "pulihkan tab" atau "duplikat tab" dapat ikut menyalin sessionStorage. Jangan memindahkan token ke URL atau localStorage.
- Saat dibuka atau di-reload, panel memvalidasi token lewat `GET /staff/me` sebelum menampilkan isi. Gangguan jaringan menampilkan pesan "Server belum dapat dihubungi" dengan tombol coba lagi, bukan logout.
- Semua permintaan panel melewati `adminRequest()` (`features/admin/api.ts`). Respons 401 menghapus sesi lalu menampilkan login dengan pesan "Sesi berakhir, silakan masuk lagi."
- Token kedaluwarsa setelah `SANCTUM_EXPIRATION` menit (bawaan 480 = 8 jam kerja), dihitung sejak login, bukan sejak aktivitas terakhir. Tipe frontend: `StaffProfile` di `types/pelayanan.ts`.
- Jangan mengganti APP_KEY pada database berisi data terenkripsi tanpa prosedur migrasi yang benar.

## Status dan batas fitur

Alur bergantung pada jenis surat. Konfigurasinya ada di `backend/app/Domain/LetterType.php` (sumber kebenaran) dan dicerminkan untuk tampilan di `lib/letter-workflow.ts`:

- SKU: `SUBMITTED` -> `VERIFIED` -> `PROCESSING` -> `WAITING_APPROVAL` -> `APPROVED` -> `READY_FOR_PICKUP` -> `COMPLETED`.
- DOMISILI, SKTM, KTP_KK: `SUBMITTED` -> `RT_APPROVED` -> `RW_APPROVED` -> `VERIFIED` -> ... -> `COMPLETED` (lanjutan sama dengan SKU).

Wewenang per peran ditentukan server di `backend/app/Domain/ApplicationStatus.php` (tabel lengkap di [README backend](../backend/README.md#alur-status-dan-wewenang)). Ringkasnya: `rt_head` menyetujui/menolak `SUBMITTED` di RT-nya, `rw_head` menyetujui/menolak `RT_APPROVED` di RW-nya; `staff` dan `admin` memverifikasi, memproses, mengajukan ke kepala desa, menandai siap diambil, dan menandai sudah diambil; **hanya** `village_head` yang memutuskan `WAITING_APPROVAL` → `APPROVED`/`REJECTED`/`NEED_REVISION`. Admin tidak dapat menyetujui. Untuk surat yang memerlukan RT/RW, kantor desa baru bertindak setelah `RW_APPROVED`.

- Transisi yang tidak ada di alur (melompat, misalnya `SUBMITTED` → `RW_APPROVED`, atau dari status akhir) → 422. Transisi yang ada tetapi bukan wewenang peran, atau pengajuan di luar wilayah ketua RT/RW → 403 dengan pesan jelas.
- Pengajuan yang sudah berjalan sebelum fitur RT/RW tidak diulang; migration hanya menormalkan `rt`/`rw` menjadi 3 digit.
- `NEED_REVISION` dan `REJECTED` memerlukan catatan. Setiap perubahan dicatat di `application_events` dengan `user_id`.
- Frontend **tidak** menyimpan tabel transisi: tombol aksi di halaman detail dibentuk dari `allowed_transitions` respons server, dan hanya label tombol yang ada di `features/admin/application-detail.tsx`. Catatan wajib untuk Tolak/Minta perbaikan; Tolak, Setujui, dan Tandai sudah diambil memakai dialog konfirmasi. Sesudah perubahan, detail dan riwayat dibaca ulang dari server.
- `RT_APPROVED`/`RW_APPROVED` hanya mencatat persetujuan di sistem; tidak ada surat pengantar PDF, TTE, stempel digital, atau notifikasi.
- `APPROVED` berarti disetujui, **bukan PDF tersedia**. `READY_FOR_PICKUP` ditandai petugas saat surat fisik siap; warga diminta membawa KTP asli dan nomor pengajuan. `COMPLETED` berarti surat sudah diambil.

Login, sesi persisten per tab, daftar permohonan, filter, pagination, perubahan status, dan logout sudah diimplementasikan. Menu admin: Dashboard (`/admin`), Permohonan (`/admin/permohonan`), Persetujuan (`/admin/persetujuan`, hanya tampil untuk `village_head`; berisi `WAITING_APPROVAL`), dan Siap diambil (`/admin/surat`; berisi `APPROVED` dan `READY_FOR_PICKUP` lewat `statuses[]`). `rt_head` hanya mendapat Antrean RT (`/admin/antrean-rt`, bawaan `SUBMITTED`) dan `rw_head` hanya Antrean RW (`/admin/antrean-rw`, bawaan `RT_APPROVED`); parameter `view=all` menampilkan semua pengajuan wilayah sebagai riwayat baca-saja pada halaman yang sama. Menyembunyikan menu hanya kenyamanan tampilan; otorisasi tetap di server; halaman konten (berita, pengumuman, potensi, statistik, pengaturan) dihapus dan dibuat ulang saat modulnya dikerjakan. PDF, unggah dokumen/revisi, OTP, notifikasi, dan pengelolaan konten publik belum tersedia.

Frontend adalah static export: halaman `/admin/permohonan/detail/` diekspor tanpa ID database; client membaca `?id=REQ-...` di dalam `Suspense`. Daftar bersama menyimpan `q`, `status`, `jenis_surat`, `sort`, dan `page` dalam query string. Tautan detail membawa `from=permohonan|persetujuan|surat` dan filter tersebut agar tombol kembali memulihkan daftar. Antrean Persetujuan dan Siap diambil membatasi status tetap, termasuk bila URL diubah manual.

### Privasi detail dan audit akses

- Kontrak detail: `StaffApplicationDetail` di `types/pelayanan.ts`; field formulir lengkap ditambah `request_id`, `status`, `created_at`, `updated_at`, `catatan`, `allowed_transitions`, dan `history`; field usaha nullable untuk layanan non-SKU. Setiap event berisi `from_status` (nullable untuk pengajuan awal), `to_status`, `note`, `staff_name` (nullable untuk sistem/petugas yang dihapus), dan `created_at`.
- NIK/KK tampil utuh untuk semua peran panel (keputusan 20 Okt 2026: dibutuhkan untuk verifikasi). Detail tidak disimpan dalam localStorage/sessionStorage atau dicetak ke console.
- Audit memuat hanya `user_id`, `action=application.viewed`, `subject_type`, `subject_id`, dan `created_at` (selain primary key). Tidak ada isi identitas, catatan, token, maupun payload. Setiap GET detail berhasil, termasuk pemuatan ulang setelah perubahan status, menghasilkan audit. Audit harus tersimpan sebelum respons detail dikirim.
- NIK, KK, telepon, alamat, dan alamat usaha tetap terenkripsi di database; daftar memakai daftar field eksplisit tanpa nilai tersebut maupun catatan bebas. Hash kode akses tidak pernah dikirim di detail.
- **Pengecualian disetujui 18 Oktober 2026:** nama yang diketik sebagai pencarian boleh berada di `q` pada URL halaman/API. URL dapat tersimpan dalam riwayat browser dan access log infrastruktur; atur redaksi query string pada proxy/web server sebelum produksi. Jangan memasukkan NIK, KK, telepon, alamat, token, atau catatan ke pencarian/URL. Audit aplikasi tidak mencatat query pencarian.
- **Ketua RT/RW:** server mengirim NIK/KK utuh tetapi **tidak** mengirim `telepon`, `tempat_lahir`, `tanggal_lahir`, maupun `jenis_kelamin` (field opsional di `StaffApplicationDetail`). Audit akses tetap sama untuk semua peran.
- Akses detail memakai ability `applications:manage` dan pemeriksaan lima peran panel di server, ditambah batas wilayah untuk ketua RT/RW. Kemampuan melihat detail tidak memberi hak menyetujui: hanya kepala desa memutuskan `WAITING_APPROVAL`.

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

Uji menggunakan data fiktif: formulir kosong, NIK/KK tidak valid, tanggal masa depan, SKU tanpa informasi usaha, pengajuan valid, salin receipt, kode akses salah, perubahan status, filter dan pagination, serta logout. Jangan mengklaim alur API lulus hanya berdasarkan build frontend.

## Konten publik dan produksi

Konten, statistik, anggaran, jadwal, dan informasi BUMDES masih prototipe atau menunggu verifikasi. Foto persawahan adalah ilustrasi Thomas Fuhrmann dari Wikimedia Commons, CC BY-SA 4.0, dipotong pada tampilan; atribusi di footer. Jangan mengklaimnya sebagai dokumentasi desa.

Noindex prototipe dipertahankan. Sebelum produksi, verifikasi data resmi, domain, HTTPS, CORS, backup, retensi data, dan keamanan backend. Jangan mengaktifkan indeks pencarian sebelum konten dan kesiapan layanan disetujui.
