# API Laravel Desa Watuagung

Backend ini melayani formulir administrasi dan panel petugas dari frontend Next.js pada direktori induk. Teknologi: PHP 8.3+, Laravel 13, Sanctum, dan SQLite untuk pengembangan. Tidak ada data warga contoh yang otomatis dimasukkan ke database.

Panduan terkait: [README utama](../README.md), [indeks dokumentasi](../docs/README.md), [kontrak integrasi](../docs/integrasi.md), dan [status roadmap](../ROADMAP.md).

## Struktur backend

| Lokasi | Isi |
| --- | --- |
| `app/Domain/` | Aturan status/peran, wilayah, kode akses, nomor surat, dan PDF |
| `app/Http/Controllers/Api/` | Endpoint pelayanan dan panel petugas |
| `app/Models/` | Model dan perlindungan data sensitif |
| `routes/` | Route API/web, CLI akun, dan jadwal pembersihan token |
| `database/` | Migration dan fixture/seeder fiktif; SQLite lokal tidak dilacak |
| `resources/views/letters/` | Template Blade enam surat resmi + SKU/KTP_KK lama |
| `config/` | Konfigurasi aplikasi, CORS, sesi, dan penerbitan surat |
| `storage/` | Berkas privat, cache, dan log lokal; jangan dipublikasikan |
| `tests/` | Pengujian fitur dan unit |
| `vendor/` | Dependensi Composer yang dihasilkan saat install |

## Persiapan lokal

Buka terminal PowerShell di folder `backend/`. Siapkan PHP 8.3+, Composer, dan ekstensi yang diminta dependensi, termasuk SQLite dan GD untuk QR PNG:

```powershell
composer install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Hanya pada instalasi baru yang belum memiliki `APP_KEY`:

```powershell
php artisan key:generate
```

Lanjutkan tanpa menimpa database yang sudah ada:

```powershell
if (!(Test-Path database/database.sqlite)) { New-Item database/database.sqlite -ItemType File }
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Jika Composer tidak tersedia global tetapi file lokal ada, ganti `composer install` dengan `php ..\composer.phar install`. `composer.phar`, `.env`, dan database SQLite lokal tidak masuk Git. Jangan menimpa `.env` yang sudah digunakan, atau mengganti `APP_KEY` setelah ada data: field terenkripsi tidak dapat dibaca dengan kunci baru. URL pemeriksaan kesehatan: http://127.0.0.1:8000/up.

Perintah yang berguna (dijalankan dari folder `backend/`):

```powershell
php artisan test
php artisan route:list --path=api
php artisan config:clear
```

### Tes SQLite dan PostgreSQL

`phpunit.xml` tetap memakai SQLite `:memory:`. PostgreSQL 16+ dipilih untuk produksi; verifikasi lokal terakhir memakai PostgreSQL 18.6 (179 tes / 1.858 assertions) dan SQLite (179 tes / 1.856 assertions), lihat [catatan progres](../docs/progres-2026-10-24.md).

**Hanya gunakan database lokal khusus `watuagung_test`: `migrate:fresh` dan suite tes menghapus seluruh isinya.** Buat database kosong tersebut dengan user lokal yang sudah disiapkan, misalnya `createdb -h 127.0.0.1 -p 5432 -U <user-lokal> -W watuagung_test`. Jangan memakai database pengembangan/produksi berisi data yang perlu disimpan.

1. Pastikan PHP CLI memuat `pdo_pgsql` (`php -m`). Tidak perlu paket Composer tambahan.
2. Salin `.env.testing.pgsql.example` menjadi `.env.testing.pgsql` bila belum ada; isi kredensial lokal di file itu, bukan di `phpunit.xml` atau file contoh. Jangan commit file kredensial.
3. Pastikan tidak ada cache konfigurasi (`php artisan config:clear`) atau override `DB_*`/`APP_ENV` pada shell. Jangan menyimpan konfigurasi PostgreSQL di `.env.testing`, agar tes SQLite tidak memuat konfigurasi tersebut.
4. Gunakan `APP_KEY` lokal yang **sudah ada** melalui environment proses ketika menjalankan tes PostgreSQL; jangan membuat, mengganti, mencetak, atau menyalin nilainya ke file contoh. Contoh PowerShell berikut membaca baris kunci lokal tanpa menampilkannya (format `.env` satu baris standar):

```powershell
$keyLine = Get-Content .env | Where-Object { $_ -match '^APP_KEY=' } | Select-Object -First 1
if (!$keyLine) { throw 'APP_KEY lokal yang sudah ada diperlukan; jangan membuat kunci baru.' }
$env:APP_KEY = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
try {
    php artisan migrate:fresh --env=testing.pgsql
    if ($LASTEXITCODE -ne 0) { throw 'migrate:fresh gagal' }
    php artisan test --env=testing.pgsql
    if ($LASTEXITCODE -ne 0) { throw 'Tes PostgreSQL gagal' }
} finally {
    Remove-Item Env:APP_KEY
    Remove-Variable keyLine
}
php artisan migrate:rollback --env=testing.pgsql
# Ulangi rollback hingga "Nothing to rollback", lalu:
php artisan migrate --env=testing.pgsql
php artisan test
```

`--env=testing.pgsql` mempertahankan environment PostgreSQL saat Artisan menjalankan PHPUnit; tanpa opsi itu, bawaan SQLite di `phpunit.xml` berlaku. `APP_ENV=testing` di file contoh tetap diperlukan untuk perilaku lingkungan tes. `LOG_CHANNEL=null` mencegah kegagalan yang sengaja dipicu suite menulis query/fixture ke log.

Jika DLL `php_pdo_pgsql.dll` sudah tersedia di Windows tetapi belum aktif, alternatif tanpa perubahan `php.ini` global adalah membuat direktori konfigurasi sementara berisi file `pgsql.ini` dengan `extension=pdo_pgsql`, lalu set `$env:PHP_INI_SCAN_DIR` ke direktori itu sebelum menjalankan perintah. Ini juga berlaku pada proses anak PHPUnit; `php -d extension=pdo_pgsql artisan test` saja tidak meneruskan ekstensi ke proses anak. Pulihkan environment shell setelah selesai.

Suite menguji trigger kegagalan transaksi dan SQL penguncian sesuai driver. Ini **bukan** bukti konkurensi multiproses atau kesiapan produksi; uji simultan M3a dijalankan terpisah di bawah.

### Uji penomoran PostgreSQL multiproses (M3a)

`tests/Concurrency/letter-number.php` adalah skrip CLI mandiri, **tidak ikut `php artisan test`** (`phpunit.xml` hanya memuat Unit/Feature). Lokasi ini menjaga bootstrap dan fixture dekat backend tanpa menambah command aplikasi atau dependensi. Memakai Symfony Process yang sudah terpasang; PHP CLI harus mengaktifkan `proc_open` dan `pdo_pgsql` pada induk **serta proses anak**.

Siapkan `.env.testing.pgsql`, database lokal `watuagung_test`, dan pewarisan kunci lokal sesuai bagian sebelumnya. User PostgreSQL perlu hak membuat schema dan kapasitas minimal 31 koneksi bebas. Skrip menolak selain `APP_ENV=testing`, koneksi PostgreSQL lokal, database `watuagung_test`, atau konfigurasi yang masih di-cache; `DB_URL` harus kosong. Jangan menjalankan suite lain bersamaan.

Dari `backend/`, pada blok `try` pewarisan kunci di atas, **ganti perintah fresh/test** dengan:

```powershell
foreach ($run in 1..3) {
    Write-Output "Run $run/3"
    php tests/Concurrency/letter-number.php
    if ($LASTEXITCODE -ne 0) { throw 'Uji konkurensi gagal; berhenti dan minta persetujuan sebelum mengubah penomoran.' }
}
```

- Setiap jalan membuat schema acak `concurrency_<hex>`, menjalankan migration dan membuat 30 permohonan fiktif `PROCESSING` lintas empat jenis surat, serta 30 petugas. Cast terenkripsi model tetap dipakai. Tabel `public` tidak dihapus/diubah; tidak memakai `migrate:fresh`.
- Menjalankan **30 proses PHP terpisah** yang memanggil `StaffController::update()` asli. Bukan salinan algoritma `LetterNumber`, bukan simulasi transaksi berurutan. Autentikasi HTTP/middleware tidak dicakup skrip ini.
- Induk menahan lock tabel counter yang awalnya kosong; `pg_locks` harus membuktikan **30 sesi PostgreSQL menunggu bersamaan** sebelum lock dilepas. Ini menguji perebutan pembuatan counter pertama sekaligus urutan berikutnya. Tidak menyisipkan counter awal atau menambah retry di skrip; retry transaksi bawaan controller tetap berlaku.
- Tanggal fiktif dibekukan ke 24 Oktober 2026 pukul 12.00 WIB pada semua proses agar tidak melintasi tahun. Memeriksa 30 nomor unik, urutan tepat 1..30, satu counter tahun 2026 bernilai 30, satu nomor per permohonan, serta 30 status dan event beserta petugas penerbitnya.
- Batas waktu barrier 45 detik, SQL/lock 60 detik, dan proses anak 90 detik. Gagal/timeout → exit 1; output exception/worker tidak dicetak agar SQL, data sensitif, dan rahasia tidak bocor. Schema dibersihkan dalam `finally`, juga saat gagal. Bila proses induk dihentikan paksa, schema sementara mungkin tertinggal; periksa secara manual, jangan menghapus schema lain.
- Tiga hasil PASS adalah bukti skenario lokal tersebut, bukan pembuktian matematis untuk semua beban, uji server produksi, atau uji HTTP end-to-end. Jika satu jalan gagal, hentikan rangkaian dan laporkan sebelum mengubah `LetterNumber`.

### Konfigurasi persetujuan RT/RW — keputusan 2 November 2026

Keputusan klien: RT/RW **nonaktif secara bawaan**, bukan dihapus. Satu-satunya sakelar ada di backend: `config('letters.neighborhood_approval')`, env `LETTER_NEIGHBORHOOD_APPROVAL=false`. Perluas `config/letters.php` yang sudah ada; pertahankan format nomor, identitas desa, PDF, dan konfigurasi lain. Tidak ada sakelar frontend. `LetterType::requiresNeighborhoodApproval()` membaca keputusan ini; `ApplicationStatus` menggunakan `LetterType`, bukan tabel jenis surat duplikat. Saat false semua jenis langsung ke petugas desa, lalu Kepala Desa, siap diambil, selesai. Saat true semua jenis kecuali SKU (termasuk empat jenis final baru 8 November 2026) melalui RT lalu RW; SKU tetap langsung ke kantor.

