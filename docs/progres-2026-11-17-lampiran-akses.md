# Progres 17 November 2026 — Akses petugas, penggantian, dan retensi lampiran

## Lingkup

- Branch `feat/attachments-access` dari `main` @ `dfe697a` (PR #80 lampiran dan #81 foto balai desa sudah di-merge).
- Petugas berwenang membuka lampiran dengan audit; warga mengganti lampiran saat `NEED_REVISION`; lampiran dihapus otomatis oleh retensi.

## Berkas

- `backend/app/Http/Controllers/Api/AttachmentController.php` (baru): `GET /v1/staff/applications/{request_id}/attachments/{id}`; staff/admin/village_head, `forUser()`, 404/410, audit `attachment.viewed` sebelum isi dikirim, header `private, no-store`, `nosniff`, `inline` (gambar) / `attachment` (PDF), nama `{request_id}-{KIND}.{ext}`.
- `backend/app/Http/Controllers/Api/ApplicationController.php`: `authenticate()` dipisah dari `status()` (kunci `lookup:{request_id}` sama); `replaceAttachments()` untuk `POST /v1/applications/attachments`.
- `backend/app/Support/AttachmentStore.php`: `errors()` menerima daftar wajib terpisah; `persist()` meng-update baris yang sama; `replace()`, `deleteFiles()`, `purgeRows()` (audit `attachment.purged`), `staffList()`, `extension()`.
- `backend/app/Http/Controllers/Api/StaffController.php`: `attachments` pada detail untuk peran kantor dan Kepala Desa (bukan RT/RW).
- `backend/routes/api.php`: dua route (60/menit `attachment-view`; 5/menit `application-attachments`).
- `backend/routes/console.php`: `attachments:purge {--dry-run}` + jadwal harian; `applications:purge` ikut menghapus lampiran dan menampilkan jumlahnya di dry-run.
- `backend/config/retention.php`, `backend/.env.example`, `backend/.env.production.example`: `ATTACHMENT_RETENTION_DAYS` (tidak diset = 30; kosong/0 = mati).
- Tes: `AttachmentAccessTest` (baru, 19 tes); `StaffApplicationsTest` menambah `attachments: []` pada detail yang diharapkan.
- Frontend: `features/admin/application-detail.tsx` (zod riwayat menerima `ATTACHMENTS_UPDATED`, judul "Lampiran diganti pemohon"); tanpa perubahan ini detail petugas gagal di-parse setelah warga mengganti lampiran. `types/pelayanan.ts`: `StaffAttachment`, `attachments?`, `AttachmentReplaceResponse`, aksi riwayat baru.
- Docs: `docs/integrasi.md`, `backend/README.md`, `deploy/hostinger.md` (cron, backup, kuota), `PRODUCT.md`, `ROADMAP.md`.

## Keputusan teknis

- Penggantian memakai `application_events.action = ATTACHMENTS_UPDATED` dengan `from_status = to_status = NEED_REVISION`, `user_id` null. Aksi bukan null agar tidak terbaca sebagai perubahan status (pesan penolakan RT/RW mencari event `action` null). Status tidak berubah otomatis.
- `uploaded_at` pada daftar petugas = `updated_at` baris (terakhir diterima).
- Status diperiksa ulang dengan baris terkunci di dalam transaksi; file lama dihapus setelah commit; bila gagal, baris/file lama tetap dan file baru dibuang.
- Unduhan: audit gagal → 500 tanpa isi (fail closed, seperti detail).
- Hostinger tidak menjalankan `schedule:run`, sehingga § H menambah cron `attachments:purge` (00.10 WIB). `media:prune` ternyata juga belum punya cron di § H; tidak diubah di sini.
- Enkripsi Laravel menyimpan isi ±1,78× (diukur 1 MiB → 1,86 MB). Perkiraan kuota di `deploy/hostinger.md` memperhitungkannya: isi ±2–4 MB per permohonan → ±3,5–7 MB di disk.

## Verifikasi yang dijalankan

- `php artisan test` (SQLite): 454 tes / 7.308 assertions lulus.
- MariaDB 11.4.8 lokal (portabel, 127.0.0.1:3307, `APP_KEY` acak di environment proses): `migrate:fresh` + `php artisan test --env=testing.mysql` 454 tes / 7.310 assertions lulus. Tidak ada migration baru.
- `php artisan schedule:list`: `attachments:purge` harian terdaftar.
- Frontend: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run build:demo`, `npm run test:demo` lulus.
- Tidak ada uji browser; tampilan panel hanya berubah pada judul satu jenis entri riwayat dan tidak dicek visual.

## Sisa pekerjaan / keputusan

- Layar warga untuk mengunggah/mengganti lampiran (L3) dan tampilan lampiran petugas (L4).
- Hostinger: pasang cron `attachments:purge`, `post_max_size` 20M; pertimbangkan cron `media:prune` yang belum ada.
- Retensi lampiran 30 hari berasal dari rencana Tech Lead; konfirmasi kebijakan desa (M8).
- Petugas belum dapat mengunggah lampiran atas nama warga (`uploaded_by = staff` belum dipakai).
