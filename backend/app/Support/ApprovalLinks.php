<?php

namespace App\Support;

use App\Models\Application;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Tautan persetujuan kepala desa lewat email (E3, docs/PROMPTS-EMAIL.md § Email kepala desa).
 * Token acak 32 byte hanya ada di email; database menyimpan SHA-256. Tautan sekali pakai, 72 jam, terikat ke satu
 * permohonan dan satu akun, dan hanya berlaku saat status WAITING_APPROVAL. Membuka tautan tidak pernah mengubah
 * status: keputusan hanya lewat POST dengan PIN.
 */
final class ApprovalLinks
{
    public const TTL_HOURS = 72;
    public const MAX_PIN_ATTEMPTS = 5;

    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    /** Membuat tautan dan mengembalikan token mentah (dipakai sekali untuk email, tidak disimpan). */
    public static function issue(Application $application, User $head): string
    {
        $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        DB::table('approval_links')->insert([
            'application_id' => $application->id, 'user_id' => $head->id, 'token_hash' => self::hash($token),
            'expires_at' => now()->addHours(self::TTL_HOURS), 'created_at' => now(),
        ]);
        DB::table('audit_logs')->insert(['user_id' => $head->id, 'action' => 'approval_link.created', 'subject_type' => 'application', 'subject_id' => $application->id, 'created_at' => now()]);

        return $token;
    }

    /** Mencabut semua tautan terbuka untuk permohonan ini (status berubah lewat jalur mana pun). */
    public static function revokeOpen(int $applicationId): int
    {
        return DB::table('approval_links')->where('application_id', $applicationId)
            ->whereNull('used_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    public static function revokeOpenForUser(int $userId): int
    {
        return DB::table('approval_links')->where('user_id', $userId)
            ->whereNull('used_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    /**
     * Baris tautan + permohonan + kepala desa bila tautan masih berlaku; null bila tidak dikenal, kedaluwarsa,
     * terpakai, dicabut, dikunci, status sudah bukan WAITING_APPROVAL, atau akun tidak lagi memenuhi syarat.
     *
     * @return array{0: object, 1: Application, 2: User}|null
     */
    public static function resolve(string $token, bool $lock = false): ?array
    {
        $query = DB::table('approval_links')->where('token_hash', self::hash($token));
        $link = $lock ? $query->lockForUpdate()->first() : $query->first();
        if (! $link || $link->used_at !== null || $link->revoked_at !== null || $link->locked_at !== null) return null;
        if (now()->greaterThanOrEqualTo($link->expires_at)) return null;
        $application = Application::find($link->application_id);
        $head = User::find($link->user_id);
        if (! $application || $application->status !== 'WAITING_APPROVAL' || ! $head || ! $head->canApproveByEmail()) return null;

        return [$link, $application, $head];
    }

    /** Halaman konfirmasi frontend (E4). `pilih` hanya memilih opsi awal; tidak pernah memutuskan. */
    public static function url(string $token, ?string $choice = null): string
    {
        $query = ['t' => $token] + ($choice ? ['pilih' => $choice] : []);

        return rtrim((string) config('app.site_url'), '/').'/persetujuan/?'.http_build_query($query);
    }

    /** Nama petugas yang terakhir memverifikasi (VERIFIED), untuk ringkasan email/halaman konfirmasi. */
    public static function verifierName(Application $application): ?string
    {
        return DB::table('application_events')->join('users', 'users.id', '=', 'application_events.user_id')
            ->where('application_events.application_id', $application->id)->where('application_events.to_status', 'VERIFIED')
            ->orderByDesc('application_events.id')->value('users.name');
    }

    public static function letterNumber(Application $application): ?string
    {
        return DB::table('letter_numbers')->where('application_id', $application->id)->where('status', 'issued')->value('number');
    }
}