Kontrak perubahan: `/staff/me` mengirim `features: { neighborhood_approval: boolean }`; submit dan cek status publik mengirim `requires_neighborhood_approval: boolean` dari `LetterType`. Linimasa frontend memakai boolean respons, bukan tabel kebutuhan per jenis. Teks publik statis mengikuti alur bawaan. Verifikasi perubahan 2 November: SQLite dan PostgreSQL lulus (masing-masing 276 tes), lihat `docs/progres-2026-11-02.md`. Hasil tes terdahulu di dokumen ini bukan verifikasi keputusan baru.

**Praproduksi: tidak ada migrasi data/status baru untuk penonaktifan ini.** Model, tabel, dan migration `residents` tetap dipertahankan hanya untuk seeder/tes, tanpa referensi route atau fitur produksi. Jangan menghapus riwayat pengajuan atau akun RT/RW.

Jika konfigurasi akan diganti pada database yang sudah berisi data, ikuti prosedur operasional berikut:

1. Hentikan penerimaan pengajuan sementara. Buat backup database dan storage privat yang dapat dipulihkan; pertahankan `APP_KEY` yang sama.
2. Inventarisasi jumlah/status pengajuan, akun wilayah, dan token aktif. Jangan mengubah status massal atau menjalankan migrasi status otomatis.
3. Sebelum mematikan fitur, pertahankan flag true dan selesaikan pengajuan lama berstatus `RT_APPROVED`/`RW_APPROVED` sampai melewati jalur RT/RW ke kantor desa. Jangan mematikan fitur saat pengajuan masih tertahan pada kedua status tersebut.
4. Tetapkan `LETTER_NEIGHBORHOOD_APPROVAL=false` di env backend. Pengajuan yang masih `SUBMITTED` sesudah off diproses petugas desa, termasuk non-SKU. Bila kelak diaktifkan kembali, `SUBMITTED` non-SKU dapat masuk antrean RT/RW; tahap yang sudah dilewati, termasuk pengajuan selesai, tidak diputar mundur.
5. Cabut token sesi panel lama melalui prosedur administrasi yang terkontrol. Jalankan `php artisan config:clear` agar env baru terbaca (bangun ulang cache konfigurasi bila deployment memakainya), lalu wajibkan login ulang. Tanpa pencabutan pun token RT/RW lama ditolak 403 saat fitur mati; token yang sudah dicabut menghasilkan 401.
6. Uji alur dan pembatasan peran di lingkungan target sebelum membuka penerimaan kembali. Mengubah flag bukan bukti alur telah diverifikasi.

### Akun petugas

Jalankan `php artisan migrate` terlebih dahulu untuk menambahkan kolom username unik. Akun lama tetap tersimpan dengan username null dan login email melalui API masih didukung. Form admin sekarang menggunakan username; tetapkan username unik pada akun lama sebelum memakainya. Format: 1–64 karakter huruf kecil/angka, `_`, atau `-`, diawali huruf kecil/angka. Tidak ada akun/kata sandi bawaan.

Tidak ada endpoint pendaftaran publik. Enam peran dikenal. Panel bawaan menerima `staff` (petugas), `village_head` (kepala desa), `admin`, dan `kim` (**KIM (Media Informasi)**). KIM hanya mengelola berita/UMKM termasuk foto, bukan pemohon/pengajuan, dashboard/ringkasan, buku registrasi, PDF/QR surat, buat ulang kode akses, pengguna, atau konten situs. Field pemilik UMKM tetap tersedia pada detail panel yang diizinkan untuk pengelolaan; izin publik menentukan apakah kontak tampil kepada pengunjung. Peran `rt_head` (ketua RT) dan `rw_head` (ketua RW) tetap ada, tetapi hanya dapat dibuat/dipakai saat fitur RT/RW aktif. Buat akun lokal dengan perintah berikut; kata sandi (minimal 12 karakter) diminta dua kali secara tersembunyi, jadi tidak tersimpan di riwayat terminal maupun repositori:

```powershell
php artisan staff:create petugas-lokal --role=staff --name="Petugas Lokal"
php artisan staff:create kades-lokal --role=village_head --name="Kepala Desa Lokal"
php artisan staff:create admin-lokal --role=admin --name="Admin Lokal"
php artisan staff:create kim-lokal --role=kim --name="Media Informasi Lokal"
```

Hanya setelah `LETTER_NEIGHBORHOOD_APPROVAL=true` diterapkan sesuai prosedur di atas:

```powershell
php artisan staff:create rt-lokal --role=rt_head --rt=1 --rw=2 --name="Ketua RT Lokal"
php artisan staff:create rw-lokal --role=rw_head --rw=2 --name="Ketua RW Lokal"
```

Saat fitur mati, login RT/RW mendapat 401 generik `Kredensial tidak valid.`; token RT/RW lama mendapat 403 pada endpoint panel. API pembuatan/penetapan peran atau wilayah/aktivasi akun RT/RW ditolak 422 dengan pesan jelas bahwa fitur nonaktif. Menonaktifkan akun RT/RW yang sudah ada tetap diizinkan. `staff:create --role=rt_head|rw_head` juga ditolak. `/staff/me` mengirim `features.neighborhood_approval`; otorisasi tetap di server.

`--email` opsional (bawaan `<username>@example.test`). `rt_head` wajib `--rt` dan `--rw`; `rw_head` wajib `--rw`; isinya 1–3 digit dan disimpan sebagai 3 digit (`1` → `001`). Kolom `rt`/`rw` pada `users` nullable untuk peran lain. Ketua RT/RW tanpa wilayah lengkap tidak bisa masuk panel. Nama, username, dan nomor wilayah di atas hanya contoh, **bukan** akun bawaan. Buat admin pertama melalui CLI; untuk pengelolaan berikutnya gunakan panel **Akun** (`/admin/akun`) agar validasi wilayah, perlindungan admin, dan audit diterapkan.

Sejak migration `2026_10_22_000000_add_staff_account_fields_to_users_table`, admin dapat mengelola akun dari panel **Akun**. Email menjadi nullable; akun baru wajib memakai username. Kolom baru: `is_active` (default true), `must_change_password` (default false), dan `last_login_at`. Kata sandi sementara dari panel minimal 10 karakter (CLI tetap 12) dan wajib diganti saat login pertama. Akun nonaktif ditolak dengan pesan yang sama seperti kredensial salah; menonaktifkan akun mencabut semua tokennya. Satu wilayah hanya boleh punya satu `rt_head` aktif (RT+RW) dan satu `rw_head` aktif (RW); nonaktifkan ketua lama sebelum membuat pengganti. Admin tidak dapat menonaktifkan atau menurunkan perannya sendiri, dan sistem selalu menyisakan minimal satu admin aktif. Audit mencatat `user.created`, `user.updated`, dan `user.password_reset` di `audit_logs`.

### Ability panel dan pencabutan token lama

| Ability | Peran aktif yang berwenang |
|---|---|
| `panel` | Semua peran yang boleh masuk panel; RT/RW hanya saat fitur aktif |
| `applications:manage` | staff, admin, village_head; rt_head/rw_head saat fitur aktif dan sesuai wilayah |
| `media:manage` | admin, staff, kim; berita/UMKM termasuk foto memakai `User::canManageMedia()` |
| `site:manage` | admin, staff; konten situs termasuk unggah gambar/dokumen memakai `User::canManageContent()` |

`GET /staff/me` mengembalikan array `abilities` bersama field profil dan `features` yang sudah ada. Logout, `/me`, dan ganti kata sandi sendiri memakai grup `panel`. Seluruh `/staff/users…` tetap memakai grup `applications:manage`, tetapi controller membatasi manajemen akun hanya untuk admin. Ability bukan pengganti pemeriksaan peran, akun aktif, wilayah, atau batas endpoint pelayanan.

Migration `2026_11_08_000001_revoke_staff_tokens_for_abilities` menghapus **seluruh baris `personal_access_tokens`**, bukan data akun/pengajuan. Semua sesi harus login ulang agar memperoleh ability sesuai peran. `down()` tidak dapat memulihkan token yang dihapus; rollback tetap memerlukan login ulang. Jadwalkan pembaruan dan beri tahu pengguna sebelum menjalankan migration.

### Diagnosis login dan pemulihan akun

Akun tersimpan di tabel `users` pada **database aktif Laravel**. Git push/pull tidak memindahkan akun, `.env`, atau file SQLite. Akun yang dibuat pada database uji/sementara tidak muncul pada `database/database.sqlite`. Menghentikan server tidak menghapus akun.

#### Pemeriksaan aman (tanpa mengubah akun)

1. Pastikan backend berjalan dari folder `backend/` yang benar, bukan salinan repo lain: `php artisan serve --host=127.0.0.1 --port=8000`. URL http://127.0.0.1:8000/up harus berhasil. Frontend dan backend perlu dua terminal aktif.
2. Periksa `.env` backend **secara lokal**, jangan membagikan isinya. Pengembangan bawaan memakai `DB_CONNECTION=sqlite`; jika `DB_DATABASE` tidak diisi, file bawaan `backend/database/database.sqlite`. Override environment proses (`DB_CONNECTION`, `DB_DATABASE`, `DB_URL`, `APP_ENV`) dapat mengalahkan `.env`. Jangan menjalankan server harian dari terminal pengujian yang masih menyimpan override. Setelah memperbaiki konfigurasi lokal, jalankan `php artisan config:clear` lalu restart Laravel; jangan mengganti `APP_KEY`.
3. Untuk memastikan koneksi dan satu akun, jalankan `php artisan tinker` dari `backend/`, lalu perintah baca-saja berikut. Ganti `username-anda`; jangan mencetak kolom password, token, email, atau data warga:

   ```php
   DB::connection()->getDriverName();
   DB::connection()->getDatabaseName();
   App\Models\User::query()->where('username', 'username-anda')->first(['username', 'role', 'is_active', 'must_change_password']);
   config('letters.neighborhood_approval');
   ```

   `null` berarti username tidak ada **pada database tersebut**, bukan bukti seluruh data hilang. Periksa database asli/backup terlebih dahulu. Hasil CLI menunjukkan konfigurasi terminal itu; restart server dari terminal yang sama agar tidak memakai override lama.
