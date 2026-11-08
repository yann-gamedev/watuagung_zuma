<?php

use App\Domain\LetterType;

return [
    'neighborhood_approval' => env('LETTER_NEIGHBORHOOD_APPROVAL', false),
    // Format contoh surat desa, mis. 470/12/424.314.2.02/2026; satu urutan per tahun untuk semua jenis.
    'format' => '{kode_klasifikasi}/{urut}/{kode_desa}/{tahun}',
    'kode_desa' => '424.314.2.02',
    'kode_klasifikasi' => array_combine(
        array_map(fn (LetterType $type) => $type->value, LetterType::cases()),
        array_map(fn (LetterType $type) => $type->classificationCode(), LetterType::cases()),
    ),
    // Halaman verifikasi publik di frontend; QR berisi URL ini + ?kode=.
    'verify_url' => env('LETTER_VERIFY_URL', 'http://localhost:3000/verifikasi/'),
    // Identitas dari RKP Desa 2027; alamat kop sesuai contoh surat desa (S2).
    'desa' => [
        'kabupaten' => env('LETTER_KABUPATEN', 'PASURUAN'),
        'kecamatan' => env('LETTER_KECAMATAN', 'PRIGEN'),
        'alamat_kantor' => env('LETTER_ALAMAT_KANTOR', 'Jl. Taman Safari II No. 01 Desa Watuagung Kec. Prigen Tlp. (0343) 7660001 Kode Pos 67157'),
        'kepala_desa' => env('LETTER_KEPALA_DESA', 'DIDIK HARIYANTO'),
    ],
];
