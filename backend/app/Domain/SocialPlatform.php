<?php

namespace App\Domain;

/**
 * Tautan media sosial opsional per berita. Hanya https dan host resmi platform agar tautan publik
 * tidak bisa diarahkan ke situs lain (phishing) atau skema berbahaya (javascript:, data:).
 */
enum SocialPlatform: string
{
    case Instagram = 'instagram';
    case Tiktok = 'tiktok';
    case Youtube = 'youtube';
    case Facebook = 'facebook';

    public function column(): string
    {
        return $this->value.'_url';
    }

    public function label(): string
    {
        return match ($this) {
            self::Instagram => 'Instagram',
            self::Tiktok => 'TikTok',
            self::Youtube => 'YouTube',
            self::Facebook => 'Facebook',
        };
    }

    /** @return list<string> */
    public function hosts(): array
    {
        return match ($this) {
            self::Instagram => ['instagram.com', 'www.instagram.com'],
            self::Tiktok => ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
            self::Youtube => ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
            self::Facebook => ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch'],
        };
    }

    public function accepts(string $url): bool
    {
        $parts = parse_url($url);
        if ($parts === false || ($parts['scheme'] ?? null) !== 'https' || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) return false;
        return in_array(strtolower($parts['host'] ?? ''), $this->hosts(), true);
    }
}
