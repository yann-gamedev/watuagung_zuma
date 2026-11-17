<?php

namespace App\Domain;

/**
 * Jenis dokumen lampiran pengajuan. Dokumen mana yang wajib per jenis surat
 * ditentukan di LetterType::requiredAttachments(), bukan di sini.
 */
enum AttachmentKind: string
{
    case Ktp = 'KTP';
    case Kk = 'KK';
    case PengantarRtRw = 'PENGANTAR_RT_RW';

    public function label(): string
    {
        return match ($this) {
            self::Ktp => 'KTP',
            self::Kk => 'Kartu Keluarga (KK)',
            self::PengantarRtRw => 'Surat Pengantar RT/RW',
        };
    }
}
