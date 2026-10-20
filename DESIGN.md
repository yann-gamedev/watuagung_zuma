# Watuagung — Sistem Desain

> Acuan visual untuk redesign Oktober 2026. Sumber gambarnya ada di kanvas "Redesign Watuagung — Gambaran". Jika dokumen ini dan kanvas berbeda, **dokumen ini yang berlaku**; tanyakan ke Tech Lead sebelum menyimpang.

## 1. Arah

Tenang, hangat, dan praktis. Warna diambil dari logo: hijau pohon, emas langit sore, dan krem tanah. Halaman terasa seperti papan informasi balai desa yang rapi, bukan landing page startup.

**Dilarang:**

- gradien ungu/biru, gradien sebagai dekorasi (kecuali lapisan gelap di atas foto hero),
- emoji di antarmuka,
- font Arial, Inter, Roboto, atau Georgia miring sebagai aksen,
- label kecil huruf kapital di atas **setiap** judul bagian (maksimal satu per layar),
- kartu dengan garis tebal di sisi kiri,
- angka besar dekoratif (01/02/03) sebagai pengganti foto,
- bayangan tebal dan efek kaca di mana-mana; blur hanya dipakai pada header setelah scroll.

## 2. Token warna

Simpan sebagai CSS variable di `app/globals.css` (`:root`) dan petakan ke `@theme` Tailwind.

| Token | Hex | Pemakaian |
|---|---|---|
| `--forest` | `#17361A` | latar section gelap, panel menu, angka langkah |
| `--forest-deep` | `#10260F` | footer |
| `--leaf` | `#2F5A27` | tombol utama di latar terang, link, ikon |
| `--olive` | `#6B7A3A` | aksen sekunder (garis langkah 2) |
| `--gold` | `#E3B04B` | tombol utama di latar gelap/foto, aksen |
| `--gold-soft` | `#F1D58E` | label kecil di latar gelap |
| `--earth` | `#8A5A1E` | aksen pengaduan dan ekonomi |
| `--cream` | `#FAF6EC` | latar halaman |
| `--sand` | `#FBF1DB` | kotak aksen hangat |
| `--sage` | `#F3F6EE` | kotak aksen hijau muda |
| `--white` | `#FFFFFF` | kartu, panel tugas |
| `--ink` | `#1B2619` | teks utama |
| `--muted` | `#4E5A4B` | teks sekunder (lulus kontras 4.5:1 di krem dan putih) |
| `--line` | `#E3DCCB` | garis tepi kartu |
| `--on-dark-muted` | `#B9C4AE` | teks sekunder di latar forest/footer |
| `--placeholder` | `#E7E1CF` | kotak foto/peta yang belum tersedia |
| `--status-revision-bg` | `#FDEBD3` | latar Perlu perbaikan |
| `--status-revision-text` | `#8A4B0F` | teks Perlu perbaikan |
| `--status-rejected-bg` | `#F8E1DE` | latar Ditolak |
| `--status-rejected-text` | `#8E2A1E` | teks Ditolak / error |

**Aturan kontras:**

- teks di atas `--gold` selalu `--ink`, tidak pernah putih,
- teks di atas foto hero selalu putih dengan lapisan gelap: `linear-gradient(90deg, rgba(14,32,14,.88) 0%, rgba(14,32,14,.62) 45%, rgba(14,32,14,.15) 100%)`; di ponsel gradiennya vertikal,
- di latar terang, jangan memakai abu-abu lebih terang dari `--muted` untuk teks; di latar gelap gunakan `--on-dark-muted`,
- fokus keyboard di latar terang memakai outline 3px `--leaf`, offset 4px; di atas foto atau `--forest` memakai `--gold`. Aturan fokus global lama belum diganti karena juga berlaku pada halaman berita yang dikunci pengguna.

**Warna status surat** (badge): bedakan juga dengan teks dan ikon, jangan hanya warna.

| Status | Latar | Teks |
|---|---|---|
| Diterima / Menunggu verifikasi RT / Diverifikasi / Diproses | `--sage` | `--leaf` |
| Disetujui RT, menunggu RW (`RT_APPROVED`, ikon `UserCheck`) | `--sage` | `--leaf` |
| Pengantar RT/RW sah, menunggu kantor desa (`RW_APPROVED`, ikon `ShieldCheck`) | `--sage` | `--leaf` |
| Menunggu persetujuan | `--sand` | `--earth` |
| Siap diambil / Selesai | `--leaf` | putih |
| Perlu perbaikan | `--status-revision-bg` | `--status-revision-text` |
| Ditolak | `--status-rejected-bg` | `--status-rejected-text` |

