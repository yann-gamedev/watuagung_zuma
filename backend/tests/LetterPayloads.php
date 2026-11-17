<?php

namespace Tests;

use App\Domain\AttachmentKind;
use App\Domain\LetterType;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

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

    private static ?string $attachmentImage = null;

    /** Dipanggil otomatis oleh Laravel: lampiran tes tidak boleh tertulis ke storage sungguhan. */
    protected function setUpLetterPayloads(): void
    {
        Storage::fake('local');
    }

    /**
     * Tiga lampiran wajib berupa gambar polos fiktif (bukan dokumen sungguhan).
     *
     * @return array<string, UploadedFile>
     */
    protected static function letterAttachments(array $overrides = []): array
    {
        self::$attachmentImage ??= UploadedFile::fake()->image('lampiran-fiktif.jpg', 800, 600)->getContent();
        $files = [];
        foreach (AttachmentKind::cases() as $kind) {
            $files[$kind->value] = UploadedFile::fake()->createWithContent('lampiran-fiktif.jpg', self::$attachmentImage);
        }

        return array_replace($files, $overrides);
    }

    /** Pengajuan multipart seperti formulir warga: isian + `lampiran[...]`. */
    protected function submitLetter(array $payload, ?array $attachments = null): TestResponse
    {
        return $this->post('/api/v1/applications', $payload + ['lampiran' => $attachments ?? self::letterAttachments()], ['Accept' => 'application/json']);
    }

    /** @return array<string, array{string}> */
    public static function offeredLetterTypes(): array
    {
        return array_combine(LetterType::offeredValues(), array_map(fn (string $type) => [$type], LetterType::offeredValues()));
    }
}
