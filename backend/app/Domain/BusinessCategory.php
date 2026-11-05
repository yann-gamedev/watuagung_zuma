<?php

namespace App\Domain;

/** Kategori UMKM warga. Disimpan sebagai string agar daftar bisa berubah tanpa migration. */
enum BusinessCategory: string
{
    case MakananMinuman = 'makanan_minuman';
    case Kerajinan = 'kerajinan';
    case PertanianPeternakan = 'pertanian_peternakan';
    case Jasa = 'jasa';
    case Perdagangan = 'perdagangan';
    case Lainnya = 'lainnya';

    public function label(): string
    {
        return match ($this) {
            self::MakananMinuman => 'Makanan & Minuman',
            self::Kerajinan => 'Kerajinan',
            self::PertanianPeternakan => 'Pertanian & Peternakan',
            self::Jasa => 'Jasa',
            self::Perdagangan => 'Perdagangan',
            self::Lainnya => 'Lainnya',
        };
    }
}