## 3. Tipografi

Satu keluarga: **Plus Jakarta Sans** (400, 500, 600, 700, 800), dimuat dengan `next/font/google`. Fallback: `system-ui, sans-serif`.

| Peran | Desktop | Ponsel | Berat | Line-height |
|---|---|---|---|---|
| H1 hero | 56px | 34px | 800 | 1.12 |
| H2 judul bagian | 38px | 26px | 800 | 1.2 |
| H3 judul kartu | 21px | 17–18px | 700 | 1.35 |
| Teks dasar | 18px | 17px | 400 | 1.6 |
| Teks sekunder | 16px | 15–16px | 400 | 1.55 |
| Label kecil (maks. 1 per layar) | 16px | 14px | 700, letter-spacing .04em | — |
| Minimum mutlak | 15px | 14px | — | — |

Pengecualian ukuran minimum hanya untuk dua hal: subteks identitas "PEMERINTAH DESA" / "ADMINISTRASI DESA" (11–13px, berat 600, letter-spacing .12–.14em) dan caption foto (13–14px). Keduanya bukan teks yang harus dibaca untuk menyelesaikan tugas.

Identitas teks "WATUAGUNG" memakai berat 800 dan letter-spacing `.08em`. Judul lain memakai letter-spacing `-0.02em`. Teks paragraf maksimal 65 karakter per baris (`max-width: 36rem`).

## 4. Ruang, bentuk, ukuran

- Lebar konten maksimal 1200px; padding samping 32px desktop, 16px ponsel.
- Jarak antar bagian: 96px desktop, 48px ponsel.
- Skala spasi: 4, 8, 12, 16, 20, 24, 28, 32, 48, 64, 96.
- Radius: tombol 10px, kartu 14px, panel besar 18px, avatar/angka 50%. Jangan semua elemen memakai radius sama besar.
- Tombol: tinggi minimal 52px desktop, 48px ponsel; padding horizontal 24px; berat 700; ukuran 17px.
- Area sentuh apa pun: minimal 48×48px.
- Bayangan: hanya untuk panel tugas yang menumpuk hero (`0 20px 50px rgba(23,54,26,.14)`) dan header setelah scroll (`0 6px 20px rgba(23,54,26,.08)`).

## 5. Ikon dan gambar

- Ikon dari `lucide-react` (sudah terpasang), stroke 2, ukuran 22–26px. Ikon selalu didampingi teks, kecuali tombol tutup yang tetap punya `aria-label`.
- Foto hero `/village.jpg` dengan caption "foto ilustrasi" dan atribusi di footer.
- Foto yang belum ada diganti kotak placeholder berlabel jelas `[FOTO KEGIATAN]`, berlatar `#E7E1CF`. Jangan pakai foto stok dan jangan pakai ilustrasi generik.

## 6. Komponen kunci

### Header (sticky, 3 keadaan)

| Keadaan | Kapan | Tampilan |
|---|---|---|
| A. Transparan | `scrollY < 80` dan halaman punya hero foto | Latar transparan, teks putih, tinggi 88px; tombol "Ajukan Surat" emas; tombol "Menu" bergaris putih |
| B. Solid | `scrollY ≥ 80`, atau halaman tanpa hero foto | Latar `rgba(250,246,236,.92)` + `backdrop-filter: blur(10px)`, garis bawah `--line`, bayangan tipis, tinggi 72px; teks `--ink`; tombol "Ajukan Surat" `--leaf`; link aktif digaris bawah 3px |
| C. Menu terbuka | Tombol "Menu" ditekan | Panel penuh layar berlatar `--forest`. Desktop: 3 kolom grup + kotak kontak kantor. Ponsel: tombol "Ajukan Surat" paling atas, lalu daftar link setinggi 56px |

- Desktop menampilkan: logo + identitas, 3 link (Profil Desa, Layanan Surat, Berita), tombol "Ajukan Surat", tombol "Menu". Di bawah 900px link disembunyikan; yang tersisa hanya logo, "Ajukan Surat" (disembunyikan pada lebar ≤480px sesuai keputusan pengguna), dan "Menu".
- Transisi warna dan tinggi 200ms ease. Hormati `prefers-reduced-motion`.
- Header `position: fixed`. Hero diberi ruang atas agar konten tidak tertutup. Halaman tanpa hero langsung memakai keadaan B dan mendapat `padding-top: 72px`.
- Aksesibilitas panel menu: `aria-expanded` di tombol, fokus masuk ke panel, Esc menutup, fokus kembali ke tombol Menu, dan body tidak bisa di-scroll selama panel terbuka.
- Hapus topbar tagline lama.

