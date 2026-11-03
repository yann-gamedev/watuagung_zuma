<?php

namespace Database\Seeders;

final class SiteSectionDefaults
{
    // Source: lib/data.ts at bb6861e, 3 Nov 2026. Page headings and profileDetails remain frontend-owned.
    public static function data(): array
    {
        return [
            'profile' => [
                'intro' => 'Rumah bagi semangat gotong royong, alam yang lestari, dan masyarakat yang terus bertumbuh.',
                'blocks' => [
                    [
                        'title' => 'Desa yang tumbuh bersama',
                        'text' => 'Watuagung mengedepankan kebersamaan dalam membangun lingkungan yang nyaman dan produktif. Pertanian, usaha rumahan, serta kegiatan sosial menjadi bagian dari kehidupan masyarakat.',
                    ],
                    [
                        'title' => 'Informasi wilayah',
                        'text' => 'Desa Watuagung berada di Kecamatan Prigen, Kabupaten Pasuruan, Provinsi Jawa Timur, pada bentang alam dataran pegunungan dan berjarak ±11 km dari kecamatan. Wilayahnya terdiri atas 3 dusun (Watuagung, Talang, Sekar) dengan 10 RW dan 31 RT. Batas wilayah: utara Desa Gunting (Kec. Prigen), timur Desa Karangrejo (Kec. Purwosari), selatan Desa Jatiarjo (Kec. Prigen), barat Desa Dayurejo (Kec. Prigen). Luas wilayah sedang dikonfirmasi. Sumber: RKP Desa Watuagung 2027.',
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
        ];
    }
}
