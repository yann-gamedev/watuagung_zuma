<?php

namespace App\Domain;

/**
 * Satu-satunya sumber aturan alur status permohonan dan wewenang per peran.
 * Controller hanya memanggil method di sini; jangan menyalin tabel ini ke tempat lain.
 */
enum ApplicationStatus: string
{
    case Submitted = 'SUBMITTED';
    case Verified = 'VERIFIED';
    case Processing = 'PROCESSING';
    case WaitingApproval = 'WAITING_APPROVAL';
    case Approved = 'APPROVED';
    case ReadyForPickup = 'READY_FOR_PICKUP';
    case Completed = 'COMPLETED';
    case Rejected = 'REJECTED';
    case NeedRevision = 'NEED_REVISION';

    /** Peran yang boleh masuk panel petugas. */
    public const PANEL_ROLES = ['staff', 'village_head', 'admin'];

    private const OFFICE = ['staff', 'admin'];
    private const HEAD = ['village_head'];

    /**
     * Status asal => [status tujuan => peran yang berwenang].
     *
     * @return array<string, array<string, list<string>>>
     */
    public static function rules(): array
    {
        return [
            'SUBMITTED' => ['VERIFIED' => self::OFFICE, 'NEED_REVISION' => self::OFFICE, 'REJECTED' => self::OFFICE],
            'NEED_REVISION' => ['VERIFIED' => self::OFFICE, 'REJECTED' => self::OFFICE],
            'VERIFIED' => ['PROCESSING' => self::OFFICE, 'NEED_REVISION' => self::OFFICE, 'REJECTED' => self::OFFICE],
            'PROCESSING' => ['WAITING_APPROVAL' => self::OFFICE, 'NEED_REVISION' => self::OFFICE, 'REJECTED' => self::OFFICE],
            // Admin sengaja tidak boleh memutuskan persetujuan.
            'WAITING_APPROVAL' => ['APPROVED' => self::HEAD, 'REJECTED' => self::HEAD, 'NEED_REVISION' => self::HEAD],
            'APPROVED' => ['READY_FOR_PICKUP' => self::OFFICE],
            'READY_FOR_PICKUP' => ['COMPLETED' => self::OFFICE],
        ];
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $status) => $status->value, self::cases());
    }

    public static function isPanelRole(?string $role): bool
    {
        return in_array($role, self::PANEL_ROLES, true);
    }

    /** Apakah perpindahan ini ada dalam alur, tanpa melihat peran. */
    public static function isTransition(string $from, string $to): bool
    {
        return isset(self::rules()[$from][$to]);
    }

    public static function canTransition(string $from, string $to, ?string $role): bool
    {
        return in_array($role, self::rules()[$from][$to] ?? [], true);
    }

    /** @return list<string> */
    public static function allowedFor(string $from, ?string $role): array
    {
        return array_keys(array_filter(self::rules()[$from] ?? [], fn (array $roles) => in_array($role, $roles, true)));
    }

    public static function requiresNote(string $to): bool
    {
        return in_array($to, [self::Rejected->value, self::NeedRevision->value], true);
    }
}
