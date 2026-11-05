<?php

namespace Database\Seeders;

final class SiteSectionDefaults
{
    // Source: lib/data.ts, 4 Nov 2026. Page headings remain frontend-owned.
    public static function data(): array
    {
        return [
            'profile' => [
                'intro' => 'Rumah bagi semangat gotong royong, alam yang lestari, dan masyarakat yang terus bertumbuh.',
                'profileDetails' => [
                    'themes' => ['Pertanian', 'Usaha rumahan', 'Kegiatan sosial'],
                    'stats' => [
                        ['value' => '3', 'label' => 'Dusun', 'detail' => 'Watuagung, Talang, Sekar'],
                        ['value' => '10', 'label' => 'RW'],
                        ['value' => '31', 'label' => 'RT'],
                    ],
                    'location' => 'Kec. Prigen, Kab. Pasuruan, Prov. Jawa Timur',
                    'boundaries' => [
                        ['direction' => 'Utara', 'place' => 'Desa Gunting (Kec. Prigen)'],
                        ['direction' => 'Timur', 'place' => 'Desa Karangrejo (Kec. Purwosari)'],
                        ['direction' => 'Selatan', 'place' => 'Desa Jatiarjo (Kec. Prigen)'],
                        ['direction' => 'Barat', 'place' => 'Desa Dayurejo (Kec. Prigen)'],
                    ],
                    'institutions' => [
                        ['name' => 'Pemerintah Desa', 'description' => 'Penyelenggara urusan pemerintahan desa yang dipimpin kepala desa dan dibantu perangkat desa, mencakup pelayanan administrasi dan pembangunan desa.'],
                        ['name' => 'BPD', 'description' => 'Badan Permusyawaratan Desa, mitra pemerintah desa yang menampung aspirasi warga, membahas Peraturan Desa, dan mengawasi kinerja pemerintah desa.'],
                        ['name' => 'RT/RW', 'description' => 'Lembaga kemasyarakatan tingkat lingkungan yang membantu pelayanan warga, pendataan, dan menjaga kerukunan.'],
                        ['name' => 'Kader Posyandu', 'description' => 'Relawan warga yang membantu layanan kesehatan ibu, bayi, dan balita di Pos Pelayanan Terpadu.'],
                        ['name' => 'Kader Pembangunan Manusia (KPM)', 'description' => 'Warga yang mendampingi keluarga untuk mencegah stunting dan meningkatkan akses layanan dasar seperti kesehatan, gizi, dan pendidikan anak.'],
                        ['name' => 'BUMDes Watuagung Bangkit', 'description' => 'Badan usaha milik desa yang mengelola potensi ekonomi desa untuk menambah pendapatan desa dan kesejahteraan warga.'],
                        ['name' => 'Koperasi Desa Merah Putih', 'description' => 'Koperasi desa sebagai wadah usaha bersama warga, seperti simpan pinjam dan penyediaan kebutuhan sehari-hari.'],
                        ['name' => 'PKK', 'description' => 'Gerakan pemberdayaan keluarga yang menggerakkan kegiatan kesejahteraan keluarga, kesehatan, pendidikan, dan ekonomi rumah tangga.'],
                        ['name' => 'Gapoktan/Poktan', 'description' => 'Kelompok tani dan gabungannya, tempat petani berbagi ilmu, sarana produksi, dan pemasaran hasil tani.'],
                        ['name' => 'HIPPA', 'description' => 'Himpunan Petani Pemakai Air, yang mengelola dan membagi air irigasi untuk lahan pertanian.'],
                    ],
                    'source' => 'Sumber: RKP Desa Watuagung 2027',
                ],
                'blocks' => [
                    [
                        'title' => 'Desa yang tumbuh bersama',
                        'text' => 'Watuagung mengedepankan kebersamaan dalam membangun lingkungan yang nyaman dan produktif. Pertanian, usaha rumahan, serta kegiatan sosial menjadi bagian dari kehidupan masyarakat.',
                    ],
                    [
                        'title' => 'Informasi wilayah',
                        'text' => 'Desa Watuagung berada di Kecamatan Prigen, Kabupaten Pasuruan, Provinsi Jawa Timur, pada bentang alam dataran pegunungan. Wilayahnya terdiri atas 3 dusun (Watuagung, Talang, Sekar) dengan 10 RW dan 31 RT. Batas wilayah: utara Desa Gunting (Kec. Prigen), timur Desa Karangrejo (Kec. Purwosari), selatan Desa Jatiarjo (Kec. Prigen), barat Desa Dayurejo (Kec. Prigen). Luas wilayah sedang dikonfirmasi. Sumber: RKP Desa Watuagung 2027.',
                    ],
                    [
                        'title' => 'Lembaga desa',
                        'text' => "Lembaga yang berstatus aktif:\nPemerintah Desa\nBPD\nRT/RW\nKader Posyandu\nKader Pembangunan Manusia (KPM)\nBUMDes Watuagung Bangkit\nKoperasi Desa Merah Putih\nPKK\nGapoktan/Poktan\nHIPPA\n\nSumber: RKP Desa Watuagung 2027.",
                    ],
                ],
            ],
            'contact' => [
                'address' => 'Jl. Taman Safari Indonesia II, Dusun Watuagung RT 001/RW 001, Kecamatan Prigen, Kabupaten Pasuruan, Jawa Timur',
                'hours' => 'Hari kerja, 08.00–13.00 WIB',
                'contactName' => 'Pelayanan Desa (Bu Ita)',
                'phone' => '[PLACEHOLDER]',
                'mapsEmbedUrl' => '[PLACEHOLDER]',
                'mapsLinkUrl' => '[PLACEHOLDER]',
            ],
            'history' => [
                'intro' => 'Merawat cerita masa lalu, melangkah bersama menuju masa depan.',
                'blocks' => [
                    [
                        'title' => 'Asal-usul nama Watuagung',
                        'text' => 'Nama Watuagung berasal dari sebuah batu besar menyerupai gunung yang di atasnya tumbuh pohon beringin. Sepasang satria, Mbah Singo (dari Ponorogo) dan istrinya Mbah Gambir (dari Keraton Solo), berteduh di bawahnya dan merasakan ketenteraman, lalu tempat itu dijadikan desa. Keduanya dikenang sebagai pepunden desa dan disebut memiliki 12 anak yang membuka hutan (babat alas) Desa Watudukun, yang kini dikenal sebagai Watuagung. Ringkasan ini berdasarkan tutur masyarakat yang tercatat dalam RKP Desa Watuagung 2027.',
                    ],
                    [
                        'title' => 'Tiga dusun',
                        'text' => 'Dari sejarah itu dikenal tiga dusun: Watuagung, Talang, dan Sekar.',
                    ],
                    [
                        'title' => 'Kepala desa dari masa ke masa',
                        'text' => str_replace('–', "\u{2060}–\u{2060}", implode("\n", [
                            'Oentong Koesoemodirdjo, Petinggi pendiri desa (Abad XIX)',
                            'Astro Redjo (Abad XIX)',
                            'Tirto Soebronto (s.d. 1942)',
                            'Idris Kerto Soedjono (1942–1967)',
                            'Abdul Ghani Kerto Oetomo (1967–1975)',
                            "Moh. Sa'i, Pj. (1975–1978)",
                            'Ad Hardjo Setyo Atmodjo (1979–1990)',
                            'Mgs Hardjo Sutopo (1991–1998)',
                            'Pujiharjo Mangku Projo (1999–2002)',
                            'Mokhamad Usman Ef, S.Pd. (2003–2016)',
                            'Nanang Setyawan, S.E., Pj. (2016–2017)',
                            'Drs. Kusminto (2017–2023)',
                            'Didik Hariyanto (2024–2031)',
                            '',
                            'Sumber: RKP Desa Watuagung 2027.',
                        ])),
                    ],
                ],
            ],
            // R7: pages['struktur-pemerintahan'].blocks, lib/data.ts, 5 Nov 2026.
            'structure' => [
                'blocks' => [
                    ['title' => 'Kepala Desa', 'text' => 'Didik Hariyanto · masa jabatan 2024–2031'],
                    ['title' => 'Sekretariat Desa', 'text' => 'Sekretaris Desa: Cucu Bagus Dediyanto • Kaur Umum: Tyas Ning Aris • Kaur Keuangan: Sumarto • Kaur Perencanaan: Mahmud Hady • Kaur Kesejahteraan: Gunawan'],
                    ['title' => 'Pelaksana Teknis', 'text' => "Kasi Pemerintahan: Tulus Santoso • Kasi Pelayanan: M. Tu'en"],
                    ['title' => 'Pelaksana Kewilayahan', 'text' => 'Kepala Dusun Watuagung: Sulandra • Kepala Dusun Talang: Sulis • Kepala Dusun Sekar: Yudi Prasetyawan'],
                    ['title' => 'Badan Permusyawaratan Desa', 'text' => 'Ketua: Nariono • Wakil Ketua: Katuwi S. Rizal • Sekretaris: Kasiyanto • Anggota: Tatik Hartini, Cahyo Nur Hadi, Moh. Anas Wahyudin, Khoirul Abadi. Sumber susunan di halaman ini: RKP Desa Watuagung 2027.'],
                ],
                'source' => 'Sumber: RKP Desa Watuagung 2027',
            ],
            'transparency' => [
                'intro' => 'Program prioritas dan informasi dokumen perencanaan Desa Watuagung.',
                'programs' => [
                    [
                        'title' => 'Program prioritas 2027',
                        'text' => "Kesehatan: rembuk stunting, PMT balita/ibu hamil/stunting, Posyandu remaja, tes gula darah/kolesterol/asam urat, dan penyuluhan TBC/malaria.\n\nInfrastruktur: TPS3R tahap 1, TPT dan paving Kali Terong, TPT Sentono (Talang), drainase RT 2 RW 9 (Sekar), TPT jalan lingkungan RT 3 RW 4, lanjutan pipanisasi air bersih Dusun Talang, dan rehab pendopo balai desa.\n\nPemberdayaan: festival kesenian, pembentukan Pokdarwis, pelatihan pemasaran digital, penguatan BUMDes, serta pembentukan bank sampah dan Lembaga Adat Desa.\n\nSosial: BLT Dana Desa untuk 42 keluarga penerima manfaat.\n\nSumber: RKP Desa Watuagung 2027, program tahun 2027.",
                    ],
                    [
                        'title' => 'Dokumen publik',
                        'text' => 'RKP Desa 2027 telah ditetapkan melalui Perdes Nomor 6 Tahun 2026 pada 28 September 2026. APBDes resmi akan ditampilkan setelah diterima. Angka anggaran belum ditampilkan karena masih menunggu data APBDes resmi.',
                    ],
                ],
                'budgets' => [],
            ],
        ];
    }
}
