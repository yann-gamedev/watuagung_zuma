# Migrasi panel `/admin` ke subdomain — rencana dan prompt sesi

> Disusun 21 November 2026 terhadap `main` @ `2e8e6c4`. Status: **rencana, menunggu keputusan § 3**. Belum ada perubahan kode atau hPanel.
>
> Pakai **Pembuka** dari `PROMPTS-FINALISASI.md` (dokumen Tech Lead, tidak ada di repo; dirujuk juga oleh `PROMPTS-REVISI-SURAT2.md`). Satu prompt = satu sesi = satu branch/PR. Langkah hPanel (§ 7) dikerjakan manusia.

## 1. Tujuan dan batas manfaat

Pindahkan panel petugas dari `https://desawatuagung.com/admin/` ke subdomain sendiri, misalnya `https://panel.desawatuagung.com/admin/`.

**Yang didapat:**
- **Origin terpisah.** Token login panel disimpan di `sessionStorage` (`features/admin/session.tsx`, kunci `watuagung-staff-token`), yang dibatasi per origin. Skrip yang berjalan di situs publik (bila suatu saat ada celah XSS di berita, UMKM, atau halaman lain) tidak bisa membaca token di origin panel.
- **Kebijakan keamanan khusus panel** tanpa mengganggu situs publik: CSP lebih ketat, `X-Robots-Tag: noindex`, opsi kata sandi tambahan (HTTP Basic Auth) atau pembatasan IP lewat `.htaccess` subdomain.

**Yang tidak berubah** (jangan diklaim sebagai manfaat):
- API tetap di `https://desawatuagung.com/api/v1`. Penyerang tetap bisa mencoba login langsung ke API; perlindungannya tetap throttle login, kata sandi, peran, dan Sanctum.
- Subdomain mudah ditemukan (log sertifikat SSL). Ini bukan penyembunyian.
- Shared hosting tetap satu user Linux untuk PHP dan kode (`deploy/hostinger.md` § K).
- Phishing, kata sandi lemah, dan perangkat petugas yang terinfeksi tidak tertolong.

**Urutan prioritas keamanan tetap:** CSP sungguhan (sekarang masih Report-Only dengan `script-src 'unsafe-inline'`) dan 2FA/kebijakan kata sandi berdampak lebih besar. Migrasi ini paling berguna bila digabung dengan Basic Auth atau CSP ketat di subdomain (§ 3 D3, D4).

## 2. Kondisi sekarang (diperiksa 21 November 2026)

