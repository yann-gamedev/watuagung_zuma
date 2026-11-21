# Progres 21 November 2026 — subdomain admin.desawatuagung.com (perubahan akun Hostinger)

Atas permintaan dan persetujuan pengguna, lewat API Hostinger (tanpa SSH, tanpa deploy). Tidak ada perubahan database, `.env`, atau isi situs utama.

## Kondisi awal

Pengguna membuat subdomain `admin.desawatuagung.com` di hPanel (15.03 UTC). Docroot bawaannya adalah `public_html/admin`, yaitu folder panel situs utama hasil build. Akibatnya:

- subdomain menyajikan HTML panel tanpa `/_next/`, sehingga tampilannya rusak;
- hPanel menaruh `default.php` di folder panel utama;
- deploy mode S akan menghapus `public_html/admin`, yang juga merupakan docroot subdomain itu sendiri. `hostinger-deploy.sh` menolak nama ini.

## Tindakan (urut)

1. Cadangan isi `public_html/admin`: 115 file build diunduh dari situs live dan dicocokkan ukurannya dengan daftar API (115/115). `default.php` tidak dicadangkan. Cadangan disimpan di scratchpad sesi, bukan di repo.
2. Jalur pemulihan dipastikan (URL unggah API dapat dibuat), tanpa menulis apa pun.
3. Subdomain `admin` dihapus. Hasilnya `public_html/admin` **tetap utuh** (116 file) dan `/admin/` situs utama tetap 200. Cadangan tidak dipakai.
4. Subdomain `admin` dibuat ulang dengan folder `panel-admin`, sehingga docroot menjadi `/home/u892368764/domains/desawatuagung.com/public_html/panel-admin`.
5. Pemeriksaan: `https://admin.desawatuagung.com/` 200 dengan sertifikat valid (`ssl_verify_result=0`) dan isi baru `default.php` bawaan; `https://desawatuagung.com/`, `/admin/`, dan `/api/v1/posts` 200.

## Sisa dan risiko

- **Deploy berikutnya wajib memakai `hostinger-deploy.sh` versi branch `feat/admin-subdomain-deploy` dengan `ADMIN_PUBLIC_HTML=.../public_html/panel-admin` (mode P).** Skrip lama di server, atau mode L, menghapus folder `panel-admin`. Kerugiannya kecil (saat ini hanya `default.php`), tetapi subdomain lalu tidak punya docroot sampai folder dibuat lagi.
- `public_html/admin/default.php` (bawaan hPanel) masih ada. Tidak dapat dieksekusi (PHP diblok `.htaccess`) dan terhapus pada deploy frontend berikutnya.
- Panel belum disajikan dari subdomain. Masih perlu: merge PR #109 dan PR deploy subdomain, sesi A1 (tautan lintas origin), `FRONTEND_ORIGINS` di `.env` server, lalu deploy mode S oleh operator (`deploy/hostinger.md` § N).
- D1 di `docs/deploy-plan.md` diperbarui ke `admin.desawatuagung.com`; contoh di `deploy/hostinger.md` dan `.env.production.example` memakai `admin.` dan `panel-admin`.
