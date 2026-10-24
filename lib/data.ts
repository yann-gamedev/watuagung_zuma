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
    description: "Keterangan tempat tinggal untuk berbagai keperluan. Permohonan akan diverifikasi Ketua RT dan RW secara online.",
    requirements: ["KTP dan Kartu Keluarga"],
    time: "1–2 hari kerja",
    icon: "House",
  },
  {
    slug: "sktm",
    code: "SKTM",
    title: "Surat Keterangan Tidak Mampu",
    description: "Dukungan administrasi untuk akses bantuan sosial. Permohonan akan diverifikasi Ketua RT dan RW secara online.",
    requirements: ["KTP dan Kartu Keluarga"],
    time: "2–3 hari kerja",
    icon: "HeartHandshake",
  },
  {
    slug: "ktp-kk",
    code: "KTP_KK",
    title: "Surat Pengantar KTP / KK",
    description: "Mulai pengurusan dokumen kependudukan Anda. Permohonan akan diverifikasi Ketua RT dan RW secara online.",
    requirements: ["Kartu Keluarga"],
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
    summary: "Warga dari beberapa dusun bergotong royong membersihkan jalan lingkungan dan saluran air menjelang musim hujan.",
    content: [
      "Sejak pagi, warga berkumpul membawa peralatan kebersihan untuk merapikan jalan lingkungan, memangkas semak, dan membersihkan saluran air. Kegiatan bersama ini menjadi cara sederhana untuk menjaga ruang publik tetap nyaman digunakan.",
      "Kerja bakti dilakukan per kelompok di sejumlah titik. Warga juga saling bertukar kabar dan menyampaikan bagian saluran yang perlu mendapat perhatian lebih lanjut.",
      "Kebiasaan merawat lingkungan akan terasa manfaatnya jika dilakukan secara rutin. Warga berharap kegiatan seperti ini dapat terus menjadi ruang kebersamaan lintas generasi.",
    ],
  },
  {
    slug: "umkm",
    category: "PEMBERDAYAAN",
    date: "12 September 2026",
    title: "Pelaku usaha rumahan belajar memperkuat kemasan dan pencatatan penjualan produk lokal",
    summary: "Pelatihan sederhana membantu pelaku usaha memahami kemasan, pencatatan, dan promosi produk dengan cerita khas desa.",
    content: [
      "Sejumlah pelaku usaha rumahan mengikuti sesi belajar bersama mengenai cara menata kemasan dan mencatat pemasukan serta pengeluaran. Materi disampaikan dengan contoh sehari-hari agar mudah diterapkan oleh usaha berskala kecil.",
      "Peserta membawa contoh produk masing-masing untuk bertukar masukan. Label yang mudah dibaca, informasi produk yang jelas, dan kemasan yang aman menjadi beberapa hal yang dibahas.",
      "Selain kualitas produk, pencatatan yang teratur dapat membantu pemilik usaha memahami perkembangan penjualan. Peserta juga berdiskusi mengenai promosi melalui jejaring warga dan kegiatan desa.",
      "Kegiatan ini merupakan gambaran inisiatif pemberdayaan ekonomi lokal. Jadwal dan informasi program nyata perlu dikonfirmasi melalui kanal resmi pemerintah desa.",
    ],
  },
  {
    slug: "musyawarah",
    category: "PEMERINTAHAN",
    date: "10 September 2026",
    title: "Musyawarah desa: bersama menyusun prioritas pembangunan",
    summary: "Forum warga menjadi tempat menyampaikan kebutuhan lingkungan dan membahas urutan usulan pembangunan secara terbuka.",
    content: [
      "Musyawarah desa digambarkan sebagai ruang bertukar pandangan antara warga, perwakilan lingkungan, dan pemerintah desa. Berbagai kebutuhan dibicarakan bersama agar rencana pembangunan berangkat dari kondisi yang dirasakan masyarakat.",
      "Usulan yang muncul dapat mencakup perbaikan jalan, saluran air, fasilitas umum, hingga kegiatan pemberdayaan. Setiap kebutuhan memerlukan pembahasan lanjutan, termasuk peninjauan lokasi dan penyesuaian dengan kemampuan anggaran.",
      "Catatan hasil diskusi membantu merangkum persoalan, pilihan tindak lanjut, serta pihak yang perlu dilibatkan. Warga juga dapat mengikuti perkembangan pembahasan melalui informasi yang disampaikan secara terbuka.",
      "Artikel ini adalah contoh editorial untuk pratinjau tampilan website, bukan berita atau notulensi musyawarah resmi.",
    ],
  },
  {
    slug: "posyandu-layanan-warga",
    category: "LAYANAN PUBLIK",
    date: "8 September 2026",
    title: "Posyandu dekat dengan warga, dukung layanan kesehatan keluarga",
    summary: "Kader dan warga saling mendukung kegiatan pemantauan kesehatan ibu dan anak di lingkungan desa.",
    content: [
      "Kegiatan posyandu menjadi salah satu contoh layanan berbasis masyarakat yang membantu keluarga memperoleh informasi kesehatan lebih dekat dari rumah. Kader mendampingi proses pencatatan dan mengarahkan warga sesuai kebutuhan layanan.",
      "Orang tua dapat memanfaatkan kegiatan untuk memantau tumbuh kembang anak serta berkonsultasi mengenai pola hidup sehat. Suasana yang akrab diharapkan membuat keluarga lebih nyaman untuk bertanya.",
      "Dukungan warga, kader, dan tenaga kesehatan berperan menjaga kegiatan berjalan tertib. Informasi jadwal dan jenis layanan harus mengikuti pengumuman resmi setempat.",
    ],
  },
  {
    slug: "perbaikan-jalan-lingkungan",
    category: "PEMBANGUNAN",
    date: "5 September 2026",
    title: "Perbaikan jalan lingkungan bertahap untuk akses yang lebih nyaman",
    summary: "Perencanaan perbaikan akses lingkungan mengutamakan pemetaan kebutuhan dan masukan dari warga yang menggunakan jalan setiap hari.",
    content: [
      "Akses jalan yang nyaman mendukung kegiatan warga, mulai dari perjalanan menuju sekolah hingga distribusi hasil usaha. Sebelum pekerjaan dilakukan, kondisi ruas dan kebutuhan pengguna perlu dipetakan dengan cermat.",
      "Warga dapat membantu menyampaikan titik yang licin, berlubang, atau sulit dilalui saat hujan. Masukan tersebut menjadi bahan untuk menentukan urutan penanganan dan bentuk perbaikan yang sesuai.",
      "Pembangunan yang baik juga memerlukan informasi mengenai tahapan pekerjaan agar warga dapat menyesuaikan aktivitas. Rincian lokasi dan pelaksanaan pada artikel ini bersifat ilustratif dan belum menjadi pengumuman proyek resmi.",
    ],
  },
  {
    slug: "pasar-produk-warga",
    category: "EKONOMI LOKAL",
    date: "2 September 2026",
    title: "Ruang temu produk warga membuka peluang bagi usaha kecil desa",
    summary: "Gagasan pasar produk warga mempertemukan pembuat pangan rumahan, perajin, dan pembeli dalam suasana yang akrab.",
    content: [
      "Pasar produk warga dapat menjadi ruang untuk memperkenalkan hasil karya dan olahan rumahan kepada lebih banyak orang. Selain bertransaksi, pengunjung bisa mengenal bahan, proses, dan cerita di balik setiap produk.",
      "Pelaku usaha dapat mencoba menata produk dengan informasi harga yang jelas dan kemasan yang rapi. Kesempatan berbagi pengalaman juga membantu warga saling belajar tentang pengelolaan usaha.",
      "Inisiatif ekonomi lokal akan tumbuh melalui kerja sama dan konsistensi. Nama kegiatan, tempat, serta waktu penyelenggaraan dalam contoh ini belum ditetapkan dan perlu diverifikasi.",
    ],
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
        text: "Desa Watuagung berada di Kecamatan Prigen, Kabupaten Pasuruan, Provinsi Jawa Timur, pada bentang alam dataran pegunungan dan berjarak ±11 km dari kecamatan. Wilayahnya terdiri atas 3 dusun (Watuagung, Talang, Sekar) dengan 10 RW dan 31 RT. Batas wilayah: utara Desa Gunting (Kec. Prigen), timur Desa Karangrejo (Kec. Purwosari), selatan Desa Jatiarjo (Kec. Prigen), barat Desa Dayurejo (Kec. Prigen). Luas wilayah sedang dikonfirmasi. Sumber: RKP Desa Watuagung 2027.",
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
    title: "Perangkat Desa",
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
        text: "Jl. Taman Safari Indonesia II, Dusun Watuagung RT 001/RW 001, Kecamatan Prigen, Kabupaten Pasuruan, Jawa Timur",
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

// Sumber: docs/data-desa-rkp-2027.md bagian 4. Perbarui di sini saja; /statistik hanya merender.
export const statistics = {
  source:
    "Sumber: RKP Desa Watuagung 2027 — data Kasi Pemerintahan Sept 2025 dan Data Potensi Sosial Ekonomi Desa 2025.",
  population: 4819,
  households: 1582,
  hamlets: 3,
  rt: 31,
  rw: 10,
  householdsByHamlet: [
    ["Watuagung", 863],
    ["Talang", 464],
    ["Sekar", 255],
  ],
  groups: [
    {
      title: "Kelompok usia",
      source: "Kasi Pemerintahan, September 2025.",
      rows: [
        ["0–5 tahun", 220],
        ["6–10 tahun", 365],
        ["11–15 tahun", 384],
        ["16–20 tahun", 391],
        ["21–25 tahun", 397],
        ["26–30 tahun", 373],
        ["31–35 tahun", 451],
        ["36–40 tahun", 443],
        ["41–45 tahun", 358],
        ["46–50 tahun", 369],
        ["51–55 tahun", 384],
        ["56 tahun ke atas", 684],
      ],
    },
    {
      title: "Pendidikan terakhir",
      source: "Data Potensi Sosial Ekonomi Desa 2025.",
      rows: [
        ["Belum sekolah", 443],
        ["Usia 7–45 tidak pernah sekolah", 243],
        ["SD tidak tamat", 657],
        ["SD/sederajat", 1374],
        ["SLTP/sederajat", 974],
        ["SLTA/sederajat", 893],
        ["D-1", 2],
        ["D-3", 32],
        ["S-1", 187],
        ["S-2", 10],
        ["S-3", 4],
      ],
    },
    {
      title: "Mata pencaharian",
      source: "Data Potensi Sosial Ekonomi Desa 2025.",
      rows: [
        ["Petani/pekebun", 1870],
        ["Karyawan swasta", 1162],
        ["Buruh tani", 697],
        ["Mengurus rumah tangga", 412],
        ["PNS", 309],
        ["Wiraswasta", 260],
        ["Guru honorer", 76],
        ["Bidan/perawat", 16],
        ["TNI/Polri", 6],
      ],
    },
  ],
} as const;