**Grup isi panel menu:**

- Layanan Warga: Ajukan Surat, Cek Status Surat, Pengaduan *(Segera hadir)*
- Profil Desa: Sejarah, Visi & Misi, Perangkat Desa, Peta Wilayah
- Ekonomi & Info: BUMDes, UMKM, Berita & Agenda, Transparansi Anggaran
- Kotak kontak: alamat, jam layanan, tombol **Lihat Kontak Kantor** → `/kontak`. Tidak ada WhatsApp kantor desa; jangan mengarang nomor.
- **Perangkat Desa** → `/struktur-pemerintahan`.
- **Pengaduan** berbadge **Segera hadir** → `/kontak`, bukan formulir palsu.

### Panel tugas (di bawah hero)

Kartu putih radius 18px, menumpuk hero sebanyak −96px (desktop) / −88px (ponsel). Berisi 3 tautan besar:

- Ajukan Surat (latar `--sage`, ikon kotak `--leaf`)
- Cek Status Surat (latar `--sage`)
- Sampaikan Pengaduan (latar `--sand`, ikon kotak `--earth`, badge "Segera hadir" selama fitur belum ada)

Di bawah panel tampil satu baris jam layanan kantor dan tautan kontak kantor; data resmi yang belum tersedia tetap placeholder, tanpa nomor WhatsApp rekaan.

### Daftar layanan surat

- Desktop: grid 2 kolom berisi baris kartu (judul, syarat singkat, estimasi waktu, tombol "Ajukan").
- Ponsel: satu daftar bergaris dengan chevron, tinggi baris ≥ 72px.
- Rincian persyaratan lengkap hanya di halaman detail layanan, tidak di beranda.

### Langkah "Cara mengajukan"

3 langkah bernomor. Teksnya harus sesuai fitur yang tersedia; selama unggah dokumen belum ada, jangan menulis "unggah dokumen".

### Badge "Segera hadir"

Pill kecil berlatar `--sand`, teks `--earth` 14px berat 700. Wajib ada di setiap pintu masuk fitur yang belum tersedia.

### Panel admin — polish 17 Oktober 2026

- Sidebar `--forest`, teks `--on-dark-muted`, item aktif putih di lapisan putih 12%; outline fokus `--gold`.
- Identitas **WATUAGUNG / ADMINISTRASI DESA**, memakai aset `/brand/logo-watuagung-128.png` ditampilkan 56px; subteks 12px/600, tracking .12em. Logo tidak diubah.
- Navigasi 16px/600; header tabel 16px/700 tanpa uppercase, sel dan aksi 16px. Semua teks admin minimal 16px, kecuali subteks identitas. Tombol mengikuti §4 (≥ 48px).
- Sidebar hanya dirender setelah login dengan API aktif. Build demo menampilkan pesan "Panel petugas tidak aktif pada demo" tanpa sidebar/login. Layar login dan pemeriksaan sesi tampil di tengah layar tanpa sidebar.

### Kerangka panel admin — 17 Oktober 2026

