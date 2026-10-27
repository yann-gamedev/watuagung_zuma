<?php

namespace App\Domain;

/** Kategori berita (keputusan C-7, docs/PROMPTS-CMS-BERITA.md). */
enum PostCategory: string
{
    case KegiatanDesa = 'kegiatan_desa';
    case Pemerintahan = 'pemerintahan';
    case Pembangunan = 'pembangunan';
    case Pemberdayaan = 'pemberdayaan';
    case LayananPublik = 'layanan_publik';
    case EkonomiLokal = 'ekonomi_lokal';
    case Pengumuman = 'pengumuman';

    public function label(): string
    {
        return match ($this) {
            self::KegiatanDesa => 'Kegiatan Desa',
            self::Pemerintahan => 'Pemerintahan',
            self::Pembangunan => 'Pembangunan',
            self::Pemberdayaan => 'Pemberdayaan',
            self::LayananPublik => 'Layanan Publik',
            self::EkonomiLokal => 'Ekonomi Lokal',
            self::Pengumuman => 'Pengumuman',
        };
    }
}