| Hal | Kondisi |
|---|---|
| Paket | Hostinger **Premium Web Hosting** (shared, hPanel), aktif s.d. 12 November 2027, **tanpa perpanjangan otomatis**. Website `desawatuagung.com` (user `u892368764`), docroot `~/domains/desawatuagung.com/public_html`. Belum ada subdomain atau domain parkir. Premium mendukung subdomain; batas jumlah cek di hPanel. |
| Domain | `.com` dibeli di Hostinger; DNS dikelola Hostinger, sehingga record subdomain dibuat otomatis oleh hPanel. |
| Frontend | Satu static export Next.js (`output: "export"`, `trailingSlash: true`). Panel = rute `app/admin/**` (dashboard, `[section]`, akun, berita, konten/*, notifikasi, permohonan/detail, register, umkm). Layout panel sudah `robots: noindex`. |
| API | URL **absolut** dibekukan saat build (`NEXT_PUBLIC_API_URL=https://<domain>/api/v1`, `services/pelayanan.ts`), jadi build yang sama bisa disajikan dari subdomain tanpa ubah alamat API. |
| Autentikasi | Bearer token Sanctum di header, bukan cookie; mode stateful Sanctum tidak dipakai. Tidak ada urusan cookie lintas subdomain. |
| CORS | `backend/config/cors.php` membaca `FRONTEND_ORIGINS` (produksi `https://<domain>`). Panel di subdomain = permintaan lintas origin, wajib ditambahkan. |
| Media | URL media absolut (`MEDIA_URL`/`APP_URL`), jadi gambar tetap dimuat dari domain utama. |
| Email | `config('app.site_url')` (`SITE_URL`) untuk `/pelayanan/status/`, `/berhenti-email/`, `/persetujuan/` (E4), `/verifikasi-email/`. Tidak ada email berisi tautan `/admin`. |
| Tautan panel → publik (relatif) | `features/admin/shell.tsx:174` "Lihat website" (`/`), `features/admin/news-editor.tsx` "Lihat di website" (`/berita/baca/?slug=`), `features/admin/business-editor.tsx` (`/umkm/lihat/?slug=`). |
| Tautan publik → panel (relatif) | `features/approval/approval-page.tsx:215` "Masuk ke panel admin" (`/admin/`), `features/approval/verify-email.tsx:57` (`/admin/notifikasi/`). |
| Deploy | `deploy/hostinger-deploy.sh` + `deploy/hostinger/.htaccess` (HTTPS, blok file tersembunyi/PHP, `/api/` → `laravel.php`, header keamanan, CSP Report-Only). Satu arsip `out/` → satu `public_html` (`rsync --delete`). Smoke test `deploy/smoke-test.sh <domain>`. |
| Tes lokal | Skrip `scripts/test-*.mjs` memakai `${web}/admin/...` di localhost; tetap berlaku karena pengembangan lokal tidak berubah. |

## 3. Keputusan yang perlu disetujui Tech Lead

| # | Keputusan | Pilihan | Rekomendasi |
|---|---|---|---|
| D1 | Nama subdomain | `panel.`, `admin.`, `petugas.` | **`panel.desawatuagung.com`**: netral untuk semua peran (petugas, kades, KIM, RT/RW). Nama tidak menambah keamanan. |
| D2 | Bentuk build | (a) **satu build**, disajikan dua docroot dengan `.htaccess` berbeda; (b) build admin terpisah dengan rute di akar (`/permohonan/…`) | **(a)**. URL panel menjadi `https://panel.…/admin/…`, dan akar `/` dialihkan ke `/admin/`. Tanpa restrukturisasi rute, `basePath`, atau tes. (b) hanya kosmetik dengan risiko besar. |
| D3 | Lapisan akses tambahan di subdomain | tidak ada / **Basic Auth** (hPanel → Password Protect Directories) / batas IP | **Basic Auth** satu akun bersama per kantor, kata sandi di password manager desa. IP kantor kemungkinan dinamis; jangan andalkan batas IP. Konsekuensi: petugas mengetik dua kali (Basic Auth + login). Bisa ditunda ke tahap 2. |
| D4 | CSP subdomain | Report-Only dulu / langsung ditegakkan | **Report-Only 1 minggu**, lalu ditegakkan, sama dengan pola situs utama. |
| D5 | `/persetujuan/` dan `/verifikasi-email/` (dibuka dari email oleh kades/petugas) | tetap di domain utama / pindah ke subdomain | **Tetap di domain utama (tahap 1).** Tautan yang sudah terkirim (72 jam dan 24 jam) tetap hidup, tidak bentrok dengan Basic Auth di ponsel kades, dan tanpa perubahan backend. Hanya tombol "Masuk ke panel" yang diarahkan ke subdomain. Bisa dipindah di tahap 2 bila perlu. |
| D6 | Jenis redirect `/admin` di domain utama | 302 / 301 | **302 selama masa uji (≥ 1 minggu), lalu 301.** 301 di-cache browser dan menyulitkan rollback. |
| D7 | `/admin` di arsip domain utama | tetap ada / dihapus | **Dihapus dari arsip utama** (redirect menangani bookmark). Panel tidak lagi bisa dibuka di origin publik. |

## 4. Arsitektur target

```
Browser petugas
  └─ https://panel.desawatuagung.com/admin/...      (docroot ~/domains/desawatuagung.com/public_html/panel, lihat § 7)
       ├─ HTML/JS/CSS panel dari arsip yang sama (hanya /admin dan /_next yang disajikan)
       ├─ fetch → https://desawatuagung.com/api/v1/... (CORS: origin panel diizinkan)
       └─ gambar → https://desawatuagung.com/storage|media/...

Browser warga
  └─ https://desawatuagung.com/...                  (public_html utama, tanpa folder admin)
       ├─ /admin/*  → 302/301 ke https://panel.desawatuagung.com/admin/* (query ikut)
       ├─ /persetujuan/, /verifikasi-email/ tetap di sini (D5)
       └─ /api/* → laravel.php (tidak berubah)
```

Subdomain **tidak** menyajikan `/api/`, `laravel.php`, atau symlink `storage`. Semua path non-panel di subdomain dialihkan ke domain utama.

## 5. Perubahan kode

### 5.1 Frontend: URL lintas origin (sesi A1)

Env build baru, opsional. Bila kosong, tautan tetap relatif seperti sekarang (dev lokal, demo Vercel, dan tes tidak berubah):

| Env | Contoh produksi | Dipakai untuk |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://desawatuagung.com` | tautan panel → situs publik |
| `NEXT_PUBLIC_ADMIN_URL` | `https://panel.desawatuagung.com` | tautan situs publik → panel |

- `lib/urls.ts` (baru):
  - `siteHref(path)` dan `adminHref(path)`. Gabungkan origin dari env (tanpa slash akhir) dengan path yang **wajib** diawali `/`.
  - Validasi env `https:` di produksi. Nilai tak valid jatuh ke path relatif dan muncul `console.warn` saat build; jangan pakai origin mentah.
- `features/admin/shell.tsx`, `news-editor.tsx`, `business-editor.tsx`:
  - Tautan ke situs publik memakai `siteHref`.
  - Bila origin lain, pakai `<a>` (bukan `next/link`), `target="_blank"`, `rel="noopener noreferrer"`, dan keterangan pembaca layar "(dibuka di tab baru)" (pola yang sudah ada di editor berita).
- `features/approval/approval-page.tsx`, `features/approval/verify-email.tsx`: tombol ke panel memakai `adminHref`. Lintas origin pakai `<a>` biasa, tab yang sama.
- `README.md` § Persiapan: daftar env baru. `.env.production` frontend: isi dua env di atas.
- Tes: `scripts/test-demo.mjs` (atau tes baru `scripts/test-urls.mjs` yang dipanggil `test:demo`):
  - env kosong → relatif;
  - env terisi → absolut;
  - path tanpa `/` atau origin non-https ditolak.

Tidak ada perubahan rute, layout, atau desain. Perubahan visual nol (kecuali ikon tab baru yang sudah dipakai di tempat lain).

### 5.2 Backend (sesi A2)

- **Tidak ada perubahan kode PHP.** `SITE_URL` tetap domain utama (D5).
- `backend/.env.production.example`: contoh `FRONTEND_ORIGINS=https://<domain>,https://panel.<domain>` beserta komentar. Origin publik tetap dicantumkan, tidak berbahaya karena permintaan same-origin tidak memakai CORS.
- `backend/README.md` dan `docs/integrasi.md` § CORS: catat origin panel.
- Tes: tambah kasus di tes CORS yang ada (atau baru):
  - preflight dari origin panel yang dikonfigurasi → `Access-Control-Allow-Origin` sesuai;
  - origin tak dikenal (mis. `https://panel.evil.test`) → tanpa header izin.

### 5.3 Deploy (sesi A2)

1. **`deploy/hostinger/.htaccess` (domain utama)**
   - Placeholder `__ADMIN_ORIGIN__` diganti skrip deploy.
   - Aturan baru sebelum `/api/`:
     ```apache
     # Panel pindah ke subdomain (docs/PROMPTS-ADMIN-SUBDOMAIN.md). Query string ikut otomatis.
     RewriteRule ^admin(/.*)?$ __ADMIN_ORIGIN__/admin$1 [R=302,L]
     ```
     Ganti ke `R=301` setelah masa uji (D6).
2. **`deploy/hostinger/admin.htaccess` (baru, docroot subdomain)**
   - Sama dengan utama untuk: HTTPS, ACME, blok file tersembunyi dan PHP, `ErrorDocument`, kompresi, dan cache aset `/_next/static/`.
   - Ditambah:
     ```apache
     RewriteRule ^$ /admin/ [R=302,L]
     # Hanya panel dan aset build. Halaman lain (HTML/direktori/tidak ada) → situs utama.
     RewriteCond %{REQUEST_URI} !^/(admin|_next)/
     RewriteCond %{REQUEST_URI} !^/404\.html$
     RewriteCond %{REQUEST_FILENAME} !-f [OR]
     RewriteCond %{REQUEST_URI} \.html$
     RewriteRule ^ __SITE_ORIGIN__%{REQUEST_URI} [R=302,L]
     # Tidak ada /api/ di subdomain.
     RewriteRule ^api/ - [F]
     ```
     Berkas statis non-HTML yang ada (logo, ikon, font di akar `public/`) tetap disajikan.
   - Header:
     - `X-Robots-Tag "noindex, nofollow"`;
     - `Referrer-Policy "same-origin"`;
     - `X-Frame-Options DENY`;
     - HSTS dan `nosniff` sama dengan utama;
     - CSP Report-Only (D4):
       ```
       default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
       img-src 'self' data: blob: __SITE_ORIGIN__; font-src 'self'; connect-src __SITE_ORIGIN__;
       frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
       ```
       `connect-src` hanya ke API utama.
   - Bagian Basic Auth (D3) dikomentari, siap diaktifkan:
     `AuthType Basic` / `AuthName "Panel Desa Watuagung"` / `AuthUserFile <di luar docroot>` / `Require valid-user`.
     Lebih mudah lewat hPanel Password Protect Directories; catat path `.htpasswd` yang dibuat hPanel.
3. **`deploy/hostinger-deploy.sh`**
   - Env baru `ADMIN_PUBLIC_HTML` (docroot subdomain) dan `ADMIN_ORIGIN` (`https://panel.<domain>`), keduanya **opsional**. Bila kosong, perilaku lama tetap (satu docroot, tanpa redirect).
   - Saat diisi:
     - validasi docroot subdomain di luar repo, bukan docroot utama, dan bukan induk/anak `APP_DIR`;
     - arsip yang sama diekstrak sekali ke staging;
     - **utama:** `rsync --delete --exclude=/.well-known/ --exclude=/admin/` dari staging, lalu hapus `admin/` lama. Pasang `.htaccess` dengan `__ADMIN_ORIGIN__` terisi, `laravel.php`, dan symlink storage seperti sekarang;
     - **subdomain:** `rsync --delete --exclude=/.well-known/` dari staging (berkas publik ikut tersalin tetapi tidak tersaji karena aturan `.htaccess` di atas). Pasang `admin.htaccess` dengan `__SITE_ORIGIN__` terisi. **Tanpa** `laravel.php` dan symlink storage;
     - placeholder wajib terganti, gagal bila tidak (pola `__LARAVEL_PUBLIC__`).
   - Smoke test dipanggil juga untuk subdomain (§ 5.3 no. 4).
4. **`deploy/smoke-test.sh`** menerima opsi `--admin <host>` dan memeriksa:
   - `https://<domain>/admin/` → 302 ke `https://panel.<domain>/admin/`, termasuk query `?id=REQ-…` ikut;
   - `https://panel.<domain>/` → 302 ke `/admin/`;
   - `https://panel.<domain>/admin/` → 200 HTML, `X-Robots-Tag` noindex, CSP ada;
   - `https://panel.<domain>/api/v1/posts` → 403 (bukan Laravel);
   - `https://panel.<domain>/pelayanan/` → 302 ke domain utama;
   - `https://panel.<domain>/laravel.php` dan `/.env` → 403/404;
   - preflight `OPTIONS https://<domain>/api/v1/staff/me` dengan `Origin: https://panel.<domain>` → 204 + ACAO sesuai.
   Bila Basic Auth aktif, pemeriksaan subdomain mengharapkan 401 tanpa kredensial. Kredensial tidak disimpan di skrip; uji 200 dilakukan manual.
5. **`deploy/hostinger.md`**: bagian baru "N. Panel di subdomain" (langkah hPanel § 7, env deploy, Basic Auth, rollback), plus pembaruan § F (susunan folder), § I (deploy rutin), § J (uji), dan daftar periksa. `docs/deploy-plan.md`: catat keputusan D1–D7.

## 6. Urutan sesi

| Sesi | Isi | Ukuran | Bergantung |
|---|---|---|---|
| A1 | Frontend: `lib/urls.ts`, 5 tautan, env, tes | Kecil | — |
| A2 | Deploy + CORS: `.htaccess` utama/subdomain, skrip deploy, smoke test, dokumen, tes CORS | Sedang | A1 |
| A3 | Pelaksanaan (manusia + pendamping): hPanel, `.env` server, deploy, uji, masa 302 | Kecil (1 jam + 1 minggu pantau) | A1, A2 di-merge dan ditag |
| A4 | Penutupan: 302 → 301, CSP subdomain ditegakkan, opsional Basic Auth bila belum | Kecil | A3 + 1 minggu tanpa masalah |

A1 dan A2 boleh disatukan bila Tech Lead mau satu PR, tetapi tetap > 3 file, jadi tulis rencana dulu.

### Prompt A1

```text
## Tujuan
Tautan antara situs publik dan panel bisa lintas origin, sebagai persiapan panel di
subdomain (docs/PROMPTS-ADMIN-SUBDOMAIN.md § 5.1). Tanpa env baru, perilaku tidak berubah.

## Tugas
1. lib/urls.ts: siteHref(path), adminHref(path) dari NEXT_PUBLIC_SITE_URL dan
   NEXT_PUBLIC_ADMIN_URL. Path wajib diawali "/"; origin harus https (http hanya
   localhost/127.0.0.1); nilai tak valid → path relatif + console.warn.
2. Ganti tautan: features/admin/shell.tsx (Lihat website), news-editor.tsx (Lihat di
   website), business-editor.tsx (lihat UMKM), features/approval/approval-page.tsx
   (Masuk ke panel admin), features/approval/verify-email.tsx (pengaturan notifikasi).
   Lintas origin: <a>, bukan next/link. Panel → publik: tab baru + noopener noreferrer +
   sr-only "(dibuka di tab baru)".
3. README.md § Persiapan: dua env baru, contoh produksi.
4. Tes (masuk test:demo): env kosong → relatif; terisi → absolut; path/origin tak valid
   ditolak.

## Selesai jika
lint, tsc, build, build:demo, test:demo lulus; build dengan kedua env terisi: HTML panel
memuat tautan https://<domain>/..., halaman persetujuan memuat https://panel.<domain>/admin/.
Commit: feat(web): configurable site and admin origins for cross-domain links
```

### Prompt A2

```text
## Tujuan
Deploy Hostinger dapat menyajikan panel dari subdomain (docs/PROMPTS-ADMIN-SUBDOMAIN.md
§ 5.2–5.3). Tanpa ADMIN_PUBLIC_HTML/ADMIN_ORIGIN, deploy berperilaku persis seperti sekarang.

## Tugas
1. deploy/hostinger/.htaccess: placeholder __ADMIN_ORIGIN__ + redirect ^admin(/.*)?$
   (302) sebelum aturan /api/. Bila ADMIN_ORIGIN kosong, skrip menghapus blok redirect
   (penanda komentar BEGIN/END), bukan menyisakan placeholder.
2. deploy/hostinger/admin.htaccess baru sesuai § 5.3 no. 2 (tanpa /api, header noindex,
   CSP Report-Only, Basic Auth dikomentari).
3. deploy/hostinger-deploy.sh: ADMIN_PUBLIC_HTML + ADMIN_ORIGIN opsional; validasi path;
   rsync utama --exclude=/admin/; rsync subdomain; placeholder wajib terganti; tidak ada
   laravel.php/storage di subdomain. Mode tanpa env: perilaku lama.
4. deploy/smoke-test.sh --admin <host>: pemeriksaan § 5.3 no. 4.
5. backend/.env.production.example (FRONTEND_ORIGINS), backend/README.md,
   docs/integrasi.md (CORS), deploy/hostinger.md (bagian N + § F/I/J/daftar periksa),
   docs/deploy-plan.md (D1–D7).
6. Tes CORS: origin panel diizinkan, origin asing tidak.

## Selesai jika
php artisan test lulus; deploy/test-scripts.sh (atau setara) menjalankan skrip deploy pada
direktori sementara untuk dua mode (dengan/tanpa subdomain) dan memeriksa hasil rsync,
placeholder, dan tidak adanya laravel.php di docroot subdomain; bash -n semua skrip.
Commit: feat(deploy): serve staff panel from admin subdomain
```

## 7. Langkah hPanel dan server (sesi A3, manusia)

Jendela kerja di luar jam layanan (sebelum 08.00 atau setelah 13.00 WIB). Siapkan backup (`deploy/hostinger.md` § H) sebelum mulai.

1. **hPanel → Websites → desawatuagung.com → Domains → Subdomains**: buat `panel` (D1). Catat docroot yang dibuat hPanel (biasanya `~/domains/desawatuagung.com/public_html/panel`).
   - **Penting:** bila docroot subdomain berada **di dalam** `public_html` utama, `rsync --delete` situs utama akan menghapusnya. Pilih salah satu:
     - **(disarankan)** ubah docroot subdomain ke folder sejajar, mis. `~/domains/desawatuagung.com/panel_html`, bila hPanel mengizinkan custom folder; atau
     - tambahkan `--exclude=/panel/` pada rsync utama, dan pastikan `admin.htaccess` di folder itu tidak tertimpa `.htaccess` utama. Skrip A2 harus menangani kedua bentuk dan menolak docroot subdomain yang tumpang tindih tanpa exclude.
2. **SSL**: hPanel → Security → SSL → pasang untuk `panel.desawatuagung.com`. Tunggu aktif, lalu cek `https://panel.desawatuagung.com/` menampilkan halaman default.
3. **DNS**: karena DNS di Hostinger, record dibuat otomatis. Verifikasi dengan `nslookup panel.desawatuagung.com`.
4. **`backend/.env` server**: `FRONTEND_ORIGINS=https://desawatuagung.com,https://panel.desawatuagung.com`, lalu `php artisan config:cache` (deploy melakukannya). `SITE_URL` tidak diubah.
5. **Build di laptop** (commit sama dengan tag):
   ```bash
   NEXT_PUBLIC_API_URL=https://desawatuagung.com/api/v1 \
   NEXT_PUBLIC_SITE_URL=https://desawatuagung.com \
   NEXT_PUBLIC_ADMIN_URL=https://panel.desawatuagung.com \
   NEXT_PUBLIC_DEMO_MODE=false NEXT_PUBLIC_SHOW_SAMPLE_CONTENT=false \
   npm run build && tar -C out -czf watuagung-web.tar.gz .
   ```
6. **Deploy** dengan env baru:
   ```bash
   ADMIN_PUBLIC_HTML=<docroot subdomain> ADMIN_ORIGIN=https://panel.desawatuagung.com \
   APP_DIR=... PUBLIC_HTML=... DEPLOY_BACKUP_CONFIRMED=1 DEPLOY_WRITERS_PAUSED=1 \
   bash deploy/hostinger-deploy.sh <tag> --frontend ~/watuagung-web.tar.gz
   ```
7. **Basic Auth (D3, opsional di tahap ini)**: hPanel → Advanced → Password Protect Directories → folder docroot subdomain. Simpan kredensial di password manager desa, lalu bagikan ke petugas lewat saluran resmi, bukan WhatsApp grup.
8. **Uji manual** (§ 8), lalu umumkan alamat baru ke petugas, kades, dan KIM. Bookmark lama tetap dialihkan.

## 8. Rencana uji

**Otomatis (A1/A2):** lint, tsc, build, build:demo, test:demo, `php artisan test`, uji skrip deploy dua mode, smoke test `--admin`.

**Lokal sebelum A3:** dua virtual host lokal tidak praktis di Windows. Cukup:
- jalankan build dengan dua env;
- sajikan `out/` di dua port (`127.0.0.1:3010` sebagai situs, `127.0.0.1:3011` sebagai panel);
- Laravel dengan `FRONTEND_ORIGINS` berisi keduanya;
- uji login, daftar permohonan, detail + lampiran, unggah foto berita, tombol "Lihat di website" ke port situs, dan tombol "Masuk ke panel" dari `/persetujuan/` ke port panel.

Aturan `.htaccess` diuji di server (A3).

**Produksi (A3), pada 390px dan 1440px:**
1. `https://desawatuagung.com/admin/permohonan/detail/?id=REQ-…` → mendarat di `https://panel.…/admin/permohonan/detail/?id=REQ-…`.
2. Login petugas, kades, KIM, dan admin; tiap peran melihat menu yang sama seperti sebelumnya.
3. Alur penuh dengan data fiktif: ajukan (situs utama) → verifikasi/proses (panel) → kades setuju (panel **dan** tautan email `/persetujuan/` di domain utama) → unduh → QR verifikasi.
4. Panel: buka lampiran, unduh PDF, unggah sampul + 3 foto berita, sunting UMKM, ganti kata sandi, notifikasi email.
5. `sessionStorage` di DevTools: token hanya ada di origin panel, tidak di domain utama.
6. Header subdomain (`curl -sI`): noindex, CSP Report-Only, HSTS; `panel.…/api/v1/posts` → 403.
7. Console browser panel: catat pelanggaran CSP selama seminggu sebelum A4.
8. Bila Basic Auth aktif: tanpa kredensial → 401; dengan kredensial → login panel normal.

## 9. Rollback

- **Cepat (menit):** di server, kembalikan `.htaccess` utama tanpa blok redirect (deploy ulang tag sebelumnya tanpa `ADMIN_*`, atau hapus blok BEGIN/END redirect secara manual). Arsip frontend tag sebelumnya masih memuat `admin/`, jadi panel kembali ke `/admin` di domain utama. Subdomain boleh dibiarkan; tanpa redirect dari utama, ia tidak dipakai.
- Karena masa uji memakai **302**, browser tidak menyimpan pengalihan. Setelah 301 (A4), rollback tetap bisa, tetapi petugas mungkin perlu membersihkan cache atau mengetik `/admin/` di jendela privat.
- `FRONTEND_ORIGINS` boleh tetap memuat subdomain; tidak berbahaya.
- Tidak ada perubahan database, jadi tidak ada rollback data.

## 10. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| `rsync --delete` utama menghapus docroot subdomain yang berada di dalam `public_html` | Docroot sejajar, atau exclude eksplisit + validasi skrip (§ 7 no. 1). Uji dua mode di A2. |
| Lupa menambahkan origin panel ke `FRONTEND_ORIGINS` | Panel gagal memanggil API (galat CORS di console). Smoke test preflight menangkapnya sebelum layanan dibuka. |
| Pengalihan memotong query `?id=` | `mod_rewrite` meneruskan query otomatis bila substitusi tanpa `?`; diuji di smoke test. |
| Sesi petugas aktif hilang saat cutover | Token per tab dan per origin; petugas cukup login ulang. Lakukan di luar jam layanan. |
| Basic Auth menyulitkan kades di ponsel | Halaman persetujuan email tetap di domain utama (D5); Basic Auth hanya untuk panel. |
| CSP subdomain memblok fitur (pratinjau `blob:`, gambar media) | Report-Only dulu (D4); `img-src` memuat `blob:` dan origin situs. |
| Biaya | Subdomain gratis di paket Premium; SSL gratis. Tidak ada biaya tambahan. |
| Perpanjangan paket | Hosting dan domain **tidak** auto-renew (berakhir 12 November 2027). Bukan bagian migrasi, tetapi buat pengingat. |

## 11. Daftar periksa

- [ ] D1–D7 diputuskan dan dicatat di `docs/deploy-plan.md`.
- [ ] A1 di-merge (tautan lintas origin, tes).
- [ ] A2 di-merge (deploy, `.htaccess` subdomain, smoke test, CORS, dokumen).
- [ ] Subdomain + SSL + docroot aman dari `rsync --delete` (§ 7 no. 1–3).
- [ ] `FRONTEND_ORIGINS` server diperbarui.
- [ ] Build dengan `NEXT_PUBLIC_SITE_URL` + `NEXT_PUBLIC_ADMIN_URL`; deploy dengan `ADMIN_*`; smoke test `--admin` lulus.
- [ ] Uji produksi § 8 lulus; petugas, kades, dan KIM diberi tahu alamat baru.
- [ ] Seminggu pemantauan: tanpa galat CORS/CSP berarti.
- [ ] A4: 302 → 301, CSP subdomain ditegakkan, Basic Auth (bila dipilih).
- [ ] Setelah stabil: lanjut H1 (CSP situs utama ditegakkan, 2FA/kebijakan kata sandi).