- Tiga bagian: sidebar `--forest` (256px), bilah atas putih bergaris bawah `--line` (judul halaman 28px/800, nama + peran petugas, tombol "Lihat website" dan "Keluar"), dan area isi berlatar `--cream`.
- Menu sidebar hanya berisi halaman yang berfungsi: Dashboard, Permohonan, Persetujuan (hanya tampil untuk kepala desa), Siap diambil. Item aktif memakai `aria-current="page"`.
- Tombol aksi status di detail permohonan hanya muncul bila diizinkan server (`allowed_transitions`). Label: Verifikasi, Proses, Ajukan ke Kepala Desa, Setujui, Tandai siap diambil, Tandai sudah diambil, Minta perbaikan, Tolak. Bila tidak ada aksi, tampilkan kalimat "Tidak ada tindakan yang tersedia untuk peran Anda pada status ini."
- Linimasa cek status warga mengikuti jenis surat (`lib/letter-workflow.ts`). SKU berisi tujuh tahap: Diterima → Diverifikasi desa → Diproses → Menunggu tanda tangan Kepala Desa → Disetujui → Siap diambil → Selesai. DOMISILI, SKTM, dan KTP/KK menambahkan Disetujui RT dan Disetujui RW setelah Diterima. Bukti tanpa jenis surat tidak menampilkan linimasa.
- Pada ≤ 900px sidebar menjadi panel geser dari kiri (lebar `min(320px, 86vw)`) dengan lapisan `--forest` 55% di belakangnya. Tombol "Menu" (ikon + teks) di bilah atas; pola aksesibilitas sama dengan header publik: `aria-expanded`, fokus masuk panel, Tab terjebak di panel, Esc dan tombol tutup (`aria-label`) menutup, fokus kembali ke "Menu", scroll halaman dikunci. Panel tertutup saat berpindah halaman.
- Pada ≤ 600px tombol bilah atas selebar layar dan bertumpuk.
- Tabel bergulir di dalam kartunya; halaman tidak boleh bergulir horizontal.

### Daftar dan detail permohonan — 18 Oktober 2026

Disetujui pengguna untuk M3:

- Daftar permohonan: pencarian nomor/nama, filter status dan layanan dengan label Indonesia, urutan terbaru/terlama; kolom Nomor, Pemohon, Layanan, Tanggal, Status. Pada ≤600px menjadi kartu dengan tautan detail yang dapat diakses keyboard.
- Detail: ringkasan di atas; desktop memakai kolom utama (data dan riwayat) dan panel aksi di kanan; layar sempit menjadi satu kolom dengan panel aksi setelah data dan riwayat. Kelompok Data diri, Alamat, Usaha (SKU), Keperluan; riwayat berbentuk linimasa.
- NIK dan KK tersamar secara default, tombol Tampilkan/Sembunyikan per field. Konfirmasi untuk Tolak, Setujui, dan Tandai sudah diambil. Catatan wajib untuk Tolak/Minta perbaikan.
- Semua warna, font, radius, spasi, dan ukuran tetap memakai token dokumen ini; gaya dibatasi ke fitur admin, tidak mengubah halaman publik.

### Antrean RT/RW — 20 Oktober 2026

Disetujui pengguna:

- `rt_head` hanya melihat menu dan halaman **Antrean RT** (`/admin/antrean-rt`); `rw_head` hanya **Antrean RW** (`/admin/antrean-rw`). Halaman panel lain menampilkan "Halaman ini tidak tersedia untuk peran Anda." beserta tautan ke antreannya.
- Antrean memakai pilihan "Menunggu keputusan RT/RW" (bawaan) atau "Semua pengajuan wilayah" untuk riwayat baca-saja pada halaman yang sama. Filter jenis surat tidak menampilkan SKU.
- Pada semua lebar layar, kartu antrean memakai radius 18px dan tombol tinggi minimal 52px. Warna tetap `--sage`/`--leaf`; ikon `UserCheck` (RT) dan `ShieldCheck` (RW).
- Aksi detail: "Setujui sebagai Ketua RT", "Setujui sebagai Ketua RW", dan "Tolak"; persetujuan dan penolakan memakai dialog konfirmasi, tolak wajib memakai catatan.
- Detail RT/RW menampilkan NIK/KK yang sudah disamarkan server, tanpa tombol Tampilkan, dan tanpa telepon, tempat/tanggal lahir, maupun jenis kelamin.
- Status `SUBMITTED` untuk surat yang memerlukan RT/RW tampil sebagai "Menunggu verifikasi RT".

## 7. Struktur beranda (urutan)

1. Hero foto + header A + H1 fungsional + 2 CTA
2. Panel tugas + baris jam layanan
3. Layanan surat yang tersedia
4. Cara mengajukan surat
5. Profil singkat (section `--forest`): foto, ringkasan, 3 angka placeholder, tombol Visi & Misi dan Perangkat Desa
6. Kabar desa (3 berita)
7. BUMDes & UMKM (2 kotak)
8. Kontak kantor + peta
9. Footer `--forest-deep`: logo penuh, 3 kolom link, atribusi foto

## 8. Cara memakai dokumen ini

- Ubah token di satu tempat (`globals.css`). Jangan menulis hex langsung di komponen.
- Desain ponsel dulu, lalu desktop.
- Keputusan visual yang tidak tercakup di sini: tanyakan dulu, jangan menebak.
