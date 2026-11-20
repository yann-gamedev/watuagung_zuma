<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\URL;

/** Email notifikasi akun petugas (E3): verifikasi bertanda tangan dan aturan PIN. */
final class NotificationEmails
{
    public const VERIFY_HOURS = 24;

    /** PIN mudah ditebak yang ditolak walaupun 6 digit. */
    public static function isWeakPin(string $pin): bool
    {
        if (count(array_unique(str_split($pin))) === 1) return true; // 000000, 111111, ...
        $ascending = '01234567890';
        $descending = '09876543210';

        return str_contains($ascending, $pin) || str_contains($descending, $pin);
    }

    /** Sidik alamat yang diverifikasi: tautan lama mati bila email diganti. */
    public static function fingerprint(string $email): string
    {
        return hash('sha256', mb_strtolower(trim($email)));
    }

    /**
     * Halaman frontend (E4) meneruskan query apa adanya ke POST /api/v1/notifications/verify. Tanda tangan relatif
     * dengan kedaluwarsa 24 jam; tidak membutuhkan login agar bisa dibuka dari ponsel.
     */
    public static function verifyUrl(User $user): string
    {
        $signed = URL::temporarySignedRoute('notifications.verify', now()->addHours(self::VERIFY_HOURS), [
            'user' => $user->id, 'email' => self::fingerprint((string) $user->notification_email),
        ], absolute: false);

        return rtrim((string) config('app.site_url'), '/').'/verifikasi-email/?'.parse_url($signed, PHP_URL_QUERY);
    }
}
