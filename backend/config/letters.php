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
    // Data kop dan penandatangan belum diterima dari desa.
    'desa' => [
        'kabupaten' => '[NAMA KABUPATEN]',
        'kecamatan' => '[NAMA KECAMATAN]',
        'alamat_kantor' => '[ALAMAT KANTOR DESA]',
        'kepala_desa' => '[NAMA KEPALA DESA]',
    ],
];
