<?php

namespace App\Domain;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Satu-satunya pemicu notifikasi perubahan status permohonan. Wajib dikirim di SETIAP tempat status
 * berubah (transisi petugas, unggah scan, unduhan pertama, letters:expire-downloads), tepat setelah baris
 * application_events dibuat. Dikirim setelah commit: transaksi yang dibatalkan tidak memicu email.
 *
 * Payload hanya ID dan kode status. Antrean database menyimpan payload tanpa enkripsi, jadi email,
 * catatan, dan data pribadi lain dibaca ulang oleh listener dari kolom terenkripsi.
 */
final class ApplicationStatusChanged implements ShouldDispatchAfterCommit
{
    use Dispatchable;

    public function __construct(
        public readonly int $applicationId,
        public readonly string $fromStatus,
        public readonly string $toStatus,
        public readonly int $eventId,
    ) {}
}
