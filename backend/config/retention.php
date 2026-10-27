<?php

return [
    // Masa simpan data pribadi permohonan berstatus akhir, dalam hari. Kosong/null = retensi MATI.
    // Diisi hanya setelah desa menetapkan angkanya; lihat `php artisan applications:purge`.
    'application_days' => env('RETENTION_APPLICATION_DAYS'),
];