4. Frontend harus memakai `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`, bukan endpoint tanpa `/api/v1`; `NEXT_PUBLIC_DEMO_MODE` harus false/tidak aktif. Restart Next.js setelah perubahan. Override PowerShell dapat dihapus dengan `Remove-Item Env:NEXT_PUBLIC_DEMO_MODE -ErrorAction SilentlyContinue`. Build demo wajib dibangun ulang untuk mode API; demo Vercel tetap tidak melayani admin.

| Gejala | Makna dan langkah |
|---|---|
| Panel petugas tidak aktif pada demo | Mode demo/API URL kosong atau build demo. Bukan kegagalan kata sandi. |
| Server belum dapat dihubungi / gagal jaringan | Cek `/up`, port/API URL, dan `FRONTEND_ORIGINS`. Origin mencakup protokol, host, port; `http://localhost:3000` berbeda dari `http://127.0.0.1:3000`. |
| 401 / `Kredensial tidak valid.` saat login | Username/kata sandi salah, akun nonaktif, peran tidak diizinkan, RT/RW nonaktif, atau wilayah RT/RW tidak lengkap. Pesan sengaja generik; cek metadata akun secara lokal. |
| 422 saat login | Format username/isian salah. Username 1–64 karakter, diawali huruf kecil/angka; sisanya huruf kecil/angka, `_`, `-`. Bukan nama tampilan/email. Akun lama username null perlu ditetapkan oleh admin berwenang; API email lama tidak berarti form username menerima email. |
| 429 | Batas login 5 percobaan/menit. Hentikan percobaan, tunggu sampai batas pulih; jangan mengakali rate limit. |
| Sesi berakhir | Token kedaluwarsa/dicabut; masuk ulang. Sesi disimpan per tab/origin, bukan bukti akun terhapus. |
| Diminta ganti kata sandi | Login berhasil, akun memakai kata sandi sementara. Selesaikan penggantian sebelum memakai fitur lain. |
| 403 setelah login | Periksa peran/akun aktif/ability dan konfigurasi RT/RW. Admin/staff boleh mengelola media dan konten situs; KIM hanya berita/UMKM termasuk foto; Kepala Desa tidak boleh mengelola keduanya. |

#### Lupa kata sandi atau akun nonaktif

- Bila admin lain masih bisa masuk: buka **Akun** (`/admin/akun`), pilih akun yang benar, lakukan **Reset kata sandi** atau aktivasi sesuai kewenangan. Berikan kata sandi sementara lewat saluran privat; pengguna wajib menggantinya saat login berikutnya. Jangan menaruh kata sandi di chat, argumen shell, README, atau Git.
- Bila tidak ada admin yang bisa masuk: pemilik sistem perlu memverifikasi identitas/kewenangan lalu melakukan pemulihan terkontrol. Belum ada command reset mandiri/OTP; `staff:create` **membuat akun baru**, bukan memulihkan kata sandi akun lama, dan username yang sudah ada ditolak. Jangan mengedit hash langsung, membuat admin pengganti sembarangan, atau menonaktifkan perlindungan akses.
- Akun yang benar-benar hilang setelah database diganti/dikosongkan memerlukan database asli atau backup. Jangan menjalankan `migrate:fresh`/`migrate:refresh`, menghapus SQLite, atau mengganti `APP_KEY` untuk memperbaiki login. `php artisan migrate` adalah perintah pembaruan struktur yang sesuai; tes hanya pada database uji terpisah.

## Integrasi frontend

Di `.env.local` pada direktori induk, isi `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1`. Jalankan frontend dengan `npm run dev` dari direktori induk dan buka http://127.0.0.1:3000. Gunakan dua terminal supaya Laravel dan Next.js berjalan bersamaan.

`FRONTEND_ORIGINS` di `.env` backend mengatur origin yang boleh memanggil API dari browser. Nilai lokal default adalah `http://localhost:3000,http://127.0.0.1:3000`. Untuk deployment, ganti dengan origin HTTPS frontend yang benar, lalu jalankan `php artisan config:clear` bila konfigurasi sudah di-cache. Tidak ada cookie lintas-origin pada integrasi ini.

## Endpoint API v1

Semua path pada tabel diawali `/api/v1`. Permintaan JSON memakai `Accept: application/json` dan `Content-Type: application/json`.

| Metode | Path | Akses | Kegunaan |
| --- | --- | --- | --- |
| POST | `/applications` | Publik, 5 permintaan/menit | Mengajukan layanan; mengembalikan `request_id`, `status`, `jenis_surat`, `requires_neighborhood_approval: boolean` dari `LetterType`, dan `lookup_secret` (HTTP 201) |
| POST | `/applications/status` | Publik, 10 permintaan/menit; 5 kode salah per nomor → 429 selama 15 menit | Body: `request_id` dan `lookup_secret`; mengembalikan `jenis_surat`, `requires_neighborhood_approval: boolean` dari `LetterType`, status, dan catatan (penolakan RT/RW historis tetap diberi awalan "Ditolak oleh Ketua RT/RW") |
| POST | `/staff/login` | Publik, 5 permintaan/menit | Body: `username` dan `password` (atau `email` untuk klien lama); mengembalikan bearer token |
| POST | `/staff/logout` | Token petugas | Mencabut token aktif |
| GET | `/staff/me` | Token petugas | Mengembalikan `{ name, username, role, rt, rw, must_change_password, features: { neighborhood_approval: boolean }, abilities: string[] }`; `username`, `rt`, `rw` bisa `null`. Peran di luar enam peran panel, akun nonaktif, ketua RT/RW tanpa wilayah lengkap, atau token RT/RW saat fitur mati mendapat 403 |
| GET | `/staff/users` | Admin | Daftar akun `{ id, name, username, role, rt, rw, is_active, must_change_password, last_login_at }` dan `warnings` wilayah tanpa ketua aktif (selalu `[]` saat fitur RT/RW mati) |
| POST | `/staff/users` | Admin | Body `name`, `username`, `role`, `password` (min. 10); `rt` wajib untuk `rt_head`, `rw` wajib untuk `rt_head`/`rw_head`. Akun baru aktif dan wajib ganti kata sandi |
| PATCH | `/staff/users/{id}` | Admin | Body `name`, `role`, `is_active`, `rt`, `rw`; menonaktifkan akun mencabut semua tokennya |
| POST | `/staff/users/{id}/reset-password` | Admin | Body `password` (min. 10); menandai wajib ganti kata sandi dan mencabut semua token akun itu |
| POST | `/staff/me/password` | Token petugas | Body `old_password` dan `password` (min. 10); token lain dicabut, token aktif tetap |
| GET | `/staff/letter-register` | Staff, admin, village_head aktif | Register nomor terbit/batal; filter `year`, `jenis_surat`, `page`; 20 per halaman |
| GET | `/staff/summary` | Lima peran pelayanan, `applications:manage` (bukan kim) | Hitungan per status, antrean tindakan peran, masuk hari ini, lima antrean tertua; scope sama dengan daftar |
| GET | `/staff/applications` | `applications:manage` (bukan kim) | Daftar paginasi 20 per halaman, dibatasi wilayah untuk ketua RT/RW; filter `status` atau `statuses[]`, `q`, `jenis_surat`, dan `sort` (kontrak di bawah) |
| POST | `/staff/applications/{request_id}/lookup-secret` | Staff, admin, rt_head, rw_head (10/menit) | Membuat ulang kode akses; hanya untuk status non-COMPLETED. Kode lama langsung tidak berlaku. Kode baru hanya ada di respons ini. |
| GET | `/staff/applications/{request_id}` | Lima peran pelayanan, `applications:manage` (bukan kim) | Detail data pemohon, `allowed_transitions`, dan `history`; ketua RT/RW hanya wilayahnya dengan field terbatas; setiap akses berhasil dicatat di `audit_logs` |
| PATCH | `/staff/applications/{request_id}/isi-keterangan` | Staff, admin (30/menit) | Body `isi_keterangan` (2–500); hanya UMUM sebelum `WAITING_APPROVAL`; riwayat `STATEMENT_EDITED`, audit `application.statement_edited` tanpa isi |
| PATCH | `/staff/applications/{request_id}/status` | `applications:manage` (bukan kim) | Body `status` dan `catatan` opsional; respons memuat `status`, `catatan`, dan `allowed_transitions` baru |
| GET | `/staff/applications/{request_id}/letter.pdf` | Staff, admin, village_head (30/menit) | Draf (PROCESSING/WAITING_APPROVAL) atau surat final (sejak APPROVED); diaudit |
| POST | `/staff/applications/{request_id}/letter.pdf` | Staff, admin (10/menit) | Multipart `file` PDF ≤ 5 MB; mengganti PDF otomatis dengan surat hasil pindaian |
| GET | `/staff/applications/{request_id}/letter-qr.png` | Staff, admin | Gambar QR verifikasi untuk ditempel pada surat manual |
| GET | `/verify/{kode}` | Publik, 30 permintaan/menit | Metadata surat tersamar untuk halaman verifikasi QR |
| GET | `/posts` | Publik, 60 permintaan/menit | Berita terbit, 10 per halaman, `Cache-Control: public, max-age=60` |
| GET | `/posts/{slug}` | Publik, 60 permintaan/menit | Detail berita terbit + `body`; draf/terhapus 404 |
| GET | `/staff/posts` | Admin, staff, kim (`media:manage`) | Daftar berita semua status kecuali terhapus; filter `status`, `q` (judul), `page`; 20 per halaman |
| POST | `/staff/posts` | Admin, staff, kim (`media:manage`) | Body `title`, `category`, `summary`, `body`, `status`; 201 |
| GET | `/staff/posts/{id}` | Admin, staff, kim (`media:manage`) | Detail berita termasuk draf |
| PATCH | `/staff/posts/{id}` | Admin, staff, kim (`media:manage`) | Ubah sebagian field yang sama |
| DELETE | `/staff/posts/{id}` | Admin, staff, kim (`media:manage`) | Soft delete (baris dan sampul tetap ada, pemulihan lewat database) |
| POST/DELETE | `/staff/posts/{id}/cover` | Admin, staff, kim (`media:manage`), berbagi 10/menit per akun | Multipart `file` / hapus sampul; 200 detail berita terbaru |
| GET/POST | `/staff/businesses` | Admin, staff, kim (`media:manage`) | Daftar / buat UMKM |
| GET/PATCH/DELETE | `/staff/businesses/{id}` | Admin, staff, kim (`media:manage`) | Detail termasuk field pemilik, ubah, soft delete |
| POST/DELETE | `/staff/businesses/{id}/photo` | Admin, staff, kim (`media:manage`), 10/menit | Unggah / hapus foto UMKM |
| GET/PUT | `/staff/site/{key}` | Admin, staff (`site:manage`), bukan kim | Baca / ganti konten situs |
| POST | `/staff/site/{key}/image` | Admin, staff (`site:manage`), 10/menit | Gambar struktur |
| POST | `/staff/site/{key}/document` | Admin, staff (`site:manage`), 10/menit | Dokumen transparansi |

