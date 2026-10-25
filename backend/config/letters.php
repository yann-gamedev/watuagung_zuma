<?php

use App\Domain\LetterType;

return [
    'format' => '{kode_klasifikasi}/{urut}/{kode_desa}/{bulan_romawi}/{tahun}',
    'kode_desa' => '[PLACEHOLDER]',
    'kode_klasifikasi' => array_combine(
        array_map(fn (LetterType $type) => $type->value, LetterType::cases()),
        array_map(fn (LetterType $type) => $type->classificationCode(), LetterType::cases()),
    ),
    // Halaman verifikasi publik di frontend; QR berisi URL ini + ?kode=.
    'verify_url' => env('LETTER_VERIFY_URL', 'http://localhost:3000/verifikasi/'),
    // RKP Desa Watuagung 2027, bagian 7 sarian; format kop resmi masih menunggu.
    'desa' => [
        'kabupaten' => env('LETTER_KABUPATEN', 'PASURUAN'),
        'kecamatan' => env('LETTER_KECAMATAN', 'PRIGEN'),
        'alamat_kantor' => env('LETTER_ALAMAT_KANTOR', 'Jl. Taman Safari Indonesia II, Dusun Watuagung RT 001/RW 001'),
        'kepala_desa' => env('LETTER_KEPALA_DESA', 'DIDIK HARIYANTO'),
    ],
];
