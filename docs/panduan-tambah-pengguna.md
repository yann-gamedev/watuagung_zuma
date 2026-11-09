# Panduan menambah pengguna panel

Panduan ini menjelaskan cara membuat akun untuk petugas yang memakai panel admin (`/admin`). Warga tidak memerlukan akun. Website tidak memiliki pendaftaran mandiri, jadi setiap akun dibuat oleh admin.

Ada dua cara:

| Cara | Kapan dipakai | Siapa |
| --- | --- | --- |
| [Panel **Akun**](#cara-1-lewat-panel-akun) | Cara normal untuk semua akun baru | Admin yang sudah bisa masuk panel |
| [Perintah `staff:create`](#cara-2-lewat-terminal-admin-pertama) | Hanya untuk admin pertama, saat belum ada admin yang bisa masuk | Tim teknis dengan akses server |

## Pilih peran yang tepat

Setiap akun memiliki satu peran. Berikan peran paling terbatas yang cukup untuk pekerjaannya.

| Peran di panel | Nama teknis | Yang bisa dilakukan |
| --- | --- | --- |
| Petugas | `staff` | Memproses permohonan surat, mengelola berita, UMKM, dan konten situs |
| Kepala Desa | `village_head` | Menyetujui surat. Tidak mengelola berita, UMKM, atau konten situs |
| Admin | `admin` | Semua pekerjaan petugas, ditambah mengelola akun. Tidak boleh menyetujui surat atas nama Kepala Desa |
| KIM (Media Informasi) | `kim` | Hanya mengelola berita dan UMKM, termasuk fotonya |
| Ketua RT | `rt_head` | Menyetujui permohonan di RT-nya. Hanya tersedia jika fitur persetujuan RT/RW aktif |
| Ketua RW | `rw_head` | Menyetujui permohonan di RW-nya. Hanya tersedia jika fitur persetujuan RT/RW aktif |

## Cara 1: lewat panel Akun

1. Masuk ke panel dengan akun **Admin**.
2. Buka menu **Akun** (`/admin/akun/`).
3. Klik **Tambah akun**.
4. Isi formulir:
   - **Nama lengkap**: nama petugas yang ditampilkan di panel.
   - **Username**: dipakai untuk masuk. Hanya huruf kecil, angka, tanda hubung (`-`), atau garis bawah (`_`), diawali huruf kecil atau angka, maksimal 64 karakter. **Username tidak bisa diubah setelah akun dibuat.**
   - **Peran**: lihat tabel di atas.
   - **Wilayah**: hanya untuk Ketua RT (wajib RT dan RW) dan Ketua RW (wajib RW).
   - **Kata sandi sementara**: minimal 10 karakter.
5. Klik **Buat akun**.
6. Kata sandi sementara ditampilkan **sekali saja**. Klik **Salin**, lalu berikan kepada petugas lewat saluran pribadi, misalnya langsung atau pesan pribadi. Jangan kirim lewat grup.
7. Petugas masuk dengan username dan kata sandi sementara itu. Panel langsung meminta mereka mengganti kata sandi sebelum bisa memakai fitur lain.

### Aturan yang perlu diketahui

- Satu wilayah hanya boleh punya satu ketua aktif: satu Ketua RT per RT+RW, satu Ketua RW per RW. Saat ketua berganti, **nonaktifkan akun ketua lama dulu**, baru buat akun ketua baru.
- Admin tidak bisa menonaktifkan akunnya sendiri atau menurunkan perannya sendiri. Sistem selalu menyisakan minimal satu admin aktif.
- Setiap pembuatan, perubahan, dan reset kata sandi akun tercatat di log audit.

## Mengelola akun yang sudah ada

Semua dilakukan dari menu **Akun**:

| Kebutuhan | Langkah |
| --- | --- |
| Petugas lupa kata sandi | Pilih akunnya, klik **Reset kata sandi**, buat kata sandi sementara baru, lalu berikan lewat saluran pribadi. Semua sesi petugas itu di perangkat lain otomatis berakhir. |
| Petugas berhenti atau pindah tugas | Klik **Nonaktifkan**. Akun tidak bisa dipakai masuk dan semua sesinya berakhir. Riwayat kerjanya tetap tersimpan. |
| Petugas kembali bertugas | Klik **Aktifkan**. |
| Ganti nama, peran, atau wilayah | Klik **Ubah**, lalu **Simpan perubahan**. |

Akun tidak dihapus. Menonaktifkan akun menjaga riwayat siapa memproses apa.

## Cara 2: lewat terminal (admin pertama)

Gunakan cara ini hanya saat belum ada admin yang bisa masuk panel, misalnya pada server baru. Jalankan dari folder `backend/` di komputer atau server yang menjalankan backend:

```bash
php artisan staff:create <username> --role=admin --name="<Nama Lengkap>"
```

Contoh:

```bash
php artisan staff:create admin-desa --role=admin --name="Admin Desa"
```

Terminal meminta kata sandi dua kali. Ketikan tidak terlihat di layar, dan itu normal. Kata sandi minimal **12 karakter**. Jangan pernah menulis kata sandi sebagai bagian dari perintah.

Setelah admin pertama ada, buat akun lain lewat [panel Akun](#cara-1-lewat-panel-akun), supaya pemeriksaan wilayah, perlindungan admin, dan log audit berjalan.

Catatan:

- `staff:create` hanya **membuat akun baru**. Perintah ini tidak bisa mereset kata sandi akun lama, dan username yang sudah dipakai akan ditolak.
- Akun tersimpan di database backend yang sedang aktif. Akun di komputer lokal tidak ikut pindah ke server lewat Git, begitu pula sebaliknya.
- Opsi lain: `--email=` (opsional). Untuk Ketua RT: `--rt=` dan `--rw=`. Untuk Ketua RW: `--rw=`. Nomor RT/RW boleh 1–3 digit, misalnya `1` disimpan sebagai `001`.

## Jika ada masalah

| Gejala | Kemungkinan penyebab |
| --- | --- |
| "Kredensial tidak valid." saat masuk | Username atau kata sandi salah, atau akun nonaktif. Pesannya sengaja sama untuk semua kasus. Periksa status akun di menu **Akun**. |
| Username ditolak saat membuat akun | Format salah (ada huruf besar, spasi, atau simbol lain) atau username sudah dipakai. |
| Pilihan Ketua RT/RW tidak muncul | Fitur persetujuan RT/RW sedang nonaktif. |
| Tidak ada admin yang bisa masuk | Jangan membuat admin pengganti sembarangan. Hubungi pemilik sistem untuk pemulihan terkontrol. Lihat bagian "Diagnosis login dan pemulihan akun" di [README backend](../backend/README.md). |

Detail teknis lengkap (endpoint API, kolom database, dan aturan peran) ada di bagian "Akun petugas" pada [README backend](../backend/README.md).
