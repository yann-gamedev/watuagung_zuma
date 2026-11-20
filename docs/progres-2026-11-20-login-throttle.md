# Progres 20 November 2026 — login "Too Many Attempts" walaupun kata sandi benar

## Lingkup

- Branch `fix/login-throttle` dari `origin/main` @ `7433fd6`. Lintas backend + frontend (disetujui Tech Lead di sesi).

## Penyebab

- Rute API memakai `throttle:N,1` tanpa nama. Laravel 13 (`ThrottleRequests::resolveRequestSignature`) memakai kunci `domain|IP` yang sama untuk semua rute tersebut; tiap rute hanya membandingkan dengan batasnya sendiri. Membuka beranda (berita, beberapa bagian situs, UMKM) menaikkan penghitung yang sama dengan login (batas 5), sehingga login berikutnya dalam satu menit langsung 429 sebelum kata sandi diperiksa.
- Pesan 429 bawaan Laravel "Too Many Attempts." ditampilkan apa adanya; 401 login memakai "Kredensial tidak valid."; kegagalan jaringan `apiRequest` bisa menampilkan "Failed to fetch".

## Berkas

- `backend/routes/api.php`: semua throttle diberi nama (`application-submit`, `application-status`, `letter-verify`, `public-posts`, `public-site`, `public-businesses`, `application-statement`, `access-code-reset`, `letter-download`, `letter-upload`); login memakai limiter `staff-login`.
- `backend/app/Providers/AppServiceProvider.php`: `staff-login` 5/menit per username (lowercase, trim) + IP dan 20/menit per IP.
- `backend/bootstrap/app.php`: 429 `/api/*` → `{ message: "Terlalu banyak percobaan. Tunggu N detik/menit, lalu coba lagi.", retry_after }` + header `Retry-After`.
- `StaffController::login`: 401 "Username atau kata sandi salah." (akun nonaktif tetap pesan sama).
- `services/pelayanan.ts`, `features/admin/api.ts`: 429 tanpa pesan/berpesan Inggris → pesan Indonesia; `TypeError` jaringan → "Server belum dapat dihubungi..."; panel menangani 429 sebelum pesan per fitur.
- `types/pelayanan.ts`: `ApiThrottleError`. Docs: `docs/integrasi.md` (§ Login username, § Respons 429 batas laju), `backend/README.md`.
- Tes: `ThrottleIsolationTest` (baru, 6 tes: semua throttle bernama, beranda tidak memakan jatah login/cek status, batas per username + IP, batas per IP, pesan Indonesia); 3 tes lama disesuaikan ke pesan 401 baru.

## Verifikasi yang dijalankan

- `php artisan test` SQLite: 478 tes / 24.969 assertions lulus. MariaDB 11.4.8 lokal: 478 / 24.971 lulus (`APP_KEY` acak sementara via env).
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo`, `scripts/test-public-news.mjs` lulus.
- `scripts/test-no-sample.mjs` **gagal, sudah gagal di `main` @ `7433fd6` tanpa perubahan ini** (chunk `0by1v9q_d-b08.js` memuat "Artikel contoh"); tidak terkait.
- Tidak ada uji browser.

## Sisa pekerjaan / keputusan

- Deploy ke Hostinger agar berlaku (perlu tindakan terpisah).
- `test-no-sample` di `main` perlu ditinjau tersendiri.
- `npm ci` di `main` menunggu PR #89 (lockfile).
