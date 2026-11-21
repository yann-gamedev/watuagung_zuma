# Email Notifikasi — Rancangan dan Prompt E1–E4

> Permintaan 20 Nov 2026 terhadap `main` @ `3b32590` (O1–O2 selesai). Menggantikan R11. Dua fitur: (1) email ke **pemohon** setiap status berubah; (2) email ke **kepala desa** berisi tombol **Setuju** / **Tolak**.
>
> Pakai **Pembuka** dari `PROMPTS-FINALISASI.md`. Satu prompt = satu sesi = satu branch/PR.

## Biaya dan infrastruktur

- Paket Hostinger Web Hosting menyertakan kotak surat untuk domain sendiri. Buat **`notifikasi@desawatuagung.com`** di hPanel → Email; kirim lewat SMTP Hostinger. Tidak ada biaya tambahan.
- Cek di hPanel: batas kirim harian paket email, dan rekaman **SPF, DKIM, DMARC** sudah aktif untuk domain (otomatis bila DNS di Hostinger). Tanpa itu email masuk spam.
- Shared hosting tidak bisa menjalankan worker antrean terus-menerus. Pakai `QUEUE_CONNECTION=database` + scheduler: `queue:work --stop-when-empty --max-time=50` setiap menit lewat cron `schedule:run` yang sudah ada. Status permohonan **tidak pernah gagal** karena email gagal terkirim.

## Prinsip keamanan

**Email pemohon**
- **Opsional.** Banyak warga tidak aktif memakai email; tanpa email alur tetap jalan.
- **Isi minimal:** nomor pengajuan, jenis surat, status baru, catatan petugas bila ada (untuk Perlu perbaikan/Ditolak), dan tautan ke halaman cek status. **Tanpa** NIK, alamat, kode akses, atau tautan unduh langsung. Email bisa salah ketik dan sampai ke orang lain; isi ini aman bila itu terjadi.
- Disimpan **terenkripsi** seperti data pribadi lain; ikut dihapus/dianonimkan oleh retensi.
- Tautan "Berhenti menerima email" (token bertanda tangan) di setiap email.

**Email kepala desa (Setuju/Tolak)** — tombol di email berbahaya bila dibuat naif:
1. **Pemindai tautan** (Gmail, Outlook, antivirus) otomatis membuka setiap tautan di email. Bila tautan langsung menyetujui, permohonan bisa disetujui tanpa kades membaca. → Tautan hanya membuka **halaman konfirmasi**; persetujuan baru terjadi saat tombol di halaman itu ditekan (POST).
2. **Email bisa diteruskan atau dibaca orang lain.** → Halaman konfirmasi meminta **PIN 6 digit** milik kepala desa (diatur di panel). Tanpa PIN, tautan tidak bisa dipakai.
3. **Tautan sekali pakai dan kedaluwarsa** (72 jam), terikat ke satu permohonan dan akun kepala desa, hanya berlaku saat status `WAITING_APPROVAL`. Setelah dipakai atau status berubah di panel, tautan mati.
4. **Tolak wajib alasan** (aturan yang sudah ada); halaman konfirmasi menyediakan kolom alasan.
5. Halaman konfirmasi hanya menampilkan ringkasan (nomor, jenis surat, nama pemohon, tanggal, petugas yang memverifikasi, pratinjau draf surat). Dokumen scan KTP/KK **tidak** ditampilkan tanpa login — tombol "Lihat lengkap di panel".
6. Semua aksi lewat email tercatat di audit dan riwayat permohonan sebagai "melalui email".
7. Email kades harus **diverifikasi** (tautan konfirmasi) sebelum notifikasi dikirim, agar persetujuan tidak terkirim ke alamat salah ketik.

## Keputusan

| # | Keputusan |
|---|---|
| E-1 | Email pemohon opsional, dengan centang persetujuan menerima notifikasi |
| E-2 | Notifikasi pemohon untuk setiap perubahan status, termasuk otomatis (Siap diunduh, Selesai, masa unduh berakhir) |
| E-3 | Kades menerima email saat permohonan masuk `WAITING_APPROVAL`, satu email per permohonan |
| E-4 | Persetujuan via email: halaman konfirmasi + PIN 6 digit + tautan sekali pakai 72 jam |
| E-5 | Pengirim `notifikasi@desawatuagung.com` via SMTP Hostinger, antrean database diproses cron |

**Untuk dikonfirmasi:** apakah PIN dapat diterima kepala desa? Tanpa PIN, siapa pun yang memegang email kades (atau email yang diteruskan) bisa menyetujui surat resmi. Saran: tetap pakai PIN.

## Urutan sesi

| Sesi | Isi | Ukuran | Bergantung pada |
|---|---|---|---|
| E1 | Infrastruktur email + email pemohon (backend) | Sedang | — |
| E2 | Kolom email di formulir + berhenti berlangganan (frontend) | Kecil | E1 |
| E3 | Email kades: verifikasi email, PIN, tautan persetujuan (backend) | Sedang | E1 |
| E4 | Halaman konfirmasi persetujuan + pengaturan email/PIN di panel (frontend) | Sedang | E3 |

