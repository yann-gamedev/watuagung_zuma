<?php

namespace Tests;

use App\Domain\LetterType;

/** Payload pengajuan valid per jenis surat. Seluruh identitas fiktif. */
trait LetterPayloads
{
    protected static function letterPayload(string $type = 'DOMISILI', array $overrides = []): array
    {
        $personal = $type === LetterType::Keramaian->value ? [] : [
            'agama' => 'Islam', 'status_perkawinan' => 'Belum Kawin',
            'pendidikan' => 'SLTA/Sederajat', 'pekerjaan' => 'Karyawan Swasta',
        ];
        $specific = match ($type) {
            'KEHILANGAN' => ['barang_hilang' => 'KTP'],
            'KERAMAIAN' => [
                'acara' => 'Hajatan pernikahan fiktif', 'tempat_acara' => 'Rumah pemohon',
                'tanggal_mulai' => now()->addDays(3)->format('Y-m-d'), 'tanggal_selesai' => now()->addDays(4)->format('Y-m-d'),
                'jenis_hiburan' => 'Organ tunggal',
            ],
            'UMUM' => ['isi_keterangan' => 'Orang tersebut bekerja di kota fiktif.'],
            default => [],
        };

        return array_replace([
            'jenis_surat' => $type, 'nama' => 'Warga Fiktif',
            'nik' => '0000000000001234', 'no_kk' => '0000000000005678',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Perempuan',
            'dusun' => 'Talang', 'alamat' => 'Alamat fiktif', 'rt' => '1', 'rw' => '2', 'telepon' => '08000000000',
            'kewarganegaraan' => 'WNI', 'keperluan' => 'Keperluan fiktif',
        ] + $personal + $specific, $overrides);
    }

    /** @return array<string, array{string}> */
    public static function offeredLetterTypes(): array
    {
        return array_combine(LetterType::offeredValues(), array_map(fn (string $type) => [$type], LetterType::offeredValues()));
    }
}
