# Integrasi pelayanan Watuagung

## Arsitektur

Next.js App Router + React + TypeScript + Tailwind CSS. Form menggunakan React Hook Form dan Zod. `components/` berisi komponen reusable, `features/` berisi alur aplikasi, `services/pelayanan.ts` berisi adapter transport, `lib/` berisi data contoh dan validasi, `types/` berisi kontrak.

Tanpa `NEXT_PUBLIC_API_URL`, frontend memakai simulasi. Hanya nomor dan status pengajuan disimpan pada localStorage browser, maksimal 50 receipt. Data identitas formulir tidak disimpan. Data admin terpisah, berada di memori sesi, dan kembali ke kondisi awal setelah reload. Jangan masukkan data pribadi asli ke prototipe.

## Kontrak API

Set `NEXT_PUBLIC_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec`, lalu build ulang. Gunakan deployment `/exec`, bukan `/dev`. Environment berawalan NEXT_PUBLIC dikompilasi ke browser; tidak boleh mengandung credential/token. Untuk Laravel ubah URL dan implementasikan kontrak yang sama, atau sesuaikan transport di service tanpa mengubah komponen.

Submit: POST text/plain;charset=utf-8 dengan JSON `{ "action":"submit", "jenis_surat":"SKU", "nama":"Pemohon Contoh", "nik":"0000000000000000", "no_kk":"0000000000000000", "tempat_lahir":"Contoh", "tanggal_lahir":"2000-01-01", "jenis_kelamin":"Laki-laki", "alamat":"Alamat fiktif", "rt":"01", "rw":"01", "telepon":"08000000000", "nama_usaha":"Usaha Contoh", "jenis_usaha":"Perdagangan", "alamat_usaha":"Alamat fiktif", "keperluan":"Administrasi contoh" }`.

Respons: `{ "success":true, "request_id":"REQ-2026-000001", "status":"SUBMITTED" }`.

Cek status: POST dengan `{ "action":"status", "request_id":"REQ-2026-000001" }`. Respons sama, dengan `catatan` opsional. Error: `{ "success":false, "message":"Permohonan tidak ditemukan." }`. Service memvalidasi respons dengan Zod dan membatasi waktu tunggu 20 detik. `text/plain` menghindari preflight JSON untuk Apps Script; perilaku redirect dan CORS tetap harus diuji pada deployment nyata. Jika kebijakan akun menghalangi browser, gunakan proxy backend yang mengimplementasikan kontrak ini. Jangan menggunakan mode no-cors karena respons tidak dapat dibaca.

Status yang diizinkan: SUBMITTED, VERIFIED, PROCESSING, WAITING_APPROVAL, APPROVED, REJECTED, NEED_REVISION. Alur normal: SUBMITTED → VERIFIED → PROCESSING → WAITING_APPROVAL → APPROVED. Status perbaikan dan penolakan menampilkan alasan tersendiri. Makna APPROVED pada prototipe adalah selesai/disetujui; backend produksi harus menetapkan status tersebut hanya setelah dokumen final siap.

## Rencana Google Apps Script

1. `doPost(e)` membaca JSON dari `e.postData.contents`, memvalidasi semua field ulang di server, dan membatasi ukuran request. Validasi frontend bukan pengamanan server.
2. Untuk submit, buat request ID unik, simpan baris ke Sheets dengan status SUBMITTED. Gunakan LockService untuk pembuatan ID berurutan serta pencegahan race. Lindungi dari formula injection pada input yang diawali =, +, -, atau @; simpan NIK/KK sebagai teks agar nol di depan terjaga.
3. Simpan ID spreadsheet, folder Drive, dan template per jenis surat di Script Properties, bukan frontend. Tulis tanggal server dan audit perubahan status.
4. Setelah petugas memverifikasi, salin template Google Docs. Ganti placeholder `{{nama}}`, `{{nik}}`, `{{no_kk}}`, `{{alamat}}`, `{{jenis_usaha}}`, `{{tanggal}}` beserta field lain yang diperlukan. Escape kurung kurawal saat memakai replaceText yang menerima regex.
5. Simpan dan tutup dokumen, ekspor sebagai PDF, simpan di folder Drive terbatas. Simpan ID file internal di Sheets. Jangan mengembalikan URL Drive publik yang membuka data pribadi.
6. Kirim untuk persetujuan. Saat disetujui dan PDF final siap, ubah status menjadi APPROVED. Kegagalan pembuatan dokumen harus dicatat; jangan menandai sukses bila ekspor gagal.
7. Endpoint status hanya mengembalikan metadata minimum. Tambahkan bukti kepemilikan/OTP pada produksi; request ID berurutan saja tidak cukup melindungi akses data pribadi. Endpoint admin harus memiliki autentikasi, role, dan audit log.

Pembuatan PDF, koneksi Google, unggah dokumen, login admin, dan pengiriman notifikasi belum diimplementasikan pada fase frontend ini. Tidak ada backend Laravel. API eksternal adalah sumber kebenaran setelah endpoint disetel.

## Menjalankan dan memverifikasi

`npm ci`, salin `.env.example` menjadi `.env.local`, lalu `npm run dev`. `npm run build` menghasilkan static export pada `out/`. Rute dinamis publik dibangkitkan melalui generateStaticParams. Hosting statis perlu mendukung direktori index.html dan 404.html. Pada hosting Next server, hapus `output: 'export'` bila menambahkan endpoint server.

Uji submit kosong, NIK/KK bukan 16 digit, tanggal masa depan, SKU tanpa data usaha, pengajuan valid, salin ID, lookup ID baru, ID tidak dikenal, semua status contoh, filter admin kosong, perubahan status berurutan, dan alasan penolakan/perbaikan. Pastikan mobile, keyboard, dan label input tetap berfungsi.

## Sebelum produksi

Ganti semua angka, berita, struktur, alamat dan jadwal contoh dengan data resmi. Konfirmasi kecamatan/kabupaten Watuagung sebelum memasang peta. Ganti ilustrasi dengan foto desa berizin dan lambang resmi. Metadata publik sudah tersedia; robots sengaja noindex untuk prototipe berisi data fiktif. Setelah verifikasi, atur metadataBase/canonical sesuai domain, ubah robots menjadi index, dan tambahkan sitemap untuk rute publik. Jangan indeks admin dan hasil pengajuan. Foto ilustrasi: Thomas Fuhrmann, Rice terraces in Java – Indonesia, Wikimedia Commons, CC BY-SA 4.0; gambar dipotong pada tampilan, kredit di footer.
