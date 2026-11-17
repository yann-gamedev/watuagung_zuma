<?php

return [
    // Masa simpan data pribadi permohonan berstatus akhir, dalam hari. Kosong/null = retensi MATI.
    // Diisi hanya setelah desa menetapkan angkanya; lihat `php artisan applications:purge`.
    'application_days' => env('RETENTION_APPLICATION_DAYS'),
    // Masa simpan lampiran persyaratan (KTP, KK, pengantar RT/RW) setelah permohonan COMPLETED/REJECTED, dalam hari.
    // Tidak diset = 30. Diset kosong atau 0 = MATI. Lihat `php artisan attachments:purge`.
    'attachment_days' => env('ATTACHMENT_RETENTION_DAYS', 30),
];
