<?php

namespace App\Domain;

/**
 * Jenis surat, judul resmi, dan isian khusus per jenis (docs/PROMPTS-SURAT.md).
 * SKU dan KTP_KK tetap ada untuk data lama, tetapi tidak dapat diajukan lagi.
 */
enum LetterType: string
{
    case Sku = 'SKU';
    case Domisili = 'DOMISILI';
    case Sktm = 'SKTM';
    case KtpKk = 'KTP_KK';
    case BelumMenikah = 'BELUM_MENIKAH';
    case Keramaian = 'KERAMAIAN';
    case Kehilangan = 'KEHILANGAN';
    case Umum = 'UMUM';

    /** Isian yang hanya milik jenis tertentu; dikirim untuk jenis lain = 422. */
    public const SPECIFIC_FIELDS = [
        'nama_usaha', 'jenis_usaha', 'alamat_usaha',
        'barang_hilang', 'acara', 'tempat_acara', 'tanggal_mulai', 'tanggal_selesai', 'jenis_hiburan', 'isi_keterangan',
    ];

    /** Batas rentang hari izin keramaian, termasuk hari mulai dan selesai. */
    public const MAX_EVENT_DAYS = 7;

    /** Judul surat persis seperti di contoh surat desa. */
    public function title(): string
    {
        return match ($this) {
            self::Sku => 'SURAT KETERANGAN USAHA',
            self::Domisili => 'SURAT KETERANGAN DOMISILI',
            self::Sktm => 'SURAT KETERANGAN TIDAK MAMPU',
            self::KtpKk => 'SURAT PENGANTAR KTP/KK',
            self::BelumMenikah => 'SURAT KETERANGAN BELUM MENIKAH',
            self::Keramaian => 'SURAT KETERANGAN IZIN KERAMAIAN',
            self::Kehilangan => 'SURAT KETERANGAN KEHILANGAN',
            self::Umum => 'SURAT KETERANGAN',
        };
    }

    public function isOffered(): bool
    {
        return ! in_array($this, [self::Sku, self::KtpKk], true);
    }

    /** @return list<string> */
    public static function offeredValues(): array
    {
        return array_values(array_map(fn (self $type) => $type->value, array_filter(self::cases(), fn (self $type) => $type->isOffered())));
    }

    /** Izin keramaian tidak mencetak agama, status perkawinan, pendidikan, dan pekerjaan. */
    public function requiresFullPersonalData(): bool
    {
        return $this !== self::Keramaian;
    }

    /** @return list<string> */
    public function specificFields(): array
    {
        return match ($this) {
            self::Sku => ['nama_usaha', 'jenis_usaha', 'alamat_usaha'],
            self::Kehilangan => ['barang_hilang'],
            self::Keramaian => ['acara', 'tempat_acara', 'tanggal_mulai', 'tanggal_selesai', 'jenis_hiburan'],
            self::Umum => ['isi_keterangan'],
            default => [],
        };
    }

    /** Kode klasifikasi nomor surat; 470 untuk semua jenis, termasuk data lama. */
    public function classificationCode(): string
    {
        return '470';
    }

    public function requiresNeighborhoodApproval(): bool
    {
        // Bila diaktifkan, semua surat keterangan diri melalui RT/RW; SKU tetap langsung ke kantor.
        return $this !== self::Sku && (bool) config('letters.neighborhood_approval', false);
    }

    /** @return list<string> */
    public static function neighborhoodValues(): array
    {
        return array_values(array_map(fn (self $type) => $type->value, array_filter(self::cases(), fn (self $type) => $type->requiresNeighborhoodApproval())));
    }
}