Field formulir mengikuti [tipe frontend](../types/pelayanan.ts). Validasi yang gagal mengembalikan HTTP 422 dengan objek `errors` berisi pesan bahasa Indonesia.

### Jenis surat final (S1, 8 November 2026)

- `App\Domain\LetterType`: delapan case. Enam ditawarkan (`DOMISILI`, `SKTM`, `BELUM_MENIKAH`, `KERAMAIAN`, `KEHILANGAN`, `UMUM`); `SKU` dan `KTP_KK` tetap ada untuk data lama, tetapi `isOffered()` false sehingga POST baru → 422. `title()` satu-satunya sumber judul resmi surat; `specificFields()` isian khusus per jenis; `requiresFullPersonalData()` false hanya untuk KERAMAIAN.
- `App\Domain\LetterSubmission`: aturan validasi, pilihan baku (`DUSUN`, `AGAMA`, `KEWARGANEGARAAN`, `STATUS_PERKAWINAN`, `PENDIDIKAN`), pesan galat, dan nama atribut. `ApplicationController::store()` hanya memanggil `LetterSubmission::validate()`. Isian milik jenis lain memakai aturan `prohibited` (ditolak, bukan diabaikan). `kewarganegaraan` kosong → `WNI`. Tanggal keramaian: mulai ≥ hari ini, selesai ≥ mulai, rentang ≤ 7 hari termasuk kedua ujung.
- Migration `2026_11_08_000000_add_final_letter_fields_to_applications`: kolom nullable `dusun`, `agama` (text, encrypted), `kewarganegaraan`, `status_perkawinan` (text, encrypted), `pendidikan`, `pekerjaan`, `barang_hilang`, `acara`, `tempat_acara`, `tanggal_mulai`, `tanggal_selesai` (date), `jenis_hiburan`, `isi_keterangan`, `isi_keterangan_awal` (teks asli warga sebagai pembanding sunting petugas). Kolom usaha SKU tidak dihapus. `down()` menghapus keempat belas kolom.
- `ApplicationStatus::canEditContent()` menentukan kapan isi surat boleh disunting kantor (`SUBMITTED`, `RT_APPROVED`, `RW_APPROVED`, `VERIFIED`, `PROCESSING`, `NEED_REVISION`; peran staff/admin). Detail mengirim `can_edit_isi_keterangan`.
- PDF S2: `Letter::view()` memakai `letters/{jenis}.blade.php` untuk delapan jenis. Enam jenis final mengikuti contoh resmi desa; SKU/KTP_KK tetap bisa dirender dengan kolom baru kosong. Judul final dari `LetterType::title()`.
- Kontrak lengkap dan tabel jenis: [docs/integrasi.md § Enam jenis surat final](../docs/integrasi.md#enam-jenis-surat-final-s1-8-november-2026). Tes: `tests/Feature/LetterTypesTest.php`, payload fiktif bersama di `tests/LetterPayloads.php`.

### Berita

Frontend publik C4 (2 November 2026) membaca `/posts` dan `/posts/{slug}` langsung di browser lewat `services/posts.ts` (Zod, timeout 20 detik, no-store), tanpa perubahan kontrak API. Daftar `/berita/`, tiga berita beranda, dan detail `/berita/baca/?slug=...` tidak perlu build ulang setelah penerbitan/penghapusan; halaman yang sudah terbuka perlu dimuat ulang (tanpa polling). Draf tetap disaring server. Mode tanpa API memakai contoh sesuai flag F11, bukan fallback saat API gagal. Hosting frontend harus menyajikan `out/404.html` untuk redirect browser tautan lama `/berita/<slug>` yang tidak diekspor; detail baru memakai route query tetap. Lihat [integrasi C4](../docs/integrasi.md#berita-cms-c1c2).

Kontrak lengkap di [docs/integrasi.md § Berita](../docs/integrasi.md). Hak kelola satu tempat: `User::canManageMedia()` (`admin`/`staff`/`kim` aktif) + ability `media:manage`, termasuk sampul; peran lain 403, tanpa token 401. Kategori di `App\Domain\PostCategory`. Isi teks biasa, HTML disimpan apa adanya dan tidak pernah dirender server. Slug tetap setelah terbit pertama. Audit `post.*` hanya aksi dan ID, tanpa judul/isi. `cover_url` berisi URL publik sampul atau `null`; `cover_path` tidak dikirim.

**Foto sampul (C2):** POST `/staff/posts/{id}/cover` memakai multipart field `file`; DELETE pada path yang sama menghapus sampul. Keduanya berbagi throttle 10/menit per akun, hak kelola sama dengan C1, respons 200 berupa detail berita terbaru (`cover_url` null setelah hapus), `Cache-Control: private, no-store`. Validasi 422: JPG/JPEG/PNG/WebP ≤ 3.072 KiB, lebar 600–6.000 px, tinggi 400–6.000 px; isi rusak ditolak. Klien FormData tidak menetapkan `Content-Type` sendiri agar boundary benar.

GD menggambar ulang piksel, memperkecil lebar maksimal 1.600 px tanpa memperbesar gambar kecil, mempertahankan rasio, membuang metadata EXIF/GPS. Output WebP kualitas 80 jika didukung; selain itu JPEG kualitas 82 (transparansi menjadi putih). Nama `posts/<uuid>.webp` atau `.jpg` di disk `public` (`storage/app/public/posts`). GD tidak tersedia → 503. Produksi memerlukan `php-gd` dengan JPEG/PNG/WebP; tes memberi pesan skip bila GD/WebP tidak tersedia.

Konfigurasi `MEDIA_URL` adalah **URL dasar absolut**, tanpa `/posts`: bawaan kosong/tidak diisi memakai `${APP_URL}/storage`; lokal jalankan `php artisan storage:link`. Untuk produksi isi `MEDIA_URL=https://[DOMAIN]/media`, sesuai `APP_URL`, lalu cache ulang konfigurasi. URL sampul menjadi `https://[DOMAIN]/media/posts/<uuid>.webp`. Nginx menyajikan hanya folder `storage/app/public/posts` di `/media/posts/`, bukan seluruh storage; lihat `docs/deploy-plan.md`.

File baru disimpan sebelum transaksi penggantian dan audit `post.updated`; bila transaksi gagal, file baru dibersihkan dan sampul lama tetap. Baris dikunci saat penggantian; file lama dihapus setelah commit. Gagal hapus file lama → 500 dengan pesan bahwa sampul sudah diperbarui; perlu pembersihan administrator. Soft delete berita **tidak** menghapus file agar bisa dipulihkan. File sampul bersifat publik, termasuk sampul draf/berita terhapus bila URL diketahui; jangan unggah dokumen pribadi. Pembersihan berkala file sisa belum dibuat dan tidak termasuk retensi permohonan F10. Backup harus mencakup folder media.

### UMKM warga

`BusinessController` mengikuti pola berita: publik `GET /v1/businesses?category=&sort=&page=` (12 per halaman, `sort=name` bawaan atau `latest` untuk beranda) dan `GET /v1/businesses/{slug}` hanya untuk yang terbit; petugas `GET/POST /v1/staff/businesses`, `GET/PATCH/DELETE /v1/staff/businesses/{id}`, `POST/DELETE /v1/staff/businesses/{id}/photo` (`User::canManageMedia()`, admin/staff/kim aktif + `media:manage`, throttle foto 10/menit). Kategori di `App\Domain\BusinessCategory`, dusun di `Business::HAMLETS`. `owner_name` dan `whatsapp` cast `encrypted`, dikirim ke publik **hanya** bila `consent_public_contact` true dan tidak pernah di daftar petugas. Foto memakai `ImageProcessor` (3 MB, lebar 1.600 px) di `storage/app/public/businesses`. Audit `business.*` hanya aksi dan ID. Kontrak lengkap: [docs/integrasi.md § UMKM warga](../docs/integrasi.md). Tes: `tests/Feature/BusinessesApiTest.php`.

### Bagian situs — API konten R3 (3 November 2026)

Satu tabel `site_sections` (`key` primary unik, `data` JSON, `updated_by` nullable FK users/nullOnDelete, timestamps). Enum `App\Domain\SiteSection` membatasi `profile`, `contact`, `history`, `statistics`, `transparency`, `structure`, `videos`. Visi-misi **tidak** masuk CMS: tetap statis di `lib/data.ts` sampai pergantian Kepala Desa. Sejak R4 (4 November 2026) `profile` menerima `profileDetails` opsional; batas per field ada di [kontrak integrasi](../docs/integrasi.md#bagian-situs-backend-r3-3-november-2026).

- Publik `GET /api/v1/site/{key}`: 60/menit per IP, 200 `{ key, data, updated_at }`, `Cache-Control: public, max-age=60`; key belum diisi/tidak dikenal 404. Tidak mengirim ID pengguna atau field internal.
- Petugas `GET`/`PUT /api/v1/staff/site/{key}`: `User::canManageContent()` (staff/admin aktif), ability `site:manage`; KIM ditolak; 401 tanpa token, 403 peran/ability/akun salah sebelum key diperiksa, 404 key tak dikenal/belum diisi saat GET. PUT `{ data: {...} }` membuat atau mengganti **seluruh** objek, 200 format sama; tanpa merge/draf/versi. Semua respons petugas termasuk gagal `private, no-store`. CORS mengizinkan PUT dan DELETE (6 November 2026) hanya untuk `FRONTEND_ORIGINS`; preflight tidak menggantikan otorisasi.
- Petugas `POST /api/v1/staff/site/{key}/image`: multipart `file`, 10/menit per akun. Hanya structure diizinkan sejak R7; sukses `{ path, url }`. Key lain tetap 422 `errors.file` tanpa menyimpan file. Kontrak R7 di bawah.
- `SiteSectionRules` satu sumber validasi: `profile`/`history` memakai `intro` (1–2.000 karakter) dan `blocks` (list 1–20), tiap baris `title` (1–160), `text` (1–10.000). Hanya `profile` boleh menambah `profileDetails` opsional: `themes` (0–6 × 1–160), `stats` (0–6 `{value,label,detail?}`, 160/160/1.000), `location` (1–1.000), `boundaries` tepat 4 berurutan Utara/Timur/Selatan/Barat dengan `place` 1–1.000, `institutions` (0–20, `name` 1–160, `description` 1–2.000), `source` (1–1.000); semua wajib kecuali `detail`. `contact` tepat enam field dari objek `contact` frontend: `address` (1–1.000), `hours` (1–200), `contactName` (1–160), `phone` (maks.15), `mapsEmbedUrl`/`mapsLinkUrl` (maks.2.048). Tiga field terakhir wajib hadir tetapi boleh string kosong atau `[PLACEHOLDER]`. Nomor wajib `62` + 1–13 digit; URL wajib valid dan awalan Google sesuai [kontrak integrasi](../docs/integrasi.md#bagian-situs-backend-r3-3-november-2026).
- `statistics` menolak **semua** payload PUT (422 `errors.data`), termasuk kosong, sampai skema R5 tersedia. `videos` (R8) menerima `{ profile: { url, title } | null, tutorial: { url, title } | null }`, lalu `SiteSectionRules::youtubeId()` mengekstrak ID 11 karakter dari youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/; yang disimpan/dikirim hanya `{ youtubeId, title }`. URL lain 422 `data.<slot>.url`. Tanpa nilai awal impor. Unknown fields ditolak di tiap tingkat. Semua teks trim; kontrol diperiksa sebelum trim. Pengecualian disetujui: CR/LF hanya di `blocks.*.text` dan `programs.*.text`; tab/NUL/DEL tetap ditolak. HTML teks biasa, renderer React wajib aman, bukan HTML mentah.
- PUT dan audit `site.updated` (`subject_type=site_section`, `subject_id=key`) satu transaksi; gagal audit membatalkan data. Audit tidak berisi konten. Native upsert menangani perebutan baris pertama; edit terakhir menang. Migration mengubah `audit_logs.subject_id` dari integer ke string 64; ID lama menjadi string. Rollback menjatuhkan tabel situs saja, mempertahankan tipe string dan audit historis agar key tidak hilang.

```powershell
php artisan migrate
php artisan site:import-defaults
php artisan test --filter=SiteSectionsApiTest
```

Command opt-in mengisi hanya key `profile`, `contact`, `history`, `transparency`, `structure` yang **belum ada**. R7 structure menyalin blocks dan source dari `pages["struktur-pemerintahan"]`, tanpa gambar awal. R6 transparency menyalin `pages.transparansi.intro`/`blocks` menjadi `intro`/`programs`, dengan `budgets: []`. `SiteSectionDefaults` menulis ulang snapshot `lib/data.ts` pada `bb6861e`, sumber dicatat; tidak membaca TypeScript saat runtime. Baris lama, termasuk data kosong, tidak ditimpa; aman diulang. Seluruh impor + audit sistem `user_id=null` satu transaksi; output hanya jumlah. Tidak dipanggil otomatis oleh migration/DatabaseSeeder. Belum dijalankan pada database pengembangan lewat sesi ini; pengujian hanya database tes. Kontak adalah **kontak kantor publik berizin**, bukan telepon/alamat warga. Data warga tetap terenkripsi di modul pelayanan; jangan simpan NIK/KK/dokumen privat di situs publik.

**R4 (4–5 November 2026):** frontend membaca `profile`, `history`, dan `contact` dan menyediakan panel `/admin/konten/`. Aturan `contact` tidak berubah sejak R3; tes regresi panel kontak (trim, terbit ke GET publik, key lain tidak tersentuh) ditambah di `SiteSectionsApiTest`. Galat 422 tetap memakai key `data.<field>`.

**R6 (5 November 2026):** `transparency` menerima `{ intro, programs, budgets }`; `intro` 1–2.000, `programs` 1–20 blok `{title 1–160, text 1–10.000}`, `budgets` 0–5 tahun unik (integer JSON 2000–2099). Per tahun: `status` Rancangan/Ditetapkan/Perubahan; `revenue` 1–20, `spending` tepat 5 bidang/urutan tetap (`SiteSectionRules::SPENDING_FIELDS`), `financing` opsional 0–10; baris `{ label 1–160, amount }` rupiah integer JSON 0–100.000.000.000. `source` wajib 1–1.000; `documentPath` opsional `site/documents/<uuid>.pdf` yang sudah ada di disk public. Field total ditolak; rincian saja disimpan. Total frontend memakai satu `budgetTotals()` (pendapatan − belanja, pembiayaan terpisah).

- `POST /api/v1/staff/site/transparency/document`: multipart `file`, PDF magic `%PDF-`, ≤10.240 KiB (10 MiB), UUID `.pdf`, disk public folder `site/documents/`; sukses `{ path, url }`. `allowsDocuments()` hanya untuk transparency; key lain 422 `errors.file`. Rate limit 10/menit per akun; otorisasi/status/cache sama dengan endpoint staff situs. Tes mencakup sukses, 401, 403, 422 (bukan PDF/terlalu besar), batas tepat 10 MiB.
- GET publik/staff dan PUT transparency menambah envelope `document_urls: { [path]: url }` (di luar `data`), dari URL disk public; kosong menjadi `{}`. Key lain tidak berubah.
- PUT transparency diserialkan memakai `flock` pada `storage/framework/cache/site-transparency.lock`, dari validasi file sampai commit/cleanup; PUT bersamaan tidak dapat menerbitkan referensi file yang sedang dihapus. Lock satu host/VPS; multi-host harus memakai lock bersama. Setelah commit PUT, file lama yang tidak dirujuk lagi dihapus. Unggahan yang tidak pernah disimpan belum dibersihkan berkala. Sajikan folder ini dan ikutkan backup sesuai `docs/deploy-plan.md`; jangan unggah dokumen pribadi.
- Panel `/admin/konten/transparansi/`, publik `/transparansi/` membaca API browser tanpa build ulang; demo/404/galat tetap memakai `pages.transparansi`. Anggaran kosong menampilkan “APBDes resmi belum diunggah.” Detail batas/label ada di `docs/integrasi.md`.

**R7 (5 November 2026):** `structure` menerima `{ chartImagePath?, chartAlt?, blocks, source }`; blocks list 1–20 `{title 1–160, text 1–10.000}`, source 1–1.000. Deskripsi chartAlt maks.300, wajib bila ada gambar. Unknown fields/kontrol ditolak; CR/LF hanya teks blok. Path harus `site/structure/<uuid>.webp` atau `.jpg` yang ada di disk public, bukan URL/null/string kosong.

- POST `/api/v1/staff/site/structure/image`: staff/admin aktif + ability `site:manage` (`User::canManageContent()`), JPG/PNG/WebP ≤5.120 KiB (5 MiB), dimensi 600×400–6.000×6.000. ImageProcessor encode ulang tanpa metadata, lebar ≤2.400px (rasio tetap, tanpa memperbesar); output WebP 80 atau JPEG 82. Sukses `{ path, url }`, belum diterbitkan sampai PUT. Key lain tetap tidak mengizinkan gambar; tanpa token401/peran salah403/validasi422/GD hilang503.
- GET/PUT structure menambah `image_url` publik atau null di luar data. PUT memakai lock per host dari validasi hingga commit dan cleanup; gambar lama dihapus setelah penggantian/penghapusan berhasil. Audit gagal mempertahankan gambar lama. Multi-host perlu lock bersama; unggahan belum tersimpan lewat PUT belum dibersihkan berkala.
- Panel `/admin/konten/struktur/`: pratinjau, unggah/ganti/hapus, deskripsi pembaca layar, blok nama/jabatan dan sumber. Publik `/struktur-pemerintahan/` mengambil API di browser tanpa build ulang, statis lib/data.ts tampil dulu dan menjadi fallback demo/404/galat. Gambar opsional dengan Perbesar gambar di tab baru; nama/jabatan tetap teks di bawah. Bukan HTML mentah.

Tipe baru `types/site.ts`, re-export `types/pelayanan.ts`; dokumentasi lengkap di `docs/integrasi.md`. Saat R3 tidak mengubah halaman publik/panel. Static export tetap. `ImageProcessor::store()` mengekstrak pipeline GD sampul tanpa mengubah batas/format/kualitas atau siklus file C2. Pemilik konten/hosting produksi K2/K4 belum diputuskan.

### Kontrak manajemen akun

- `GET /staff/users` hanya untuk `admin`; peran lain dan tamu mendapat 403/401. Tidak ada endpoint hapus akun: gunakan `is_active=false` agar riwayat status tetap merujuk ke akun itu.
- `warnings` berisi `{ role, rt, rw, pending }` untuk permohonan `SUBMITTED` di RT/RW tanpa `rt_head` aktif atau `RT_APPROVED` di RW tanpa `rw_head` aktif. Angka `pending` adalah jumlah permohonan yang tertahan.
- Saat fitur mati, buat akun RT/RW, tetapkan peran/wilayah RT/RW, atau aktifkan akun RT/RW → 422 dengan pesan jelas bahwa fitur nonaktif. Menonaktifkan akun RT/RW lama tetap boleh. Login RT/RW → 401 generik; token lama yang belum dicabut → 403 pada endpoint panel.
- `PATCH` mengikuti aturan: admin tidak bisa menonaktifkan/menurunkan dirinya sendiri; admin aktif terakhir tidak bisa dihapus; satu RT hanya satu `rt_head` aktif dan satu RW hanya satu `rw_head` aktif. Melanggar aturan → 422 dengan `errors`.
- Login akun nonaktif → 401 `Kredensial tidak valid.` (pesan sama dengan kata sandi salah). Login berhasil mengisi `last_login_at` dan mengembalikan `must_change_password`.
- `POST /staff/me/password` memverifikasi kata sandi lama, menyimpan kata sandi baru (min. 10), menghapus `must_change_password`, dan mencabut token lain. Token yang sedang dipakai tetap berlaku.
- Audit akun memakai `subject_type=user` dan `subject_id` = ID akun target. Tidak ada email, kata sandi, atau token di audit.

### Daftar pengajuan

`GET /api/v1/staff/applications` menerima parameter query berikut (semuanya opsional):

| Parameter | Validasi / perilaku |
| --- | --- |
| `q` | String maksimal 100 karakter; spasi luar dibuang, kosong berarti tanpa pencarian. Mencocokkan potongan literal `request_id` **atau** `nama`, bukan NIK/KK/telepon/alamat. `%`, `_`, dan `!` dianggap teks literal, bukan wildcard. Tidak peka huruf besar/kecil (`LOWER()` di kedua sisi, berlaku sama di SQLite dan PostgreSQL; untuk huruf ASCII) |
| `jenis_surat` | Salah satu dari delapan kode `LetterType` (enam jenis final + `SKU`/`KTP_KK` lama) |
| `sort` | `terbaru` (bawaan) atau `terlama`; urutan `created_at` kemudian ID internal, keduanya menurun atau menaik. ID hanya pemecah urutan waktu yang sama, tidak dikirim ke klien |
| `status` | Satu status dari alur di bawah; tidak boleh bersama `statuses` |
| `statuses[]` | Array tidak kosong, maksimal jumlah status yang tersedia, setiap status valid dan tidak duplikat; tidak boleh bersama `status` |
| `page` | Bilangan bulat ≥ 1; 20 item per halaman |
| `my_queue`, `today` | Boolean opsional (`0`/`1`); antrean tindakan peran dan/atau permohonan masuk hari ini; digabung AND |

Nama pencarian di parameter `q` adalah pengecualian URL yang disetujui pengguna (18 Oktober 2026). Jangan memasukkan NIK/KK/telepon/alamat ke pencarian. Query URL dapat tersimpan di riwayat browser/access log server; sebelum produksi, redaksi query pada log proxy/web server perlu dikonfigurasi. Audit aplikasi tidak merekam pencarian.

Filter digabung dengan AND; pasangan pencarian nomor/nama dikelompokkan dengan OR. Respons tetap objek paginator Laravel (`data`, `current_page`, `last_page`, `per_page`, `total`, metadata/tautan pagination). Setiap item `data` **hanya** berisi `request_id`, `nama`, `jenis_surat`, `status`, `created_at`, `allowed_transitions`. **Perubahan kontrak:** `catatan` tidak lagi dikirim dalam daftar karena teks bebas dapat memuat data pribadi; baca catatan melalui endpoint detail. NIK, KK, alamat, telepon, data usaha, keperluan, hash kode akses, dan ID internal tidak disertakan. Daftar tidak mencatat audit akses detail.

### Ringkasan dashboard

`GET /api/v1/staff/summary` memerlukan bearer token `applications:manage` dan akun panel aktif (`staff`, `village_head`, `admin`, `rt_head`, `rw_head`). Tanpa token 401; ability/peran/akun tidak berwenang 403. Respons sukses dan gagal memakai `Cache-Control: private, no-store`.

- `by_status`: objek seluruh nilai `ApplicationStatus` → jumlah integer, termasuk nol. Query agregat `GROUP BY status`, bukan memuat seluruh permohonan.
- `my_queue`: jumlah permohonan dengan transisi yang tersedia untuk peran tersebut menurut `ApplicationStatus::allowedFor()` **dan jenis suratnya**. Tidak ada tabel status duplikat di controller/frontend; `NEED_REVISION` ikut bila peran memiliki transisi.
- `today`: jumlah yang dibuat sejak 00.00 hari ini sampai sebelum 00.00 besok sesuai zona waktu aplikasi (`APP_TIMEZONE`, bawaan `Asia/Jakarta`), tanpa membatasi status.
- `oldest`: maksimal lima permohonan dalam `my_queue`, urut `created_at` lalu ID internal menaik; setiap item tepat sama dengan daftar (`request_id`, `nama`, `jenis_surat`, `status`, `created_at`, `allowed_transitions`). Tidak ada ID internal, catatan bebas, identitas sensitif, atau kode akses.
- Seluruh hitungan/antrean memakai `Application::forUser()` yang sama dengan daftar. Ketua RT/RW hanya wilayah dan jenis surat yang memerlukan persetujuan RT/RW; peran kantor melihat seluruh wilayah.
- Daftar menerima filter boolean opsional `my_queue` dan `today` (`0`/`1`, bawaan tidak aktif), digabung AND dengan filter lama. Filter dan summary memakai scope yang sama agar angka kartu cocok dengan total daftar. Input tidak valid mendapat 422. Frontend memakai `my_queue=1`, `today=1`, `status=WAITING_APPROVAL`, dan `status=READY_FOR_PICKUP`; kartu Siap diambil **tidak** menghitung APPROVED.
- Ringkasan dihitung saat diminta (bukan live/polling). Muat ulang untuk memperbarui; perubahan data atau pergantian hari di antara dua permintaan dapat mengubah total.

### Register dan nomor surat

`GET /api/v1/staff/letter-register` memerlukan token dengan ability `applications:manage` dan akun aktif berperan `staff`, `admin`, atau `village_head`. Tanpa token → 401; peran lain (termasuk RT/RW), akun nonaktif, atau ability salah → 403. Respons dan kegagalan GET memakai `Cache-Control: private, no-store`.

- Filter opsional: `year` bilangan bulat 1000–9999 (bawaan tahun saat ini), `jenis_surat` dari enum `LetterType` (delapan kode, termasuk kode lama), dan `page` bilangan bulat ≥ 1. Nilai kosong/tidak valid → 422. Filter digabung AND.
- Paginator Laravel, 20 item per halaman, urutan nomor urut menurun. Item `data` **hanya** `{ number, issued_at, jenis_surat, nama, status }`; `status` adalah `issued` atau `void`, bukan status pengajuan. `issued_at` ISO 8601 UTC. Register tetap memuat nomor batal; tidak mengirim alasan batal, catatan bebas, atau identitas sensitif.
- Nomor dialokasikan saat `PROCESSING → WAITING_APPROVAL`, dalam transaksi yang sama dengan perubahan status dan `application_events`. `WAITING_APPROVAL → REJECTED/NEED_REVISION` membatalkan nomor (`void`) dan menyimpan catatan wajib sebagai `void_reason`. Setelah perbaikan dan diajukan lagi, nomor baru dialokasikan; nomor batal tidak dipakai ulang.
- Tabel `letter_numbers`: `id`, `application_id`, `year`, `sequence`, `number` (unik), `status`, `void_reason` nullable, `issued_by`, `issued_at`. Pasangan `(year, sequence)` unik; foreign key restrict-on-delete menjaga riwayat aplikasi dan penerbit. `letter_number_counters` menyimpan urutan global per tahun, **bersama semua jenis surat**, mulai 1 dan berganti pada tahun penerbitan.
- SQLite mengambil write lock **sebelum** membaca ulang pengajuan/counter; database lain mengunci baris pengajuan dan counter dengan `FOR UPDATE`. Seluruh transaksi dicoba maksimal 3 kali untuk konflik konkurensi; kegagalan penerbitan atau event membatalkan seluruh perubahan, termasuk counter.
- `config/letters.php` mengatur format `{kode_klasifikasi}/{urut}/{kode_desa}/{tahun}`, contoh `470/12/424.314.2.02/2026` (contoh surat desa, tanpa bulan romawi). `urut` angka tanpa padding, tahun dari waktu penerbitan server sesuai `config/app.php` (env `APP_TIMEZONE`, bawaan `Asia/Jakarta`); urutan tahunan reset pukul 00.00 WIB tanggal 1 Januari. Serialisasi tanggal API tetap ISO 8601 UTC. `kode_desa` = `424.314.2.02`; `kode_klasifikasi` = `470` untuk semua jenis, termasuk SKU/KTP_KK lama (bersumber dari `LetterType::classificationCode()`). Nomor tersimpan tidak berubah bila konfigurasi kemudian diubah; nomor yang sudah terbit dengan format lama tetap seperti adanya.
- Detail pengajuan menambah `letter_numbers: [{ number, status, void_reason, issued_at }]` hanya untuk tiga peran kantor, berurutan kronologis berdasarkan ID. RT/RW tidak menerima field ini. Pengajuan tanpa nomor menerima array kosong.
- Cek status publik menambah `letter_number: string | null`: hanya nomor `issued` saat `APPROVED`, `READY_FOR_PICKUP`, atau `COMPLETED`. Status lain, nomor batal, dan pengajuan lama tanpa nomor menghasilkan `null`; riwayat nomor tidak dikirim ke publik.
- Jalankan `php artisan migrate` untuk migration `2026_10_23_000000_create_letter_numbers`. **Tidak ada backfill** untuk pengajuan lama yang sudah menunggu persetujuan/disetujui; alur lama tetap dapat dilanjutkan tanpa nomor. Modul register tidak membuat PDF sendiri; penerbitan PDF tersedia melalui modul di bawah. TTE tersertifikasi, stempel digital, dan notifikasi belum tersedia.

### Surat PDF dan verifikasi QR

Dependensi: `barryvdh/laravel-dompdf` (PDF dari Blade) dan `bacon/bacon-qr-code` (QR PNG lewat ekstensi GD). Jalankan `php artisan migrate` untuk `2026_10_24_000000_create_letters`. Atur `LETTER_VERIFY_URL` di `.env` ke URL frontend `/verifikasi/` yang dapat dijangkau pemindai; localhost komputer tidak dapat diakses langsung dari ponsel lain.

- Template resmi S2 di `resources/views/letters/`: kop berlogo Kabupaten Pasuruan (JPG sumber pengguna di `resources/letters/`, data URI), garis ganda, judul/nomor, identitas 1–11, keterangan per jenis, tanda tangan dan QR di bawah area tanda tangan. BELUM_MENIKAH/KEHILANGAN juga memuat tanda tangan pemohon. KERAMAIAN memakai identitas a–g tanpa NIK/KK serta tanggal acara Indonesia (satu hari atau rentang, termasuk lintas bulan/tahun). UMUM mencetak `isi_keterangan` hasil suntingan petugas, bukan `isi_keterangan_awal`. SKU/KTP_KK lama tetap tersedia. Footer sementara dihapus.
- Identitas kop/nama Kepala Desa dari `config/letters.php` `desa`; alamat bawaan sesuai `docs/PROMPTS-SURAT.md`. **Env lokal yang sudah berisi `LETTER_ALAMAT_KANTOR` tetap mengalahkan nilai bawaan**: sesuaikan manual ke alamat kop di `.env.example` bila masih memakai alamat lama, lalu bangun ulang cache konfigurasi bila digunakan. Sesi S2 tidak mengubah `.env` atau PDF final tersimpan/unggahan lama.
- Tes teks PDF memerlukan **Python + pypdf yang tersedia pada mesin pengujian**, bukan dependensi runtime/npm/Composer baru. `PYTHON_BINARY` opsional memilih executable Python. Helper `tests/pdf_text.py` membaca PDF asli lewat stdin; pemeriksaan judul/nomor/keterangan, identitas, redaksi, rentang tanggal, escaping, serta satu halaman A4 ada di `LetterPdfTest`. Ketiadaan alat ekstraksi membuat tes gagal, bukan dilewati diam-diam.
- Contoh fiktif dari fixture tes, tanpa menulis ke repo atau database pengembangan (PowerShell, direktori tujuan wajib sudah ada dan di luar repo):

  ```powershell
  $env:LETTER_SAMPLE_DIR = Join-Path $env:LOCALAPPDATA 'Temp\opencode\letters-final-templates'
  New-Item -ItemType Directory -Force $env:LETTER_SAMPLE_DIR | Out-Null
  try { php artisan test --filter=test_official_pdf_text_and_one_a4_page } finally { Remove-Item Env:LETTER_SAMPLE_DIR }
  ```

  Menghasilkan `DOMISILI.pdf`, `SKTM.pdf`, `BELUM_MENIKAH.pdf`, `KERAMAIAN.pdf`, `KEHILANGAN.pdf`, `UMUM.pdf`. Nama pemohon dan Kepala Desa contoh fiktif. QR memakai kode acak database tes yang dihapus sesudah tes, **bukan verifikasi surat operasional**. Isi normal teruji satu A4; teks panjang tetap mengalir ke halaman berikutnya, tidak dipotong.
- **Draf:** `GET …/letter.pdf` saat `PROCESSING`/`WAITING_APPROVAL` membuat PDF bertanda **DRAF** tanpa QR, tidak disimpan. Audit `letter.draft_viewed`.
- **Persetujuan:** `WAITING_APPROVAL → APPROVED` oleh Kepala Desa menyisipkan baris `letters` (`approved_by`, `approved_at`, `verification_code` 32 karakter acak, unik) dalam transaksi yang sama. Setelah commit PDF final dibuat dari template dengan QR `LETTER_VERIFY_URL?kode=<kode>`; bila gagal, persetujuan tetap tersimpan dan PDF dibuat saat unduhan pertama.
- **Final:** sejak `APPROVED` (juga `READY_FOR_PICKUP`, `COMPLETED`). Berkas disimpan di disk privat `local` (`storage/app/private/letters/`), **dienkripsi dengan APP_KEY** karena memuat NIK/alamat; `sha256` adalah hash PDF asli. Setiap unduhan → audit `letter.downloaded`. Status lain → 404.
- **Unggah manual:** staff/admin, saat `APPROVED`/`READY_FOR_PICKUP`. Field `file`, ≤ 5 MB, isi wajib diawali `%PDF-`. Menggantikan PDF otomatis (file lama dihapus), kode QR tidak berubah, `source=uploaded`, `uploaded_by`, audit `letter.uploaded`. Status lain → 422.
- **QR:** `GET …/letter-qr.png` (staff/admin) untuk ditempel pada surat yang disusun manual.
- Peran lain (RT/RW) → 403; tanpa token → 401; nomor tidak valid → 422.
- Detail kantor menambah `letter: { approved_at, source, sha256, file_updated_at, file_purged_at } | null`; kode verifikasi dan path tidak dikirim. RT/RW tidak menerima field ini. `file_purged_at` terisi bila PDF dihapus oleh retensi; `GET …/letter.pdf` lalu → **410** tanpa membuat ulang PDF dari data anonim.
- **Verifikasi publik** `GET /verify/{kode}`: hanya `{ number, jenis_surat, issued_at, nama, status }`. `nama` disamarkan (`Siti Wulandari` → `S*** W********`); `status` `valid`, atau `revoked` bila nomor surat terakhir dibatalkan. Tanpa NIK, KK, alamat, telepon, isi surat, atau nomor pengajuan. Kode tidak ditemukan/format salah → 404. `Cache-Control: no-store`.
- QR **bukan** Tanda Tangan Elektronik tersertifikasi (lihat `PRODUCT.md`). Mengganti `APP_KEY` membuat PDF tersimpan tidak terbaca.

### Detail pengajuan dan audit akses

`GET /api/v1/staff/applications/{request_id}` memerlukan bearer token Sanctum dengan ability `applications:manage` **dan** peran panel aktif. Lima peran pelayanan (staff/admin/village_head serta RT/RW saat fitur aktif) boleh melihat detail; KIM ditolak. Wewenang perubahan status tetap mengikuti tabel di bawah.

**Batas wilayah ketua RT/RW** (`Application::forUser()` dan `isInTerritory()`): keduanya hanya melihat jenis surat dengan `requiresNeighborhoodApproval` (bukan SKU); `rt_head` hanya pengajuan dengan `rt` **dan** `rw` sama dengan akunnya; `rw_head` hanya pengajuan dengan `rw` sama. Daftar otomatis disaring; detail di luar wilayah → **404** (tidak membocorkan keberadaan); PATCH status di luar wilayah → **403**. Kode wilayah dibandingkan setelah dinormalkan ke 3 digit.

**Detail untuk ketua RT/RW:** `nik` dan `no_kk` dikirim utuh untuk verifikasi; `telepon`, `tempat_lahir`, `tanggal_lahir`, `jenis_kelamin`, `agama`, `status_perkawinan`, `kewarganegaraan`, `pendidikan`, dan `pekerjaan` tidak dikirim sama sekali. Audit akses sama dengan peran lain. Otorisasi dilakukan sebelum data pengajuan dimuat/dekripsi, tanpa implicit model binding pada endpoint detail.

- Format nomor: `REQ-` + empat digit tahun + `-` + satu atau lebih huruf kapital/angka, maksimal 64 karakter (`/^REQ-\d{4}-[A-Z0-9]+$/`). Format ini menerima ULID server dan nomor pendek fixture. Nomor tidak sesuai format → **422** dengan `errors.request_id`; nomor valid tetapi tidak ditemukan → **404**.
- Tanpa token/token tidak valid → **401**; peran atau ability salah → **403**, termasuk sebelum memvalidasi/mencari nomor.
- Respons sukses **200** berupa objek detail langsung (tanpa pembungkus `data`/`success`), dengan field eksplisit:
  - `request_id`, `jenis_surat`, `nama`, `nik`, `no_kk`, `alamat`, `rt`, `rw`, serta `tempat_lahir`, `tanggal_lahir` (`YYYY-MM-DD`), `jenis_kelamin`, `telepon` (empat terakhir tidak ada untuk ketua RT/RW);
  - `agama`, `status_perkawinan` (didekripsi), `kewarganegaraan`, `pendidikan`, `pekerjaan` (tidak ada untuk ketua RT/RW; `null` pada data lama);
  - `dusun`, `barang_hilang`, `acara`, `tempat_acara`, `tanggal_mulai`, `tanggal_selesai` (`YYYY-MM-DD`), `jenis_hiburan`, `isi_keterangan`, `isi_keterangan_awal` (masing-masing dapat `null`), `can_edit_isi_keterangan` (boolean);
  - `nama_usaha`, `jenis_usaha`, `alamat_usaha` (masing-masing dapat `null`), `keperluan`, `status`, `catatan` (dapat `null`);
  - `created_at`, `updated_at` (ISO 8601 UTC), `allowed_transitions` (array status untuk peran aktif), `history` (array, dapat kosong).
- Setiap item `history` **hanya** berisi `action` (null = perubahan status, `ACCESS_CODE_RESET`, `STATEMENT_EDITED`), `from_status` (nullable), `to_status`, `note` (nullable), `staff_name` (nullable untuk pengajuan awal/pengguna yang sudah dihapus), `created_at` (ISO 8601 UTC). Urutan kronologis menaik berdasarkan waktu lalu ID event. ID event, ID pengguna, email, serta metadata internal tidak dikirim.
- Data terenkripsi dibuka hanya untuk respons detail berotorisasi; encrypted casts dan field tersembunyi model tetap dipertahankan. Hash/kode akses tidak pernah dikirim melalui endpoint ini.
- Respons daftar/detail (termasuk kegagalan validasi/otorisasi) memakai `Cache-Control: private, no-store`. Frontend tidak boleh menyimpan detail ke localStorage/sessionStorage atau memasukkan identitas sensitif ke URL.
- Jalankan `php artisan migrate` sebelum memakai detail untuk membuat tabel `audit_logs`. Tabel hanya memuat primary key `id`, `user_id`, `action`, `subject_type`, `subject_id`, `created_at`; tanpa payload, IP, user agent, nomor pengajuan, atau identitas warga. Setiap detail berhasil mencatat `action=application.viewed`, `subject_type=application`, `subject_id` = ID internal pengajuan, dan pengguna aktif **sebelum** respons dikirim. Audit gagal → detail tidak diberikan. Akses 401/403/404/422 dan daftar tidak membuat audit. Audit menggunakan foreign key pengguna dengan restrict-on-delete agar riwayat tidak hilang; penghapusan akun perlu kebijakan terpisah.

### Alur status dan wewenang

Kebutuhan RT/RW dipusatkan di `app/Domain/LetterType.php::requiresNeighborhoodApproval()`, dikendalikan **hanya** `letters.neighborhood_approval` backend. Frontend memakai `requires_neighborhood_approval` dari respons publik di `lib/letter-workflow.ts`, bukan cerminan tabel jenis surat.

- Bawaan false, **semua jenis** (SKU, DOMISILI, SKTM, KTP_KK): `SUBMITTED` → `VERIFIED` → `PROCESSING` → `WAITING_APPROVAL` → `APPROVED` → `READY_FOR_PICKUP` → `COMPLETED`.
- Hanya saat true, DOMISILI/SKTM/KTP_KK: `SUBMITTED` → `RT_APPROVED` → `RW_APPROVED` → `VERIFIED` → lanjutan sama. SKU selalu langsung ke kantor.

Aturan dipusatkan di `app/Domain/ApplicationStatus.php` yang menggunakan `LetterType`; controller tidak menyimpan salinan tabel ini. Akses RT/RW ke seluruh endpoint panel ditolak saat fitur mati.

**DOMISILI, SKTM, KTP_KK — hanya saat fitur aktif:**

| Dari | Ke | Peran |
| --- | --- | --- |
| `SUBMITTED` | `RT_APPROVED`, `REJECTED` | **hanya** rt_head (wilayahnya) |
| `RT_APPROVED` | `RW_APPROVED`, `REJECTED` | **hanya** rw_head (wilayahnya) |
| `RW_APPROVED` | `VERIFIED`, `NEED_REVISION`, `REJECTED` | staff, admin |

Baris berikutnya (`NEED_REVISION` dan seterusnya) sama dengan tabel umum.

**Bawaan semua jenis; saat fitur aktif, SKU dan lanjutan semua jenis:**

| Dari | Ke | Peran |
| --- | --- | --- |
| `SUBMITTED` (semua jenis saat off; hanya SKU saat on) | `VERIFIED`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `NEED_REVISION` | `VERIFIED`, `REJECTED` | staff, admin |
| `VERIFIED` | `PROCESSING`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `PROCESSING` | `WAITING_APPROVAL`, `NEED_REVISION`, `REJECTED` | staff, admin |
| `WAITING_APPROVAL` | `APPROVED`, `REJECTED`, `NEED_REVISION` | **hanya** village_head |
| `APPROVED` | `READY_FOR_PICKUP` | staff, admin |
| `READY_FOR_PICKUP` | `COMPLETED` | staff, admin |

- Perpindahan yang tidak ada di alur aktif (melompat, misalnya `SUBMITTED` → `RW_APPROVED`; DOMISILI `SUBMITTED` → `VERIFIED` hanya tidak valid saat fitur RT/RW aktif; mundur; atau dari `REJECTED`/`COMPLETED`) → **422** `Transisi status tidak valid.`
- Perpindahan yang ada di tabel tetapi bukan wewenang peran → **403** `Peran Anda tidak berwenang melakukan perubahan status ini.` Admin tidak dapat menyetujui. Pengajuan di luar wilayah ketua RT/RW → **403** `Akses ditolak.`
- `NEED_REVISION` dan `REJECTED` wajib memakai `catatan` (422 dengan `errors.catatan`).
- Status dibaca ulang dengan kunci baris di dalam transaksi, sehingga klien dengan data usang tidak bisa mengulang transisi. Setiap perubahan dicatat di `application_events` beserta `user_id`.
- Endpoint pelayanan memakai `applications:manage` untuk staff/admin/village_head serta RT/RW saat fitur aktif; KIM tidak mendapat ability ini. Semua peran panel yang boleh masuk mendapat `panel`; media memakai `media:manage` (admin/staff/kim), situs memakai `site:manage` (admin/staff). Peran diperiksa ulang pada setiap permintaan.

`APPROVED` mencatat persetujuan Kepala Desa dan membuat PDF final ber-QR (lihat bagian Surat PDF); `READY_FOR_PICKUP` ditandai petugas setelah surat fisik siap. `RT_APPROVED`/`RW_APPROVED` hanya catatan persetujuan di sistem: tidak ada PDF pengantar, TTE, stempel digital, atau notifikasi.

Migration `2026_10_20_000000_add_neighborhood_territories` menambah kolom `rt`/`rw` nullable di `users` dan hanya menormalkan `rt`/`rw` pengajuan lama ke 3 digit. Status pengajuan lama tidak diubah: pengajuan DOMISILI/SKTM/KTP_KK yang sudah melewati `SUBMITTED` tetap berjalan tanpa diulang dari RT/RW.

## Penanganan data dan batas saat ini

- `lookup_secret` diberikan sekali setelah pengajuan dengan format `WAD-XXXX-XXXX` (8 angka acak, `App\Domain\AccessCode`). Input diterima tanpa tanda hubung, dengan spasi, atau huruf kecil. Hash memakai HMAC-SHA256 dengan `APP_KEY`, jadi **mengganti `APP_KEY` membatalkan semua kode akses**. Kode lama (48 karakter, SHA-256 polos) tetap berlaku.
- Cek status dikunci per nomor pengajuan setelah 5 kode salah selama 15 menit (HTTP 429), di samping batas 10 permintaan/menit per IP. Kode benar membuka kunci.
- **Buat ulang kode akses:** `POST /staff/applications/{request_id}/lookup-secret` oleh staff, admin, rt_head, rw_head (bukan village_head atau kim), dengan `applications:manage`; RT/RW hanya saat fitur aktif. Permohonan di luar wilayah RT/RW = 404. Status `COMPLETED` = 422. Kode lama langsung tidak berlaku. Kunci salah coba dibuka. Respons hanya berisi kode sekali; tidak ada di log. Entri riwayat dengan `action: ACCESS_CODE_RESET` dan catatan audit `application.access_code_reset`.
- NIK, nomor KK, telepon, alamat, tempat lahir, tanggal lahir (string `Y-m-d`), agama, dan status perkawinan disimpan terenkripsi memakai `APP_KEY`; kolomnya tidak dapat difilter/diurutkan di SQL. Migration `2026_10_25_000000_encrypt_application_birth_data` mengenkripsi baris lama, dan `down()` mendekripsinya kembali; keduanya butuh `APP_KEY` yang sama. Endpoint publik hanya mengembalikan metadata status; daftar petugas tidak menampilkan field sensitif itu.
- Token petugas berlaku `SANCTUM_EXPIRATION` menit sejak login (bawaan 480 menit = 8 jam kerja; atur di `.env`, lalu `php artisan config:clear` bila konfigurasi di-cache). Token kedaluwarsa atau dicabut menghasilkan 401.
- Frontend menyimpan token di `sessionStorage` tab dan memvalidasinya lewat `/staff/me`; menutup tab menghapus sesi. Jangan simpan token dalam URL atau localStorage.
- Token kedaluwarsa dihapus dari database oleh `sanctum:prune-expired --hours=24` yang dijadwalkan harian di `routes/console.php`. Scheduler harus dijalankan: di server tambahkan cron `* * * * * php artisan schedule:run`; secara lokal gunakan `php artisan schedule:work`. Cek jadwal dengan `php artisan schedule:list`.
- **Retensi (mati bawaan):** `config/retention.php` membaca `RETENTION_APPLICATION_DAYS` (kosong = mati; isi hanya setelah desa menetapkan masa simpan). `php artisan applications:purge --dry-run` menampilkan target tanpa mengubah apa pun; tanpa opsi, permohonan `COMPLETED`/`REJECTED` dengan `updated_at` lebih tua dari N hari dianonimkan dalam transaksi per permohonan:
  - `nama` → inisial (`Siti Wulandari` → `S. W.`); `nik`, `no_kk`, `telepon`, `alamat`, `tempat_lahir`, `tanggal_lahir`, `keperluan` → string kosong (terenkripsi); `alamat_usaha`, `catatan`, serta seluruh kolom surat final (`dusun`, `agama`, `kewarganegaraan`, `status_perkawinan`, `pendidikan`, `pekerjaan`, `barang_hilang`, `acara`, `tempat_acara`, `tanggal_mulai`, `tanggal_selesai`, `jenis_hiburan`, `isi_keterangan`, `isi_keterangan_awal`) → `null`; `purged_at` diisi. `updated_at` asli tidak berubah.
  - Tetap: `request_id`, `jenis_surat`, `status`, `rt`/`rw`, `jenis_kelamin`, data usaha selain alamat, tanggal, `letter_numbers`, `application_events`, `audit_logs`, serta baris `letters` (kode verifikasi, SHA-256).
  - PDF final dihapus dari disk privat setelah commit; `letters.path` → `null`, `letters.file_purged_at` diisi.
  - Satu audit `application.purged` per permohonan dengan `user_id = null` (aksi sistem; migration `2026_10_27_000000` membuat kolom ini nullable dan rollback sengaja membiarkannya nullable). Tanpa isi data.
  - Idempoten: permohonan yang sudah memiliki `purged_at` dilewati. Nilai bukan bilangan bulat ≥ 1 → keluar dengan error tanpa perubahan.
  - Dijadwalkan harian di `routes/console.php`; aman karena mati bawaan. Backup lama tetap berisi data sebelum anonimisasi sampai rotasinya habis.
- Belum ada unggah dokumen persyaratan, OTP, TTE, atau pengelolaan konten. Jangan menguji dengan data pribadi nyata.

## Sebelum produksi

Belum siap menerima data warga nyata. Putuskan hosting/database sesuai K2/K3 pada [roadmap](../ROADMAP.md), lalu siapkan HTTPS, `APP_DEBUG=false`, backup dan uji pemulihan, kebijakan privasi/retensi, scheduler, serta pengelolaan `APP_KEY` yang aman. Demo Vercel tidak menjalankan Laravel.

Atur `APP_URL`, `FRONTEND_ORIGINS`, dan `LETTER_VERIFY_URL` ke alamat lingkungan target; jalankan migration dan uji alur lengkap beserta pembatasan peran/wilayah. PDF dan bantuan buat ulang kode akses sudah diimplementasikan, tetapi template/nomor resmi, prosedur pemeriksaan identitas, uji browser Laravel, dan pemindaian QR masih perlu dituntaskan. Autentikasi saat ini memakai bearer token dan `sessionStorage`; perubahan ke cookie HttpOnly bukan fitur yang sudah tersedia atau keputusan arsitektur yang telah ditetapkan.

## Fondasi penduduk dummy

Tabel `residents` menyimpan NIK, nama, tempat lahir, dan tanggal lahir dengan encrypted casts. Identitas disembunyikan dari serialisasi JSON. `dummy_reference` adalah penanda fixture unik, bukan indeks NIK. Jangan mengganti APP_KEY setelah ada data terenkripsi.

Seeder hanya berjalan di local/testing, aman diulang, dan menolak menimpa record non-dummy. Tidak dipanggil otomatis oleh DatabaseSeeder. Jalankan dari folder backend:

```powershell
php artisan migrate --path=database/migrations/2026_09_29_160000_create_residents_table.php
php artisan db:seed --class=DummyResidentSeeder
php artisan test --filter=ResidentsFoundationTest
```

Tiga NIK fiktif: `0000000000000001`, `0000000000000002`, `0000000000000003`. Awalan wilayah sengaja tidak valid. Jangan masukkan data asli pada tahap ini.

Tidak ada endpoint pencarian penduduk atau integrasi autofill API. Keputusan 2 November 2026 menghapus impor/UI autofill dummy dari formulir publik; warga mengisi data sendiri dan kolom alamat RT/RW tetap ada. File `lib/dummy-residents.ts` dan tes fixture dipertahankan. Model `Resident`, tabel `residents`, dan migration tetap ada hanya sebagai fondasi seeder/tes, tanpa referensi route atau fitur produksi. Sebelum penggunaan data asli pada fondasi ini, siapkan verifikasi kepemilikan, otorisasi, audit akses, retensi, indeks pencarian aman, dan deduplikasi NIK. Kolom terenkripsi tidak dapat dicari langsung dengan query NIK. Jangan membuka lookup publik hanya berdasarkan NIK.
