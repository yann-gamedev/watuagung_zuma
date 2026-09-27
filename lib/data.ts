export const services = [
  {
    slug: "sku",
    code: "SKU",
    title: "Surat Keterangan Usaha",
    description: "Lengkapi administrasi untuk mendukung usaha Anda.",
    requirements: ["KTP dan Kartu Keluarga", "Informasi usaha yang dijalankan"],
    time: "1–2 hari kerja",
    icon: "Building2",
  },
  {
    slug: "domisili",
    code: "DOMISILI",
    title: "Surat Keterangan Domisili",
    description: "Keterangan tempat tinggal untuk berbagai keperluan.",
    requirements: ["KTP dan Kartu Keluarga", "Pengantar RT/RW"],
    time: "1–2 hari kerja",
    icon: "House",
  },
  {
    slug: "sktm",
    code: "SKTM",
    title: "Surat Keterangan Tidak Mampu",
    description: "Dukungan administrasi untuk akses bantuan sosial.",
    requirements: ["KTP dan Kartu Keluarga", "Pengantar RT/RW"],
    time: "2–3 hari kerja",
    icon: "HeartHandshake",
  },
  {
    slug: "ktp-kk",
    code: "KTP_KK",
    title: "Surat Pengantar KTP / KK",
    description: "Mulai pengurusan dokumen kependudukan Anda.",
    requirements: ["Kartu Keluarga", "Pengantar RT/RW"],
    time: "1–2 hari kerja",
    icon: "ContactRound",
  },
] as const;
export const news = [
  {
    slug: "gotong-royong",
    category: "KEGIATAN DESA",
    date: "14 September 2026",
    title: "Semangat gotong royong, wujudkan lingkungan desa yang asri",
    text: "Warga bersama perangkat desa melaksanakan kerja bakti membersihkan lingkungan dan saluran air. Kegiatan ini menjadi ruang kebersamaan untuk menjaga desa tetap nyaman.",
  },
  {
    slug: "umkm",
    category: "PEMBERDAYAAN",
    date: "12 September 2026",
    title: "Dari desa untuk Indonesia: dukung produk UMKM lokal",
    text: "Pelatihan pengemasan dan pencatatan usaha membantu pelaku UMKM mengembangkan produk lokal. Informasi pendaftaran kegiatan berikutnya tersedia melalui kantor desa.",
  },
  {
    slug: "musyawarah",
    category: "PEMERINTAHAN",
    date: "10 September 2026",
    title: "Musyawarah desa: bersama menyusun prioritas pembangunan",
    text: "Musyawarah desa menjadi ruang bagi warga untuk menyampaikan usulan pembangunan. Hasil pembahasan akan menjadi bahan penyusunan rencana kerja desa.",
  },
];
export const pages: Record<
  string,
  {
    title: string;
    eyebrow: string;
    intro: string;
    blocks: { title: string; text: string }[];
  }
