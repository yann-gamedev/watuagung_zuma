<?php

namespace App\Support;

use App\Domain\ApplicationStatus;
use App\Domain\LetterType;
use App\Models\Application;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

/** Aturan dan teks email status pemohon (E1). */
final class ApplicantEmail
{
    public static function canNotify(Application $application): bool
    {
        return filled($application->email)
            && $application->email_consent_at !== null
            && $application->email_unsubscribed_at === null
            && $application->purged_at === null;
    }

    public static function letterTypeName(LetterType $type): string
    {
        return str_replace('Ktp/kk', 'KTP/KK', ucfirst(mb_strtolower($type->title())));
    }

    /** Satu kalimat langkah berikutnya; tanpa data pribadi. */
    public static function statusLine(ApplicationStatus $status, ?Carbon $downloadUntil = null): string
    {
        return match ($status) {
            ApplicationStatus::Submitted => 'Pengajuan Anda sudah diterima.',
            ApplicationStatus::RtApproved => 'Ketua RT telah menyetujui. Permohonan menunggu pemeriksaan Ketua RW.',
            ApplicationStatus::RwApproved => 'Ketua RT dan RW telah menyetujui. Permohonan menunggu verifikasi petugas kantor desa.',
            ApplicationStatus::Verified => 'Data pengajuan Anda sudah diverifikasi petugas.',
            ApplicationStatus::Processing => 'Surat Anda sedang disiapkan.',
            ApplicationStatus::WaitingApproval => 'Surat Anda menunggu persetujuan Kepala Desa.',
            ApplicationStatus::Approved => 'Surat Anda disetujui dan sedang ditandatangani Kepala Desa.',
            ApplicationStatus::ReadyForPickup => $downloadUntil
                ? 'Surat Anda sudah bisa diunduh di halaman cek status sampai '.self::date($downloadUntil).'.'
                : 'Surat Anda sudah bisa diunduh di halaman cek status.',
            ApplicationStatus::Completed => 'Permohonan Anda sudah selesai.',
            ApplicationStatus::Rejected => 'Permohonan Anda ditolak. Baca catatan petugas dan hubungi kantor desa untuk penjelasan.',
            ApplicationStatus::NeedRevision => 'Permohonan Anda perlu diperbaiki. Baca catatan petugas, lalu hubungi kantor desa atau perbaiki lampiran di halaman cek status.',
        };
    }

    /** Halaman cek status warga; kode akses TIDAK pernah ikut di URL. */
    public static function statusUrl(string $requestId): string
    {
        return self::siteUrl().'/pelayanan/status/?'.http_build_query(['id' => $requestId]);
    }

    /**
     * Halaman frontend /berhenti-email/ (E2) membawa query bertanda tangan yang sama ke
     * POST /api/v1/applications/unsubscribe. Tanda tangan relatif: tidak bergantung host/https di belakang proxy.
     */
    public static function unsubscribeUrl(string $requestId): string
    {
        $signed = URL::signedRoute('applications.unsubscribe', ['id' => $requestId], absolute: false);

        return self::siteUrl().'/berhenti-email/?'.parse_url($signed, PHP_URL_QUERY);
    }

    /** Untuk log: "w•••@example.com". */
    public static function mask(?string $email): string
    {
        if (! is_string($email) || ! str_contains($email, '@')) return '(kosong)';
        [$local, $domain] = explode('@', $email, 2);

        return mb_substr($local, 0, 1).'•••@'.$domain;
    }

    /** "20 November 2026" (WIB). APP_LOCALE bawaan "en", jadi nama bulan ditulis sendiri. */
    private static function date(Carbon $date): string
    {
        $months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        $local = $date->copy()->timezone('Asia/Jakarta');

        return $local->day.' '.$months[$local->month - 1].' '.$local->year;
    }

    private static function siteUrl(): string
    {
        return rtrim((string) config('app.site_url'), '/');
    }
}