E2 dan E3 boleh paralel setelah E1.

---

## E1 — Infrastruktur email dan notifikasi pemohon

Branch: `feat/email-applicant-notifications` · Tulis rencana dulu, tunggu persetujuan.

```text
## Tujuan
Pemohon yang mengisi email menerima email setiap status permohonannya
berubah. Rancangan: docs/PROMPTS-EMAIL.md (commit dulu).

## Tugas
1. Konfigurasi: QUEUE_CONNECTION=database (migration jobs/failed_jobs
   bila belum ada); scheduler menjalankan
   `queue:work --stop-when-empty --max-time=50 --tries=3` setiap menit
   (withoutOverlapping). Perbarui .env.production.example (MAIL_MAILER=
   smtp, MAIL_HOST=smtp.hostinger.com, MAIL_PORT=465, MAIL_SCHEME=smtps,
   MAIL_USERNAME/PASSWORD kosong, MAIL_FROM_ADDRESS=
   notifikasi@desawatuagung.com, MAIL_FROM_NAME="Pelayanan Desa
   Watuagung") dan deploy/hostinger.md (buat kotak surat, cek SPF/DKIM/
   DMARC, batas kirim harian). Nilai tepat host/port: cek dokumentasi
   Hostinger saat ini, jangan menebak; tulis sumbernya.
2. Kolom applications: `email` (nullable, cast encrypted, masuk $hidden),
   `email_consent_at`, `email_unsubscribed_at`. Validasi pengajuan: email
   opsional (rfc, maks 120), bila diisi wajib consent. Retensi
   (applications:purge) mengosongkan email.
3. Satu titik pemicu: App\Domain\ApplicationStatusChanged (event) atau
   helper yang dipanggil di SEMUA tempat status berubah — transisi petugas
   (StaffController), unggah surat (LetterController), unduhan pertama
   (ApplicationController::letter), letters:expire-downloads. Listener
   antre (ShouldQueue) mengirim Mailable ke pemohon bila email ada,
   consent ada, dan belum berhenti berlangganan. Tes memastikan keempat
   jalur memicu notifikasi (Mail::fake/Queue::fake).
4. Mailable (Markdown, bahasa Indonesia, teks sederhana):
   subjek "Status permohonan {request_id}: {label status}"; isi sesuai
   docs/PROMPTS-EMAIL.md § Prinsip keamanan → Email pemohon; tombol
   "Cek status" ke {SITE_URL}/cek-status/?id={request_id} (TANPA kode
   akses); catatan "Jangan bagikan kode akses Anda"; tautan berhenti
   berlangganan (URL bertanda tangan Laravel, tanpa kedaluwarsa) ke
   endpoint publik POST /v1/applications/unsubscribe (GET menampilkan
   halaman konfirmasi di frontend — E2).
5. Kegagalan kirim: dicatat (Log::warning tanpa alamat email lengkap —
   samarkan), tidak memengaruhi status. Tidak ada pengiriman ulang
   manual di sesi ini.
6. Tes: email terkirim per status; tanpa email/consent tidak terkirim;
   unsubscribe; isi email tidak mengandung NIK/kode akses (assert
   string); enkripsi kolom; retensi mengosongkan email. SQLite + MariaDB.
7. types, docs/integrasi.md, backend/README.md, kebijakan privasi
   (catat untuk E2).

Commit: feat(api): applicant status email notifications
```

---

## E2 — Formulir: kolom email dan berhenti berlangganan

Branch: `feat/email-applicant-form` · Setelah E1. Ukuran kecil.

```text
## Tujuan
Warga bisa memilih menerima kabar status lewat email.

## Tugas
1. Formulir pengajuan, bagian kontak: field "Email (opsional)" dengan
   teks bantuan "Kami kirim kabar setiap status surat berubah. Isi email
   yang aktif." + centang "Saya bersedia menerima email pemberitahuan"
   (wajib bila email diisi). Validasi Zod sama dengan backend. Ringkasan
   menampilkan email.
2. Halaman sukses: bila email diisi, "Kabar status akan dikirim ke
   e•••@domain.com" (samarkan) + pengingat cek folder spam.
3. Halaman /berhenti-email/: membaca parameter tanda tangan dari URL,
   tombol "Berhenti menerima email" (POST ke endpoint E1), pesan sukses.
4. Kebijakan privasi: email (opsional) untuk pemberitahuan status,
   disimpan terenkripsi, dihapus bersama data permohonan.
5. Demo mode: tanpa kirim email.

## Selesai jika
lint, tsc, build, build:demo, test:demo lulus; uji dengan Laravel lokal
memakai MAIL_MAILER=log: email muncul di log untuk setiap status.
Commit: feat(web): optional applicant email and unsubscribe page
```

---

## E3 — Email kepala desa: verifikasi, PIN, tautan persetujuan

Branch: `feat/email-head-approval` · Setelah E1. Tulis rencana dulu, tunggu persetujuan.

