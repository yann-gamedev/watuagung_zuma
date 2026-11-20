<?php

namespace App\Listeners;

use App\Domain\ApplicationStatusChanged;
use App\Support\ApprovalLinks;

/**
 * Sinkron (bukan antrean): begitu status meninggalkan WAITING_APPROVAL lewat jalur mana pun, semua tautan
 * persetujuan terbuka untuk permohonan itu mati. ApprovalLinks::resolve() juga memeriksa status saat dipakai.
 */
class RevokeApprovalLinks
{
    public function handle(ApplicationStatusChanged $event): void
    {
        if ($event->fromStatus === 'WAITING_APPROVAL') ApprovalLinks::revokeOpen($event->applicationId);
    }
}
