<?php

namespace App\Domain;

/**
 * Kode akses cek status: WAD-XXXX-XXXX (8 angka acak).
 * Ruang kode kecil, jadi hash memakai HMAC dengan APP_KEY (dump DB saja tidak cukup untuk menebak)
 * dan percobaan salah dikunci per nomor pengajuan di ApplicationController::status.
 */
final class AccessCode
{
    public static function generate(): string
    {
        $digits = sprintf('%08d', random_int(0, 99_999_999));
        return 'WAD-'.substr($digits, 0, 4).'-'.substr($digits, 4);
    }

    public static function hash(string $code): string
    {
        return hash_hmac('sha256', self::normalize($code) ?? $code, (string) config('app.key'));
    }

    /** Terima "wad 4821 0937", "WAD48210937", atau "4821-0937"; null jika bukan format baru. */
    public static function normalize(string $input): ?string
    {
        $compact = preg_replace('/[^0-9A-Z]/', '', strtoupper($input));
        return preg_match('/\A(?:WAD)?([0-9]{8})\z/', $compact, $m) ? 'WAD'.$m[1] : null;
    }

    public static function matches(string $input, string $storedHash): bool
    {
        // Kode lama (48 karakter acak) tetap berlaku dengan hash SHA-256 polos.
        $candidate = self::normalize($input) !== null ? self::hash($input) : hash('sha256', $input);
        return hash_equals($storedHash, $candidate);
    }
}