```text
## Tujuan
Kepala desa bisa menyetujui atau menolak permohonan dari email dengan
aman. Baca docs/PROMPTS-EMAIL.md § Prinsip keamanan → Email kepala desa;
ketujuh poin di sana WAJIB.

## Tugas
1. Akun (users): `notification_email` (encrypted, nullable),
   `notification_email_verified_at`, `approval_pin_hash` (Hash),
   `approval_pin_set_at`. Endpoint /v1/staff/me/notifications (GET, PUT
   email → kirim tautan verifikasi; POST verify dengan token bertanda
   tangan 24 jam; PUT pin dengan konfirmasi kata sandi akun). Hanya
   village_head yang punya bagian persetujuan email; peran lain boleh
   menyimpan email tapi tidak menerima tautan persetujuan.
2. Tabel `approval_links`: id, application_id, user_id, token_hash
   (SHA-256 dari token acak 32 byte; token mentah hanya di email),
   expires_at (72 jam), used_at, created_at. Saat permohonan masuk
   WAITING_APPROVAL (pemicu dari E1), buat link per kepala desa aktif
   yang email-nya terverifikasi DAN sudah punya PIN, lalu kirim email.
   Link lama untuk permohonan yang sama dinonaktifkan saat status
   berubah lewat jalur mana pun.
3. Email kades: subjek "Perlu persetujuan: {jenis surat} — {request_id}";
   isi ringkas (jenis surat, nama pemohon, tanggal, petugas pemverifikasi)
   tanpa NIK/alamat; satu tombol "Tinjau dan putuskan" ke
   {SITE_URL}/persetujuan/?t={token}. Boleh dua tombol Setuju/Tolak
   secara visual, TETAPI keduanya hanya membuka halaman konfirmasi yang
   sama (dengan pilihan terpilih) — tidak pernah langsung mengubah status.
4. Endpoint publik (tanpa token Sanctum, throttle ketat per IP dan per
   link):
   - POST /v1/approvals/preview {token} → ringkasan + URL draf PDF
     sementara (lihat 5) bila link valid; 410 bila kedaluwarsa/terpakai/
     status sudah berubah.
   - POST /v1/approvals/decide {token, pin, decision: approve|reject,
     note (wajib untuk reject)} → verifikasi PIN (5 salah → link dikunci
     dan kades diberi email "Percobaan PIN gagal"), jalankan transisi
     YANG SAMA dengan panel (ApplicationStatus, nomor surat, PDF), tandai
     used_at, catat application_events + audit "melalui email".
5. Pratinjau draf: endpoint terpisah bertoken sama yang men-stream draf
   PDF (no-store), hanya selama link valid; scan KTP/KK TIDAK tersedia
   lewat jalur ini.
6. Tes: link GET/preview tidak mengubah status (simulasi pemindai);
   PIN salah/terkunci; kedaluwarsa; sekali pakai; status diubah di panel
   → link mati; tolak tanpa alasan 422; hasil identik dengan persetujuan
   panel (nomor surat terbit); email belum terverifikasi/ tanpa PIN →
   tidak ada link dikirim; token tidak tersimpan mentah. SQLite + MariaDB.
7. docs/integrasi.md, backend/README.md.

Commit: feat(api): village head email approval with PIN
```

---

## E4 — Halaman persetujuan dan pengaturan di panel

Branch: `feat/email-head-approval-ui` · Setelah E3. Tulis rencana dulu.

```text
## Tujuan
Kepala desa mengatur email dan PIN sekali, lalu bisa memutuskan
permohonan dari HP tanpa login panel.

## Tugas
1. Panel → menu akun "Notifikasi email" (semua peran; bagian PIN dan
   persetujuan hanya untuk village_head): isi email → "Tautan verifikasi
   terkirim"; status Terverifikasi; atur/ganti PIN (6 digit, dua kali,
   plus kata sandi akun). Penjelasan singkat: "PIN diminta setiap
   menyetujui lewat email. Jangan bagikan."
2. Halaman publik /persetujuan/ (noindex):
   - baca token dari URL di browser, panggil preview;
   - tampilkan ringkasan + tombol "Lihat draf surat" (blob, tab baru);
   - pilihan Setuju / Tolak (alasan wajib untuk Tolak), input PIN
     (inputmode numeric, autocomplete one-time-code), tombol konfirmasi
     ≥ 48px, dialog "Yakin menyetujui?";
   - hasil: "Permohonan disetujui. Nomor surat: …" / "Permohonan ditolak";
   - 410 → "Tautan sudah tidak berlaku. Buka panel admin." + tautan
     login;
   - hapus token dari address bar setelah dibaca
     (history.replaceState) agar tidak tersimpan di riwayat.
3. Header halaman ini: Referrer-Policy no-referrer (tambahkan ke
   .htaccess / Nginx untuk path /persetujuan/) agar token tidak bocor ke
   situs lain.
4. Panel detail permohonan: riwayat menampilkan "disetujui melalui
   email" bila asalnya dari jalur ini.

## Selesai jika
lint, tsc, build lulus; uji alur penuh dengan MAIL_MAILER=log: staff
ajukan ke kades → ambil tautan dari log → buka di HP (390px) → setujui
dengan PIN → nomor surat terbit → tautan dipakai lagi → "tidak berlaku".
Commit: feat(web): email approval page and notification settings
```