> = {
  profil: {
    title: "Mengenal Desa Watuagung",
    eyebrow: "PROFIL DESA",
    intro:
      "Rumah bagi semangat gotong royong, alam yang lestari, dan masyarakat yang terus bertumbuh.",
    blocks: [
      {
        title: "Desa yang tumbuh bersama",
        text: "Watuagung mengedepankan kebersamaan dalam membangun lingkungan yang nyaman dan produktif. Pertanian, usaha rumahan, serta kegiatan sosial menjadi bagian dari kehidupan masyarakat.",
      },
      {
        title: "Informasi wilayah",
        text: "Data kecamatan, kabupaten, luas wilayah, dan batas administratif akan dilengkapi berdasarkan dokumen resmi desa. Seluruh isi prototipe ini merupakan contoh.",
      },
    ],
  },
  sejarah: {
    title: "Sejarah Desa",
    eyebrow: "JEJAK WATUAGUNG",
    intro: "Merawat cerita masa lalu, melangkah bersama menuju masa depan.",
    blocks: [
      {
        title: "Arsip sejarah desa",
        text: "Naskah sejarah, asal-usul nama Watuagung, dan tahun berdirinya desa akan disusun dari arsip resmi serta penuturan tokoh masyarakat yang telah diverifikasi.",
      },
      {
        title: "Warisan kebersamaan",
        text: "Gotong royong dan musyawarah menjadi nilai yang ingin terus dihadirkan dalam pelayanan warga. Narasi ini merupakan contoh editorial, bukan catatan sejarah resmi.",
      },
    ],
  },
  "visi-misi": {
    title: "Visi dan Misi",
    eyebrow: "ARAH PEMBANGUNAN",
    intro: "Watuagung yang mandiri, sejahtera, dan melayani.",
    blocks: [
      {
        title: "Visi desa",
        text: "Mewujudkan desa yang maju dan mandiri dengan pelayanan yang terbuka serta masyarakat yang sejahtera. Rumusan contoh ini perlu disesuaikan dengan RPJM Desa.",
      },
      {
        title: "Misi 01 · Pelayanan",
        text: "Meningkatkan pelayanan administrasi yang mudah diakses, ramah, dan transparan.",
      },
      {
        title: "Misi 02 · Pemberdayaan",
        text: "Mengembangkan potensi pertanian dan UMKM melalui kolaborasi masyarakat.",
      },
      {
        title: "Misi 03 · Lingkungan",
        text: "Menjaga kelestarian lingkungan dan memperkuat budaya gotong royong.",
      },
    ],
  },
  "struktur-pemerintahan": {
    title: "Struktur Pemerintahan",
    eyebrow: "PEMERINTAH DESA",
    intro: "Bekerja bersama untuk pelayanan yang lebih dekat dengan warga.",
    blocks: [
      {
        title: "Kepala Desa",
        text: "Nama pejabat akan diisi setelah konfirmasi data resmi.",
      },
      {
        title: "Sekretariat Desa",
        text: "Sekretaris Desa • Kaur Tata Usaha dan Umum • Kaur Keuangan • Kaur Perencanaan",
      },
      {
        title: "Pelaksana Teknis",
        text: "Kasi Pemerintahan • Kasi Kesejahteraan • Kasi Pelayanan",
      },
      {
        title: "Pelaksana Kewilayahan",
        text: "Kepala Dusun dan unsur kewilayahan. Susunan contoh ini perlu disesuaikan dengan organisasi desa.",
      },
    ],
  },
  pengumuman: {
    title: "Pengumuman",
    eyebrow: "INFORMASI UNTUK WARGA",
    intro: "Informasi pelayanan dan pemberitahuan desa dalam satu tempat.",
    blocks: [
      {
        title: "Pelayanan administrasi digital",
        text: "Contoh pengumuman · Pengajuan surat dapat dicoba melalui menu Pelayanan Desa. Website masih berupa prototipe dan belum menerima permohonan resmi.",
      },
      {
        title: "Persiapan dokumen pengajuan",
        text: "Siapkan data identitas dan persyaratan sesuai jenis surat. Gunakan data fiktif ketika mencoba prototipe.",
      },
    ],
  },
  agenda: {
    title: "Agenda Desa",
    eyebrow: "RUANG KEBERSAMAAN",
    intro: "Ikuti kegiatan dan ambil bagian dalam kehidupan desa.",
    blocks: [
      {
        title: "20 September · Kerja bakti lingkungan",
        text: "07.00 WIB · Titik kumpul balai desa. Agenda contoh, belum merupakan jadwal resmi.",
      },
      {
        title: "24 September · Pelatihan UMKM",
        text: "09.00 WIB · Balai desa. Pelatihan pengemasan dan pengelolaan usaha. Agenda contoh.",
      },
      {
        title: "28 September · Musyawarah warga",
        text: "19.30 WIB · Balai desa. Penyampaian aspirasi pembangunan. Agenda contoh.",
      },
    ],
  },
  potensi: {
    title: "Potensi Desa",
    eyebrow: "TUMBUH DARI WATUAGUNG",
    intro: "Kekayaan alam dan karya warga, menjadi kekuatan desa.",
    blocks: [
      {
        title: "Pertanian berkelanjutan",
        text: "Contoh potensi: pertanian padi dan tanaman pekarangan yang dikembangkan dengan semangat menjaga alam.",
      },
      {
        title: "UMKM dan produk lokal",
        text: "Contoh potensi: usaha pangan olahan, kerajinan, dan perdagangan warga. Daftar usaha akan ditambahkan setelah pendataan resmi.",
      },
      {
        title: "Alam dan budaya",
        text: "Ruang terbuka hijau dan budaya gotong royong menjadi inspirasi pengembangan desa. Destinasi wisata akan dicantumkan setelah diverifikasi.",
      },
    ],
  },
  transparansi: {
    title: "Transparansi Desa",
    eyebrow: "TERBUKA UNTUK WARGA",
    intro: "Pembangunan yang dapat dilihat, anggaran yang dapat dipahami.",
    blocks: [
      {
        title: "APBDes 2026 · Contoh",
        text: "Pendapatan Rp2,4 miliar • Belanja Rp2,3 miliar • Pembiayaan netto Rp100 juta. Semua angka adalah ilustrasi, bukan laporan keuangan desa.",
      },
      {
        title: "Prioritas belanja",
        text: "Contoh alokasi: infrastruktur 40%, pemberdayaan 25%, pemerintahan 20%, dan pelayanan sosial 15%.",
      },
      {
        title: "Dokumen publik",
        text: "Dokumen APBDes, realisasi anggaran, serta rencana kerja resmi belum tersedia. Informasi diperbarui setelah dokumen disahkan pemerintah desa.",
      },
    ],
  },
  kontak: {
    title: "Kami siap membantu",
    eyebrow: "KONTAK DESA",
    intro: "Pelayanan yang baik dimulai dari komunikasi yang dekat.",
    blocks: [
      {
        title: "Kantor Desa Watuagung",
        text: "Alamat lengkap, kecamatan, kabupaten, dan titik peta akan ditambahkan setelah verifikasi. Prototipe ini belum menetapkan lokasi desa.",
      },
      {
        title: "Jam pelayanan · Contoh",
        text: "Senin–Kamis 08.00–15.00 WIB • Jumat 08.00–11.30 WIB. Jadwal ini belum merupakan jam operasional resmi.",
      },
      {
        title: "Saluran komunikasi",
        text: "Nomor telepon dan email resmi belum tersedia. Gunakan menu Pelayanan Desa dan Cek Status untuk mencoba alur layanan.",
      },
    ],
  },
};
