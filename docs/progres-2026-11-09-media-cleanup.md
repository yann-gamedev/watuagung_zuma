# Progres 9 November 2026 — foto berita/UMKM: penyebab gagal unggah dan pembersihan file

Branch: `fix/media-photo-cleanup` dari `main` (`7519077`). Tidak ada push, merge, atau deploy.

## Penyebab "Foto tidak dapat dibaca. Pilih JPG, PNG, atau WebP yang valid."

Bukan bug kode. Backend lokal port 8000 dijalankan dengan PHP Herd Lite 8.5.12 (`~/.config/herd-lite/bin/php.exe`, PHP pertama di PATH). GD pada build itu tidak memiliki dukungan JPEG maupun WebP. Diuji dengan file fiktif yang sama:

| PHP | JPG | WebP | PNG |
|---|---|---|---|
| Herd Lite 8.5.12 | gagal | gagal | berhasil |
| WinGet 8.3.36 | berhasil | berhasil | berhasil |

Suite backend lulus karena dijalankan dengan PHP 8.3. Di `main`, PR #69 sudah mengubah gejala ini menjadi 503 "Pengolah foto server belum mendukung format ini", bukan 422 salah format.

Temuan tambahan: kedua PHP memakai `upload_max_filesize=2M`, sedangkan aplikasi mengizinkan 3.072 KiB. Foto 2–3 MB ditolak PHP sebelum Laravel (422 "Foto gagal diterima server…").

**Tindakan lingkungan (belum dilakukan sesi ini, perlu izin):** jalankan backend dengan PHP 8.3 WinGet dan naikkan `upload_max_filesize` ke `4M` di php.ini PHP 8.3. Produksi wajib memakai `php-gd` dengan JPEG/PNG/WebP (sudah tercatat di `backend/README.md`).

## Perubahan

- `PostController::destroy` dan `BusinessController::destroy`: path foto dikosongkan dalam transaksi soft delete, file dihapus setelah commit. Gagal hapus dicatat di log tanpa membatalkan penghapusan. Pemulihan lewat database menghasilkan berita/UMKM tanpa foto.
- `routes/console.php`: perintah `media:prune {--dry-run}`, dijadwalkan harian. Menghapus file `posts/` dan `businesses/` yang tidak dirujuk baris aktif dan berumur > 1 jam (unggahan yang belum commit aman), serta mengosongkan path pada baris yang sudah terhapus. Tidak menyentuh `site/`. Cron produksi `schedule:run` sudah ada di `deploy/crontab.txt`.
- `features/admin/news-editor.tsx`, `business-editor.tsx`: dialog hapus menyebut foto ikut dihapus dan tidak dapat dikembalikan.
- Tes: `PostCoverTest` (hapus berita menghapus sampul; tanpa sampul tetap berhasil), `BusinessesApiTest` (hapus UMKM menghapus foto; tes lama "soft delete menyimpan file" dihapus karena perilakunya diganti), `MediaPruneTest` baru (dry-run, yatim, baris terhapus, file baru, folder `site/`).
- `docs/integrasi.md`, `backend/README.md`: perilaku hapus dan `media:prune`. Bentuk respons API tidak berubah; `types/pelayanan.ts` tidak perlu diubah.

## Verifikasi yang dijalankan

| Pemeriksaan | Hasil |
|---|---|
| `php artisan test` penuh, PHP 8.3.36, SQLite | 411/411 tes, 6.702 assertion lulus |
| `npm run lint` | Lulus |
| `npx tsc --noEmit` | Lulus |
| `npm run build` | Lulus |
| `node scripts/test-admin-news.mjs` | Lulus |
| `node scripts/test-public-businesses.mjs` | Lulus |

Tidak dijalankan: PostgreSQL, uji unggah di browser, dan `media:prune` pada database pengembangan (butuh izin akses `database.sqlite`).

## Sisa pekerjaan / keputusan

- Setelah backend dijalankan dengan PHP 8.3: uji unggah JPG/WebP di panel, lalu `php artisan media:prune --dry-run` untuk melihat foto sisa dari berita/UMKM yang sudah dihapus sebelumnya.
- Masalah 2 (kompilasi dev lambat) dikerjakan di branch terpisah.
