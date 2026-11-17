<?php

namespace Tests\Feature;

use App\Domain\AttachmentKind;
use App\Domain\LetterType;
use App\Models\Application;
use App\Support\AttachmentStore;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\LetterPayloads;
use Tests\TestCase;

/** Lampiran wajib pengajuan. Seluruh identitas, gambar, PDF, dan metadata dibuat fiktif. */
class ApplicationAttachmentsTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    private const KINDS = ['KTP', 'KK', 'PENGANTAR_RT_RW'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
    }

    private function image(string $extension = 'jpg', int $width = 800, int $height = 600): UploadedFile
    {
        return UploadedFile::fake()->image('KTP 0000000000001234 Warga Fiktif.'.$extension, $width, $height);
    }

    private function pdf(int $pages = 1, ?string $name = null): UploadedFile
    {
        $body = "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count $pages /Kids [] >> endobj\n";
        for ($i = 0; $i < $pages; $i++) $body .= ($i + 3)." 0 obj << /Type /Page /Parent 2 0 R >> endobj\n";

        return UploadedFile::fake()->createWithContent($name ?? 'pengantar-fiktif.pdf', $body."%%EOF\n");
    }

    private function assertNothingStored(): void
    {
        $this->assertSame(0, DB::table('applications')->count());
        $this->assertSame(0, DB::table('application_events')->count());
        $this->assertSame(0, DB::table('application_attachments')->count());
        $this->assertSame([], Storage::disk('local')->allFiles('attachments'));
    }

    public function test_required_attachments_are_defined_per_letter_type(): void
    {
        foreach (LetterType::cases() as $type) {
            $this->assertSame($type->isOffered() ? AttachmentKind::cases() : [], $type->requiredAttachments(), $type->value);
        }
        $this->assertSame(['KTP', 'Kartu Keluarga (KK)', 'Surat Pengantar RT/RW'], array_map(fn (AttachmentKind $kind) => $kind->label(), AttachmentKind::cases()));
    }

    #[DataProvider('offeredLetterTypes')]
    public function test_submission_with_three_files_succeeds(string $type): void
    {
        $files = ['KTP' => $this->image('jpg'), 'KK' => $this->image('png', 1200, 900), 'PENGANTAR_RT_RW' => $this->pdf(2)];
        $response = $this->submitLetter(self::letterPayload($type), $files)->assertCreated()
            ->assertJsonPath('lampiran', self::KINDS);
        $application = Application::where('request_id', $response->json('request_id'))->firstOrFail();
        $rows = DB::table('application_attachments')->where('application_id', $application->id)->orderBy('id')->get();
        $this->assertSame(self::KINDS, $rows->pluck('kind')->all());
        $this->assertSame(['image/jpeg', 'image/png', 'application/pdf'], $rows->pluck('original_mime')->all());
        $this->assertContains($rows[0]->stored_mime, ['image/webp', 'image/jpeg']);
        $this->assertSame('application/pdf', $rows[2]->stored_mime);
        foreach ($rows as $row) {
            $this->assertSame('applicant', $row->uploaded_by);
            $this->assertNull($row->purged_at);
            $this->assertMatchesRegularExpression('~\Aattachments/'.$application->id.'/[0-9a-f-]{36}\.bin\z~', $row->path);
            $this->assertSame(hash_file('sha256', $files[$row->kind]->getRealPath()), $row->sha256);
            $this->assertSame($row->size_bytes, strlen(AttachmentStore::contents($row)));
        }
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
    }

    public function test_public_responses_list_kinds_only(): void
    {
        $receipt = $this->submitLetter(self::letterPayload())->assertCreated();
        $status = $this->postJson('/api/v1/applications/status', ['request_id' => $receipt->json('request_id'), 'lookup_secret' => $receipt->json('lookup_secret')])
            ->assertOk()->assertJsonPath('lampiran', self::KINDS);
        $row = DB::table('application_attachments')->first();
        foreach ([$receipt, $status] as $response) {
            $this->assertSame(self::KINDS, $response->json('lampiran'));
            $body = $response->getContent();
            foreach (['attachments', '.bin', $row->sha256, 'size_bytes', 'stored_mime', 'original_mime', 'path'] as $secret) {
                $this->assertStringNotContainsString($secret, $body);
            }
        }
        // Lampiran yang dihapus retensi tidak lagi dilaporkan sebagai diterima.
        DB::table('application_attachments')->where('kind', 'KK')->update(['purged_at' => now(), 'path' => null]);
        $this->postJson('/api/v1/applications/status', ['request_id' => $receipt->json('request_id'), 'lookup_secret' => $receipt->json('lookup_secret')])
            ->assertOk()->assertJsonPath('lampiran', ['KTP', 'PENGANTAR_RT_RW']);
    }

    public function test_json_submission_without_attachments_is_rejected_per_document(): void
    {
        $this->postJson('/api/v1/applications', self::letterPayload())->assertUnprocessable()->assertJsonValidationErrors([
            'lampiran.KTP' => 'KTP wajib dilampirkan.',
            'lampiran.KK' => 'Kartu Keluarga (KK) wajib dilampirkan.',
            'lampiran.PENGANTAR_RT_RW' => 'Surat Pengantar RT/RW wajib dilampirkan.',
        ]);
        $this->assertNothingStored();
    }

    public function test_missing_file_and_form_errors_are_reported_together(): void
    {
        $files = self::letterAttachments();
        unset($files['KK']);
        $this->submitLetter(self::letterPayload('SKTM', ['nik' => '123']), $files)->assertUnprocessable()
            ->assertJsonValidationErrors(['nik' => 'NIK harus 16 digit angka.', 'lampiran.KK' => 'Kartu Keluarga (KK) wajib dilampirkan.'])
            ->assertJsonMissingValidationErrors(['lampiran.KTP', 'lampiran.PENGANTAR_RT_RW']);
        $this->assertNothingStored();
    }

    public function test_non_file_and_unknown_kind_are_rejected(): void
    {
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => 'bukan-file']))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP' => 'KTP harus berupa file.']);
        $this->submitLetter(self::letterPayload(), self::letterAttachments() + ['LAINNYA' => $this->image()])->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran' => 'Jenis lampiran tidak dikenal untuk surat ini.']);
        $this->assertNothingStored();
    }

    public function test_type_is_detected_from_content_not_extension(): void
    {
        $text = UploadedFile::fake()->createWithContent('ktp-fiktif.jpg', str_repeat("Ini teks biasa, bukan foto.\n", 50));
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $text]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP' => 'KTP harus berupa foto JPG, PNG, WebP, atau berkas PDF.']);
        $gif = UploadedFile::fake()->image('kk-fiktif.gif', 800, 600);
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KK' => $gif]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KK']);
        $this->assertNothingStored();
        // Isi JPEG dengan nama .pdf tetap diolah sebagai gambar.
        $disguised = UploadedFile::fake()->createWithContent('pengantar-fiktif.pdf', $this->image()->getContent());
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['PENGANTAR_RT_RW' => $disguised]))->assertCreated();
        $this->assertSame('image/jpeg', DB::table('application_attachments')->where('kind', 'PENGANTAR_RT_RW')->value('original_mime'));
    }

    public function test_file_over_five_megabytes_is_rejected(): void
    {
        $limit = UploadedFile::fake()->createWithContent('batas.pdf', str_pad($this->pdf()->getContent(), AttachmentStore::MAX_BYTES, "\n"));
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $limit]))->assertCreated();
        $over = UploadedFile::fake()->createWithContent('lebih.pdf', str_pad($this->pdf()->getContent(), AttachmentStore::MAX_BYTES + 1, "\n"));
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $over]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP' => 'Ukuran KTP maksimal 5 MB.']);
        $this->assertSame(1, DB::table('applications')->count());
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
    }

    public function test_small_and_oversized_images_are_rejected(): void
    {
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $this->image('jpg', 1200, 599)]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP' => 'Foto terlalu kecil untuk dibaca.']);
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $this->image('png', 6001, 600)]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP' => 'Foto KTP terlalu besar.']);
        $this->assertNothingStored();
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $this->image('jpg', 600, 600)]))->assertCreated();
    }

    public function test_wide_image_is_resized_to_two_thousand_pixels(): void
    {
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $this->image('jpg', 3000, 1500)]))->assertCreated();
        $size = getimagesizefromstring(AttachmentStore::contents(DB::table('application_attachments')->where('kind', 'KTP')->first()));
        $this->assertSame([2000, 1000], [$size[0], $size[1]]);
    }

    public function test_pdf_rules(): void
    {
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KK' => $this->pdf(11)]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KK' => 'PDF Kartu Keluarga (KK) maksimal 10 halaman.']);
        $this->assertNothingStored();
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KK' => $this->pdf(10)]))->assertCreated();
        // Halaman dalam stream terkompresi tidak terhitung: batas dilewati, berkas tetap diterima.
        $this->assertNull(AttachmentStore::pdfPageCount("%PDF-1.5\n1 0 obj << /Type /ObjStm /N 3 >> stream\n...\nendstream endobj\n%%EOF"));
        $this->assertSame(10, AttachmentStore::pdfPageCount($this->pdf(10)->getContent()));
    }

    public function test_image_metadata_is_removed(): void
    {
        if (! function_exists('exif_read_data')) $this->markTestSkipped('Ekstensi exif diperlukan untuk membuktikan fixture JPEG ber-EXIF/GPS.');
        // TIFF little-endian: IFD0 berisi ImageDescription dan pointer GPS; koordinat fiktif 0,0.
        $description = "FIXTURE-FIKTIF\0";
        $gpsOffset = 38 + strlen($description);
        $rationalOffset = $gpsOffset + 54;
        $entry = fn ($tag, $type, $count, $value) => pack('vvVV', $tag, $type, $count, $value);
        $tiff = 'II'.pack('vV', 42, 8).pack('v', 2)
            .$entry(0x010e, 2, strlen($description), 38).$entry(0x8825, 4, 1, $gpsOffset).pack('V', 0).$description
            .pack('v', 4).$entry(1, 2, 2, ord('N')).$entry(2, 5, 3, $rationalOffset)
            .$entry(3, 2, 2, ord('E')).$entry(4, 5, 3, $rationalOffset + 24).pack('V', 0)
            .str_repeat(pack('VV', 0, 1), 6);
        $exif = "Exif\0\0".$tiff;
        $jpeg = $this->image('jpg', 1000, 700)->getContent();
        $fixture = UploadedFile::fake()->createWithContent('exif-fiktif.jpg', substr($jpeg, 0, 2)."\xff\xe1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2));
        $metadata = exif_read_data($fixture->getRealPath());
        $this->assertSame('FIXTURE-FIKTIF', $metadata['ImageDescription']);
        $this->assertSame(['0/1', '0/1', '0/1'], $metadata['GPSLatitude']);

        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $fixture]))->assertCreated();
        $row = DB::table('application_attachments')->where('kind', 'KTP')->first();
        $bytes = AttachmentStore::contents($row);
        $this->assertNotFalse(getimagesizefromstring($bytes));
        foreach (['Exif', 'EXIF', 'FIXTURE-FIKTIF'] as $marker) $this->assertStringNotContainsString($marker, $bytes);
        if ($row->stored_mime === 'image/jpeg') {
            $path = tempnam(sys_get_temp_dir(), 'lampiran');
            file_put_contents($path, $bytes);
            $stored = exif_read_data($path);
            unlink($path);
            $this->assertArrayNotHasKey('GPSLatitude', $stored);
            $this->assertArrayNotHasKey('ImageDescription', $stored);
        }
    }

    public function test_disk_content_is_encrypted_and_decryptable(): void
    {
        $pdf = $this->pdf(1);
        $jpeg = $this->image('jpg', 900, 700);
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['KTP' => $jpeg, 'PENGANTAR_RT_RW' => $pdf]))->assertCreated();
        foreach (DB::table('application_attachments')->get() as $row) {
            $raw = Storage::disk('local')->get($row->path);
            $this->assertFalse(@getimagesizefromstring($raw));
            $this->assertStringNotContainsString('%PDF-', $raw);
            $this->assertStringNotContainsString('JFIF', $raw);
            $this->assertNotSame($row->sha256, hash('sha256', $raw));
            $plain = AttachmentStore::contents($row);
            if ($row->kind === 'PENGANTAR_RT_RW') {
                $this->assertSame($pdf->getContent(), $plain);
                $this->assertSame($row->sha256, hash('sha256', $plain));
            } else {
                $this->assertNotFalse(getimagesizefromstring($plain));
            }
        }
    }

    public function test_original_file_name_is_never_stored(): void
    {
        $name = 'KTP 0000000000001234 Warga Fiktif';
        $files = ['KTP' => $this->image('jpg'), 'KK' => $this->image('png'), 'PENGANTAR_RT_RW' => $this->pdf(1, $name.'.pdf')];
        $response = $this->submitLetter(self::letterPayload(), $files)->assertCreated();
        $this->assertStringNotContainsString('Warga Fiktif.', $response->getContent());
        $haystack = json_encode([
            DB::table('application_attachments')->get(), DB::table('application_events')->get(), DB::table('audit_logs')->get(),
            Storage::disk('local')->allFiles(), Storage::disk('local')->allDirectories(),
        ]);
        $this->assertStringNotContainsString($name, $haystack);
        $this->assertStringNotContainsString('0000000000001234', $haystack);
        foreach (DB::table('application_attachments')->get() as $row) {
            $this->assertStringNotContainsString($name, AttachmentStore::contents($row));
            $this->assertStringEndsWith('.bin', $row->path);
        }
    }

    public function test_failure_midway_leaves_no_rows_or_files(): void
    {
        // Gagal pada baris lampiran kedua: satu file dan satu baris sudah tertulis saat itu.
        $inserts = 0;
        $failing = true;
        DB::connection()->beforeExecuting(function (string $query, array $bindings, $connection) use (&$inserts, &$failing): void {
            if ($failing && preg_match('/^insert into [`"]application_attachments[`"]/i', $query) && ++$inserts === 2) {
                throw new QueryException($connection->getName(), $query, $bindings, new PDOException('Test failure'));
            }
        });
        $this->submitLetter(self::letterPayload())->assertStatus(500);
        $this->assertSame(2, $inserts);
        $this->assertNothingStored();
        $this->assertSame([], Storage::disk('local')->allDirectories('attachments'));

        $failing = false;
        $this->submitLetter(self::letterPayload())->assertCreated();
        $this->assertSame(3, DB::table('application_attachments')->count());
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
    }

    public function test_unreadable_image_found_while_storing_rolls_back(): void
    {
        // Kepala PNG sah (lolos pemeriksaan awal) tetapi data piksel terpotong: gagal saat di-decode di dalam transaksi.
        $broken = UploadedFile::fake()->createWithContent('rusak.png', substr($this->image('png', 800, 600)->getContent(), 0, 60));
        $this->submitLetter(self::letterPayload(), self::letterAttachments(['PENGANTAR_RT_RW' => $broken]))->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.PENGANTAR_RT_RW' => 'Surat Pengantar RT/RW tidak dapat dibaca.']);
        $this->assertNothingStored();
    }

    public function test_storage_write_failure_rolls_back(): void
    {
        $real = Storage::disk('local');
        $disk = \Mockery::mock($real)->makePartial();
        $calls = 0;
        $disk->shouldReceive('put')->andReturnUsing(function (...$arguments) use ($real, &$calls) {
            return ++$calls === 3 ? false : $real->put(...$arguments);
        });
        Storage::set('local', $disk);
        $this->submitLetter(self::letterPayload())->assertStatus(500);
        $this->assertSame(3, $calls);
        Storage::set('local', $real);
        $this->assertNothingStored();
    }

    public function test_deleting_application_cascades_attachment_rows(): void
    {
        $id = $this->submitLetter(self::letterPayload())->assertCreated()->json('request_id');
        DB::table('application_events')->delete();
        Application::where('request_id', $id)->firstOrFail()->delete();
        $this->assertSame(0, DB::table('application_attachments')->count());
    }

    public function test_submission_throttle_still_applies(): void
    {
        $this->withMiddleware(ThrottleRequests::class);
        for ($i = 0; $i < 5; $i++) $this->postJson('/api/v1/applications', [])->assertUnprocessable();
        $this->submitLetter(self::letterPayload())->assertTooManyRequests();
        $this->assertNothingStored();
    }
}
