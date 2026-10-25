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
      {
        title: "Lembaga desa",
        text: "Lembaga yang berstatus aktif:\nPemerintah Desa\nBPD\nRT/RW\nKader Posyandu\nKader Pembangunan Manusia (KPM)\nBUMDes Watuagung Bangkit\nKoperasi Desa Merah Putih\nPKK\nGapoktan/Poktan\nHIPPA\n\nSumber: RKP Desa Watuagung 2027.",
      },
    ],
  },
  sejarah: {
    title: "Sejarah Desa",
    eyebrow: "JEJAK WATUAGUNG",
    intro: "Merawat cerita masa lalu, melangkah bersama menuju masa depan.",
    blocks: [
      {
        title: "Asal-usul nama Watuagung",
        text: "Nama Watuagung berasal dari sebuah batu besar menyerupai gunung yang di atasnya tumbuh pohon beringin. Sepasang satria, Mbah Singo (dari Ponorogo) dan istrinya Mbah Gambir (dari Keraton Solo), berteduh di bawahnya dan merasakan ketenteraman, lalu tempat itu dijadikan desa. Keduanya dikenang sebagai pepunden desa dan disebut memiliki 12 anak yang membuka hutan (babat alas) Desa Watudukun, yang kini dikenal sebagai Watuagung. Ringkasan ini berdasarkan tutur masyarakat yang tercatat dalam RKP Desa Watuagung 2027.",
      },
      {
        title: "Tiga dusun",
        text: "Dari sejarah itu dikenal tiga dusun: Watuagung, Talang, dan Sekar.",
      },
      {
        title: "Kepala desa dari masa ke masa",
        // ponytail: satu baris per orang via white-space: pre-line; jadikan <ul> bila blok mendukung daftar.
        text: [
          "Oentong Koesoemodirdjo, Petinggi pendiri desa (Abad XIX)",
          "Astro Redjo (Abad XIX)",
          "Tirto Soebronto (s.d. 1942)",
          "Idris Kerto Soedjono (1942–1967)",
          "Abdul Ghani Kerto Oetomo (1967–1975)",
          "Moh. Sa'i, Pj. (1975–1978)",
          "Ad Hardjo Setyo Atmodjo (1979–1990)",
          "Mgs Hardjo Sutopo (1991–1998)",
          "Pujiharjo Mangku Projo (1999–2002)",
          "Mokhamad Usman Ef, S.Pd. (2003–2016)",
          "Nanang Setyawan, S.E., Pj. (2016–2017)",
          "Drs. Kusminto (2017–2023)",
          "Didik Hariyanto (2024–2031)",
          "",
          "Sumber: RKP Desa Watuagung 2027.",
        ]
          .join("\n")
          .replace(/–/g, "\u2060–\u2060"), // word joiner: rentang tahun tidak terpotong di ponsel
      },
    ],
  },
  "visi-misi": {
    title: "Visi dan Misi",
    eyebrow: "ARAH PEMBANGUNAN",
    intro: "Arah pembangunan Desa Watuagung menurut dokumen perencanaan desa.",
    blocks: [
      {
        title: "Visi dan misi desa",
        text: "Visi dan misi resmi mengacu pada RPJM Desa Watuagung 2024–2031 dan akan ditampilkan setelah dokumen diterima.",
      },
      {
        title: "Tema pembangunan 2027",
        text: "Terbangunnya tata kelola pemerintah desa yang baik, bersih, terbuka, partisipatif guna mewujudkan kehidupan masyarakat Watuagung yang maju, cerdas, adil, makmur, sejahtera, dan berdaulat. Sumber: RKP Desa Watuagung 2027.",
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
        text: "Didik Hariyanto · masa jabatan 2024–2031",
      },
      {
        title: "Sekretariat Desa",
        text: "Sekretaris Desa: Cucu Bagus Dediyanto • Kaur Umum: Tyas Ning Aris • Kaur Keuangan: Sumarto • Kaur Perencanaan: Mahmud Hady • Kaur Kesejahteraan: Gunawan",
      },
      {
        title: "Pelaksana Teknis",
        text: "Kasi Pemerintahan: Tulus Santoso • Kasi Pelayanan: M. Tu'en",
      },
      {
        title: "Pelaksana Kewilayahan",
        text: "Kepala Dusun Watuagung: Sulandra • Kepala Dusun Talang: Sulis • Kepala Dusun Sekar: Yudi Prasetyawan",
      },
      {
        title: "Badan Permusyawaratan Desa",
        text: "Ketua: Nariono • Wakil Ketua: Katuwi S. Rizal • Sekretaris: Kasiyanto • Anggota: Tatik Hartini, Cahyo Nur Hadi, Moh. Anas Wahyudin, Khoirul Abadi. Sumber susunan di halaman ini: RKP Desa Watuagung 2027.",
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
        title: "Pertanian dan perkebunan",
        text: "Persawahan seluas 151 ha dan tegalan 224 ha didominasi padi dan palawija. Perkebunan seluas 35 ha meliputi nangka, alpukat, rambutan, dan pisang. Terdapat 16 titik sumber mata air. Sumber: RKP Desa Watuagung 2027, ditetapkan 28 September 2026.",
      },
      {
        title: "Usaha warga",
        text: "Kegiatan ekonomi warga meliputi kelompok usaha ekonomi produktif, budidaya lebah madu, kelompok keterampilan usaha perempuan, kelompok usaha tani, dan peternakan ayam. BUMDes Watuagung Bangkit memiliki unit usaha peternakan sapi. Sumber: RKP Desa Watuagung 2027.",
      },
      {
        title: "Seni dan budaya",
        text: "Seni dan budaya desa meliputi ludruk, bantengan, kelompok lawak, seni religius, dan orkes Melayu. Desa juga memiliki arena outbound. Pembentukan Kelompok Sadar Wisata (Pokdarwis) dan festival kesenian direncanakan pada 2027. Sumber: RKP Desa Watuagung 2027.",
      },
    ],
  },
  transparansi: {
    title: "Transparansi Desa",
    eyebrow: "TERBUKA UNTUK WARGA",
    intro: "Program prioritas dan informasi dokumen perencanaan Desa Watuagung.",
    blocks: [
      {
        title: "Program prioritas 2027",
        text: "Kesehatan: rembuk stunting, PMT balita/ibu hamil/stunting, Posyandu remaja, tes gula darah/kolesterol/asam urat, dan penyuluhan TBC/malaria.\n\nInfrastruktur: TPS3R tahap 1, TPT dan paving Kali Terong, TPT Sentono (Talang), drainase RT 2 RW 9 (Sekar), TPT jalan lingkungan RT 3 RW 4, lanjutan pipanisasi air bersih Dusun Talang, dan rehab pendopo balai desa.\n\nPemberdayaan: festival kesenian, pembentukan Pokdarwis, pelatihan pemasaran digital, penguatan BUMDes, serta pembentukan bank sampah dan Lembaga Adat Desa.\n\nSosial: BLT Dana Desa untuk 42 keluarga penerima manfaat.\n\nSumber: RKP Desa Watuagung 2027, program tahun 2027.",
      },
      {
        title: "Dokumen publik",
        text: "RKP Desa 2027 telah ditetapkan melalui Perdes Nomor 6 Tahun 2026 pada 28 September 2026. APBDes resmi akan ditampilkan setelah diterima. Angka anggaran belum ditampilkan karena masih menunggu data APBDes resmi.",
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
