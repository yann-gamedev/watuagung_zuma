# Sistem Informasi dan Pelayanan Digital Desa Watuagung

Website profil desa dan prototipe layanan administrasi menggunakan Next.js, React, TypeScript, Tailwind CSS, Lucide, React Hook Form, dan Zod.

## Menjalankan

```sh
npm ci
npm run dev
```

Buka http://localhost:3000. Untuk build produksi: `npm run build`. Hasil static export ada di `out/`.

## Integrasi

Salin `.env.example` ke `.env.local`. Tanpa NEXT_PUBLIC_API_URL, aplikasi berjalan dalam mode simulasi. Data identitas tidak disimpan pada mode tersebut. Dokumentasi arsitektur, kontrak API, alur Google Apps Script, dan checklist produksi tersedia di [docs/integrasi.md](docs/integrasi.md).

## Halaman

Beranda, profil, sejarah, visi-misi, struktur pemerintahan, berita, pengumuman, agenda, potensi, statistik, transparansi, kontak, empat formulir pelayanan, cek status, hasil pengajuan, dan dashboard admin.

## Batas prototipe

Semua isi adalah contoh. Admin memakai data fiktif tanpa login dan perubahan hanya berlaku dalam sesi. Belum ada sambungan Google, PDF, atau backend Laravel. Metadata dan favicon tersedia; noindex diaktifkan sampai data resmi siap.
