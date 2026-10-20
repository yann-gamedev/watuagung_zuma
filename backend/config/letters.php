<?php

use App\Domain\LetterType;

return [
    'format' => '{kode_klasifikasi}/{urut}/{kode_desa}/{bulan_romawi}/{tahun}',
    'kode_desa' => '[PLACEHOLDER]',
    'kode_klasifikasi' => array_combine(
        array_map(fn (LetterType $type) => $type->value, LetterType::cases()),
        array_map(fn (LetterType $type) => $type->classificationCode(), LetterType::cases()),
    ),
];
