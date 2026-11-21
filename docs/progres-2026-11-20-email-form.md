# E2 — Email pemohon opsional dan berhenti pemberitahuan

Branch `feat/email-applicant-form`, dasar E1 `b757017`. Tidak mengubah backend atau menambah dependency.

## Perubahan

- Bagian Kontak formulir enam layanan: telepon, Email (opsional), bantuan, centang persetujuan. Consent wajib jika email diisi; ringkasan memuat email. Respons 422 E1 kembali ke kolom email/persetujuan.
- Zod membatasi 120 karakter Unicode, pemeriksaan bentuk awal dan consent. **Keputusan pengguna:** Laravel `email:rfc` penentu akhir; Zod `.email()` tidak dipakai karena menolak quoted local part, alamat internasional, dan domain lokal yang backend terima. Ini bukan parser RFC offline identik. Tidak ada pemeriksaan DNS.
- Sukses menyimpan hanya email tersamar di sessionStorage tab, tanpa email utuh di URL/penyimpanan; pesan tujuan dan pengingat spam. Jika sessionStorage tidak tersedia, tujuan email tidak dapat ditampilkan setelah navigasi; perlindungan penyimpanan kode akses tetap seperti sebelumnya.
- `/berhenti-email/`: membaca query asli di browser, GET tidak mengubah langganan; tombol POST E1, galat/retry, sukses dan tautan cek status. Query tidak disusun ulang, dibuang setelah sukses; metadata noindex/no-referrer.
- Privasi menjelaskan email opsional/consent, enkripsi, penghapusan saat unsubscribe/retensi, retensi belum aktif bawaan, serta demo tanpa kirim/simpan email.
- Demo tetap memvalidasi formulir, tetapi email/consent tidak masuk bukti localStorage dan tidak dikirim. Unsubscribe demo tidak memanggil API.

## Verifikasi frontend

- `npm run lint`: lulus.
- `npx tsc --noEmit`: lulus. Pemeriksaan pertama menemukan prop `eyebrow` kurang pada PageHeading baru; diperbaiki.
- `npm run build`: lulus, 58 halaman termasuk `/berhenti-email/`. Percobaan awal gagal karena junction node_modules keluar root Turbopack; dependency disalin lokal dan build ulang lulus tanpa ubah konfigurasi. Rerun berikut sempat gagal resource Windows 1450/1455/heap saat dev server dan browser tes aktif; dev server milik sesi dihentikan; rerun serial `build`, `build:demo`, dan `test:demo` lulus (exit 0).
- `npm run test:demo`: lulus; tambahan pemeriksaan email/panjang/consent, masking quoted/internasional, multipart consent, demo tanpa network/storage email, POST query bertanda tangan dan galat 403/404/429/500. Percobaan sebelumnya terpotong saat junction dependency diganti; rerun penuh lulus.
- `npm run build:demo`: lulus, 58 halaman.
- Browser Chromium 390px/1440px: lulus consent menghalangi lanjut, multipart email/true, ringkasan email, sukses tersamar/spam, email utuh tidak tersimpan, GET unsubscribe tanpa mutasi, POST sukses, tautan kurang parameter. Tidak ada overflow horizontal; screenshot kontak/sukses/unsubscribe diperiksa pada dua lebar. Fokus diarahkan ke judul sukses sesudah unsubscribe. Harness lokal `C:\Users\Christian\AppData\Local\Temp\opencode\email-form-e2e.cjs`; respons API dimock, bukan bukti browser tersambung Laravel. Demo hasil static export juga diuji di Chromium: unsubscribe tanpa tombol/permintaan API dan sukses menjelaskan email tidak dikirim. Log dev menampilkan peringatan hydration pada atribut `style=caret-color:transparent` yang diubah saat automation/screenshot; tidak ada klaim konsol bersih.

## Laravel lokal: MAIL_MAILER=log

Harness terisolasi di `C:\Users\Christian\AppData\Local\Temp\opencode\e1-email-runtime-20261120`. Backend tracked E1 disalin dan hash diverifikasi; vendor tersedia dipakai ulang. Tidak mengubah .env/database/APP_KEY pengguna; kunci acak hanya pada proses tes, SQLite `:memory:`, storage/log/cache terpisah. PHP 8.3.36, Composer 2.8.12. Tidak memasang Boost atau dependency.

Reproduksi:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Christian\AppData\Local\Temp\opencode\e1-email-runtime-20261120\verify.ps1
```

Hasil runner akhir exit 0:

- Transport log nyata: 1 tes, **3.725 assertion, 76 email per run**, `MAIL_MAILER=log`, `QUEUE_CONNECTION=database`, worker `queue:work --stop-when-empty` nyata. Tidak memakai Mail fake pada tes runtime.
- Suite E1 bawaan: **13 tes / 118 assertion**, memakai Mail fake sesuai tes asli.
- Tiga alur lengkap pengajuan DOMISILI multipart: VERIFIED, PROCESSING, WAITING_APPROVAL, APPROVED, unggah scan READY_FOR_PICKUP, lalu COMPLETED melalui unduh pertama, expiry command, atau transisi manual.
- Matriks 58 transisi manual sesuai aturan: 27 RT/RW mati, 31 RT/RW aktif, seluruh peran yang diizinkan. Termasuk RT_APPROVED, RW_APPROVED, NEED_REVISION, REJECTED. Status sumber matriks disiapkan langsung sebagai fixture; transisi diuji melalui API nyata.
- SUBMITTED memang tanpa email; scan pengganti/unduh ulang/expiry ulang tidak menghasilkan duplikat. Tanpa email, consent, atau setelah unsubscribe tidak masuk antrean.
- Tiap email: status tersimpan, satu job, tidak terkirim sebelum worker, nol failed jobs; subjek/penerima fiktif/URL status/unsubscribe tepat, catatan perbaikan/penolakan bila ada, identitas sensitif dan kode akses tidak di isi HTML; payload antrean tidak menyimpan email/catatan.
- Bukti: `results.json`, `README.md`, `runtime-output.txt`, `existing-suite-output.txt`, `backend\storage\logs\laravel.log` di direktori harness. Log bertambah pada rerun; 76 bukan hitungan seluruh file log.

Batas: HTTP test client Laravel dalam proses, autentikasi tes Sanctum dan throttle dinonaktifkan; worker nyata dalam proses yang sama. Bukan browser-ke-Laravel TCP, SMTP/mailbox, cron produksi, retry pengiriman, konkurensi, atau MySQL/MariaDB. Runtime template DOMISILI saja. Tidak push/deploy; SMTP produksi tetap menunggu deploy E2 dan konfigurasi email server.
