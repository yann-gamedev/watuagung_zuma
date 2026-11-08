<?php

namespace Tests\Feature;

use App\Domain\Letter;
use App\Domain\LetterType;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;
use Tests\LetterPayloads;
use Symfony\Component\Process\Process;

/** All identities here are fictional. */
class LetterPdfTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function application(array $attributes = []): Application
    {
        return Application::create(array_replace([
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'kode-fiktif'),
            'jenis_surat' => 'SKU', 'nama' => 'Siti Wulandari',
            'nik' => '0000000000000001', 'no_kk' => '0000000000000002',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-02',
            'jenis_kelamin' => 'Perempuan', 'alamat' => 'Jalan Fiktif 9',
            'rt' => '001', 'rw' => '002', 'telepon' => '08000000000',
            'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Pasar Fiktif',
            'keperluan' => 'Keperluan fiktif', 'status' => 'PROCESSING',
        ], $attributes));
    }

    private function act(string $role = 'staff', array $abilities = ['applications:manage']): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002']);
        Sanctum::actingAs($user, $abilities);

        return $user;
    }

    private function change(Application $application, string $status, ?string $note = null)
    {
        return $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => $status, 'catatan' => $note]);
    }

    /** PROCESSING → WAITING_APPROVAL (staff) → APPROVED (Kepala Desa). */
    private function approved(string $type = 'SKU'): Application
    {
        $application = $this->application(['jenis_surat' => $type]);
        $this->act();
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $this->act('village_head');
        $this->change($application, 'APPROVED')->assertOk();

        return $application->fresh();
    }

    private function pdf(Application $application)
    {
        return $this->get('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf');
    }

    private function upload(Application $application, UploadedFile $file)
    {
        return $this->post('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf', ['file' => $file], ['Accept' => 'application/json']);
    }

    private function fakePdf(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('surat.pdf', "%PDF-1.4\n% surat manual fiktif\n%%EOF\n");
    }

    public function test_draft_is_available_to_office_roles_and_audited(): void
    {
        $application = $this->application();
        foreach (['staff', 'admin', 'village_head'] as $role) {
            $user = $this->act($role);
            $response = $this->pdf($application)->assertOk()->assertHeader('Content-Type', 'application/pdf');
            $this->assertStringStartsWith('%PDF-', $response->getContent());
            $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
            $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'letter.draft_viewed', 'subject_id' => $application->id]);
        }
        $this->assertDatabaseCount('letters', 0);
    }

    public static function forbiddenRoles(): array
    {
        return [['rt_head'], ['rw_head'], ['warga']];
    }

    #[DataProvider('forbiddenRoles')]
    public function test_wrong_roles_cannot_download_upload_or_get_qr(string $role): void
    {
        $application = $this->approved('DOMISILI');
        $this->act($role);
        $this->pdf($application)->assertForbidden();
        $this->upload($application, $this->fakePdf())->assertForbidden();
        $this->get('/api/v1/staff/applications/'.$application->request_id.'/letter-qr.png')->assertForbidden();
        $this->assertDatabaseMissing('audit_logs', ['action' => 'letter.downloaded']);
    }

    public function test_village_head_cannot_upload_or_get_qr_and_wrong_ability_is_forbidden(): void
    {
        $application = $this->approved();
        $this->act('village_head');
        $this->upload($application, $this->fakePdf())->assertForbidden();
        $this->get('/api/v1/staff/applications/'.$application->request_id.'/letter-qr.png')->assertForbidden();
        $this->act('staff', ['other']);
        $this->pdf($application)->assertForbidden();
    }

    public function test_guests_are_unauthorized(): void
    {
        $application = $this->application();
        $this->getJson('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf')->assertUnauthorized();
        $this->postJson('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf')->assertUnauthorized();
        $this->getJson('/api/v1/staff/applications/'.$application->request_id.'/letter-qr.png')->assertUnauthorized();
    }

    public function test_invalid_or_unknown_request_id(): void
    {
        $this->act();
        $this->getJson('/api/v1/staff/applications/bukan-nomor/letter.pdf')->assertUnprocessable()->assertJsonValidationErrors('request_id');
        $this->getJson('/api/v1/staff/applications/REQ-2026-TIDAKADA/letter.pdf')->assertNotFound();
    }

    public static function unavailableStatuses(): array
    {
        return [['SUBMITTED'], ['VERIFIED'], ['NEED_REVISION'], ['REJECTED']];
    }

    #[DataProvider('unavailableStatuses')]
    public function test_no_pdf_before_processing_or_after_rejection(string $status): void
    {
        $application = $this->application(['status' => $status]);
        $this->act();
        $this->pdf($application)->assertNotFound();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_approval_records_head_time_code_and_stores_encrypted_final_pdf(): void
    {
        $this->travelTo(now()->startOfSecond());
        $application = $this->approved();
        $head = User::where('role', 'village_head')->first();
        $letter = DB::table('letters')->where('application_id', $application->id)->first();
        $this->assertSame($head->id, $letter->approved_by);
        $this->assertSame(now()->format('Y-m-d H:i:s'), $letter->approved_at);
        $this->assertMatchesRegularExpression('/\A[A-Za-z0-9]{32}\z/', $letter->verification_code);
        $this->assertSame('generated', $letter->source);
        Storage::disk('local')->assertExists($letter->path);
        $this->assertStringNotContainsString('%PDF', Storage::disk('local')->get($letter->path), 'stored encrypted');

        $this->act('staff');
        $pdf = $this->pdf($application)->assertOk()->getContent();
        $this->assertSame($letter->sha256, hash('sha256', $pdf));
        $this->assertDatabaseHas('audit_logs', ['action' => 'letter.downloaded', 'subject_id' => $application->id]);
        // Unduhan berikutnya memakai file yang sama.
        $this->assertSame($pdf, $this->pdf($application)->getContent());
    }

    public function test_final_pdf_is_regenerated_on_download_if_missing(): void
    {
        $application = $this->approved();
        DB::table('letters')->update(['path' => null, 'sha256' => null, 'source' => null]);
        $this->act();
        $this->pdf($application)->assertOk();
        $this->assertNotNull(DB::table('letters')->value('sha256'));
    }

    public function test_upload_replaces_generated_pdf_keeps_code_and_is_audited(): void
    {
        $application = $this->approved();
        $code = DB::table('letters')->value('verification_code');
        $old = DB::table('letters')->value('path');
        $user = $this->act('admin');
        $file = $this->fakePdf();
        $this->upload($application, $file)->assertOk()->assertJsonPath('letter.source', 'uploaded')
            ->assertJsonPath('letter.sha256', hash('sha256', $file->get()));
        $this->assertDatabaseHas('letters', ['verification_code' => $code, 'source' => 'uploaded', 'uploaded_by' => $user->id]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'letter.uploaded']);
        Storage::disk('local')->assertMissing($old);
        $this->assertSame($file->get(), $this->pdf($application)->getContent());
    }

    public function test_upload_validation(): void
    {
        $application = $this->approved();
        $this->act();
        $this->upload($application, UploadedFile::fake()->createWithContent('surat.pdf', 'bukan pdf'))->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->upload($application, UploadedFile::fake()->create('besar.pdf', 6000, 'application/pdf'))->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->postJson('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf')->assertUnprocessable()->assertJsonValidationErrors('file');
        // Belum disetujui Kepala Desa.
        $this->upload($this->application(['status' => 'WAITING_APPROVAL']), $this->fakePdf())->assertUnprocessable();
        $this->assertSame('generated', DB::table('letters')->value('source'));
    }

    public function test_qr_png_for_office(): void
    {
        $application = $this->approved();
        $this->act();
        $png = $this->get('/api/v1/staff/applications/'.$application->request_id.'/letter-qr.png')->assertOk()->assertHeader('Content-Type', 'image/png')->getContent();
        $this->assertStringStartsWith("\x89PNG", $png);
        $this->get('/api/v1/staff/applications/'.$this->application()->request_id.'/letter-qr.png')->assertNotFound();
    }

    public function test_detail_exposes_letter_summary_only_to_office(): void
    {
        config()->set('letters.neighborhood_approval', true);
        $application = $this->approved('SKTM');
        $this->act();
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()
            ->assertJsonPath('letter.source', 'generated')->assertJsonMissingPath('letter.verification_code')->assertJsonMissingPath('letter.path');
        $this->act('rt_head');
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->assertJsonMissingPath('letter');
    }

    public function test_public_verification_shows_only_masked_metadata(): void
    {
        $application = $this->approved();
        $code = DB::table('letters')->value('verification_code');
        auth()->forgetGuards();
        $response = $this->getJson('/api/v1/verify/'.$code)->assertOk()->assertExactJson([
            'number' => DB::table('letter_numbers')->value('number'),
            'jenis_surat' => 'SKU',
            'issued_at' => now()->parse(DB::table('letters')->value('approved_at'))->toISOString(),
            'nama' => 'S*** W********',
            'status' => 'valid',
        ]);
        foreach (['Siti', '0000000000000001', '0000000000000002', 'Jalan Fiktif', '08000000000', $application->request_id, 'Usaha Fiktif'] as $secret) {
            $this->assertStringNotContainsString($secret, $response->getContent());
        }
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_verification_wrong_code_is_404_and_void_number_is_revoked(): void
    {
        $this->getJson('/api/v1/verify/'.str_repeat('a', 32))->assertNotFound();
        $this->getJson('/api/v1/verify/pendek')->assertNotFound();
        $this->approved();
        DB::table('letter_numbers')->update(['status' => 'void', 'void_reason' => 'Contoh pembatalan']);
        $this->getJson('/api/v1/verify/'.DB::table('letters')->value('verification_code'))->assertOk()->assertJsonPath('status', 'revoked');
    }

    public function test_verification_is_rate_limited(): void
    {
        for ($i = 0; $i < 30; $i++) $this->getJson('/api/v1/verify/'.str_repeat('b', 32))->assertNotFound();
        $this->getJson('/api/v1/verify/'.str_repeat('b', 32))->assertTooManyRequests();
    }

    public function test_mask_name(): void
    {
        $this->assertSame('S*** W********', Letter::maskName('Siti Wulandari'));
        $this->assertSame('A', Letter::maskName(' A '));
        $this->assertSame('Ö***', Letter::maskName('Ömer'));
    }

    public function test_letter_header_defaults_and_environment_overrides(): void
    {
        $defaults = [
            'kabupaten' => 'PASURUAN',
            'kecamatan' => 'PRIGEN',
            'alamat_kantor' => 'Jl. Taman Safari II No. 01 Desa Watuagung Kec. Prigen Tlp. (0343) 7660001 Kode Pos 67157',
            'kepala_desa' => 'DIDIK HARIYANTO',
        ];
        $env = \Illuminate\Support\Env::getRepository();
        $previous = [];
        foreach ($defaults as $key => $value) {
            $name = 'LETTER_'.strtoupper($key);
            $previous[$name] = $env->get($name);
            $env->clear($name);
        }

        try {
            $config = require config_path('letters.php');
            $this->assertSame($defaults, $config['desa']);
            $this->assertSame('424.314.2.02', $config['kode_desa']);
            foreach ($defaults as $key => $value) {
                $env->set('LETTER_'.strtoupper($key), 'Pengganti fiktif '.$key);
            }
            $config = require config_path('letters.php');
            foreach ($defaults as $key => $value) {
                $this->assertSame('Pengganti fiktif '.$key, $config['desa'][$key]);
            }
        } finally {
            foreach ($previous as $name => $value) {
                $env->clear($name);
                if ($value !== null) $env->set($name, $value);
            }
        }
    }

    private function pdfText(string $pdf): array
    {
        $process = new Process([getenv('PYTHON_BINARY') ?: 'python', base_path('tests/pdf_text.py')]);
        $process->setInput($pdf)->mustRun();

        return json_decode($process->getOutput(), true, flags: JSON_THROW_ON_ERROR);
    }

    #[DataProvider('offeredLetterTypes')]
    public function test_official_pdf_text_and_one_a4_page(string $type): void
    {
        $this->travelTo(now()->parse('2026-10-01 12:00:00'));
        config()->set('letters.desa.kepala_desa', 'KEPALA DESA FIKTIF');
        $application = $this->application(self::letterPayload($type, [
            'tanggal_mulai' => '2026-10-06', 'tanggal_selesai' => '2026-10-07',
            'isi_keterangan' => 'Orang tersebut bekerja di Kota Fiktif setelah diperiksa petugas.',
            'isi_keterangan_awal' => 'Teks asli warga fiktif jangan dicetak.',
        ]));
        $this->act();
        if ($type === 'UMUM') {
            $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/isi-keterangan', [
                'isi_keterangan' => 'Pernyataan fiktif hasil suntingan petugas.',
            ])->assertOk();
            $application->refresh();
        }
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $this->act('village_head');
        $this->change($application, 'APPROVED')->assertOk();
        $pdf = $this->pdf($application)->assertOk()->getContent();
        $parsed = $this->pdfText($pdf);
        $text = $parsed['text'];
        foreach ([LetterType::from($type)->title(), '470/1/424.314.2.02/2026',
            'PEMERINTAH KABUPATEN PASURUAN', 'KECAMATAN PRIGEN', 'KEPALA DESA WATUAGUNG',
            'Yang bertanda tangan di bawah ini Kepala Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan, menerangkan dengan sebenarnya bahwa :',
            'Watuagung, 01 Oktober 2026', 'KEPALA DESA FIKTIF', 'QR bukan tanda tangan elektronik.',
            'Tempat Fiktif, 01-01-2000', 'Dusun Talang RT : 001 RW : 002', 'Indonesia',
        ] as $expected) $this->assertStringContainsString($expected, $text);
        foreach (['pengantar Ketua RT', 'Format sementara', 'Teks asli warga fiktif jangan dicetak.', 'DRAF'] as $absent) {
            $this->assertStringNotContainsString($absent, $text);
        }
        $this->assertCount(1, $parsed['pages']);
        $this->assertEqualsWithDelta(595.28, $parsed['pages'][0][0], 0.1);
        $this->assertEqualsWithDelta(841.89, $parsed['pages'][0][1], 0.1);
        $residency = 'Orang tersebut diatas adalah benar-benar penduduk Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan.';
        $expected = match ($type) {
            'DOMISILI' => ['1. Orang tersebut diatas adalah benar-benar berdomisili di Dusun Talang RT : 001 RW : 002 Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan.'],
            'BELUM_MENIKAH' => ['1. '.$residency, '2. Orang tersebut di atas sampai saat ini belum pernah menikah di Kantor Urusan Agama (KUA) manapun.'],
            'SKTM' => ['1. Orang tersebut diatas adalah benar-benar penduduk Dusun Talang RT : 001 RW : 002 Desa Watuagung Kecamatan Prigen Kabupaten Pasuruan.', '2. Keterangan ini dipergunakan untuk : Keperluan fiktif.'],
            'KEHILANGAN' => ['1. '.$residency, 'Yang bersangkutan telah kehilangan : KTP.'],
            'UMUM' => ['- Menerangkan dengan sebenarnya bahwa orang tersebut diatas benar-benar penduduk Desa Watuagung.', '- '.$application->isi_keterangan],
            'KERAMAIAN' => ['a. Nama Lengkap', 'b. Tempat/tgl lahir', 'c. Jenis Kelamin', 'd. Kewarganegaraan', 'e. Alamat', 'f. Nomor Telepon', 'g. Maksud',
                'Nama tersebut diatas Bermaksud Permohonan ijin :', 'Acara : Hajatan pernikahan fiktif', 'Tempat : Rumah pemohon',
                'Hari/Tanggal : Selasa–Rabu, 06–07 Oktober 2026', 'Jenis Hiburan : Organ tunggal'],
        };
        foreach ($expected as $phrase) $this->assertStringContainsString($phrase, $text);
        if ($type === 'KERAMAIAN') {
            foreach ([$application->nik, $application->no_kk, 'Nomor NIK', 'Nomor KSK'] as $secret) $this->assertStringNotContainsString($secret, $text);
            $this->assertStringContainsString('Demikian atas ijin permohonan ini kami sampaikan dan semoga dapat dipergunakan sebagaimana mestinya.', $text);
        } else {
            $labels = ['Nama', 'Jenis Kelamin', 'Tempat/Tgl. Lahir', 'Agama', 'Kewarganegaraan', 'Status Perkawinan', 'Pendidikan', 'Pekerjaan', 'Nomor NIK', 'Nomor KSK', 'Alamat'];
            $position = 0;
            foreach ($labels as $i => $label) {
                $found = strpos($text, ($i + 1).'. '.$label, $position);
                $this->assertNotFalse($found, $label);
                $position = $found + strlen($label);
            }
            foreach ([$application->nik, $application->no_kk, 'Islam', 'Belum Kawin', 'SLTA/Sederajat', 'Karyawan Swasta', 'KETERANGAN :',
                'Demikian Surat Keterangan ini diberikan kepada yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya.'] as $phrase) $this->assertStringContainsString($phrase, $text);
        }
        $this->assertSame(in_array($type, ['BELUM_MENIKAH', 'KEHILANGAN']), str_contains($text, 'Yang bersangkutan'));

        // Opt-in export reuses tested fixtures; never writes examples into repository/storage.
        if ($directory = getenv('LETTER_SAMPLE_DIR')) {
            $this->assertDirectoryExists($directory);
            $this->assertFalse(str_starts_with(strtolower(realpath($directory)), strtolower(realpath(base_path('..')))));
            $this->assertNotFalse(file_put_contents($directory.'/'.$type.'.pdf', $pdf));
        }
    }

    public static function eventDates(): array
    {
        return [
            ['2026-10-06', '2026-10-06', 'Selasa, 06 Oktober 2026'],
            ['2026-10-06', '2026-10-07', 'Selasa–Rabu, 06–07 Oktober 2026'],
            ['2026-10-30', '2026-11-02', 'Jumat–Senin, 30 Oktober–02 November 2026'],
            ['2026-12-30', '2027-01-02', 'Rabu–Sabtu, 30 Desember 2026–02 Januari 2027'],
        ];
    }

    #[DataProvider('eventDates')]
    public function test_event_date_ranges_in_pdf(string $start, string $end, string $expected): void
    {
        $application = $this->application(self::letterPayload('KERAMAIAN', ['tanggal_mulai' => $start, 'tanggal_selesai' => $end]));
        $parsed = $this->pdfText(Letter::render($application, null));
        $this->assertStringContainsString($expected, $parsed['text']);
        $this->assertStringContainsString('DRAF', $parsed['text']);
    }

    public function test_layout_escapes_text_embeds_logo_and_places_qr_after_signatures(): void
    {
        $application = $this->application(self::letterPayload('KEHILANGAN', ['barang_hilang' => '<b>Barang fiktif</b>']));
        $html = view(Letter::view(LetterType::Kehilangan), [
            'a' => $application, 'title' => LetterType::Kehilangan->title(), 'draft' => false,
            'number' => null, 'date' => now()->locale('id'), 'qr' => 'qr-fiktif',
            'desa' => array_replace(config('letters.desa'), ['kepala_desa' => 'KEPALA FIKTIF']),
        ])->render();
        $this->assertStringContainsString('data:image/jpeg;base64,'.base64_encode(file_get_contents(resource_path('letters/logo-kabupaten-pasuruan.jpg'))), $html);
        $this->assertStringContainsString('<strong>&lt;b&gt;Barang fiktif&lt;/b&gt;</strong>', $html);
        $this->assertStringContainsString('<strong><u>Warga Fiktif</u></strong>', $html);
        $this->assertStringContainsString('<strong><u>KEPALA FIKTIF</u></strong>', $html);
        $this->assertGreaterThan(strpos($html, '<strong><u>KEPALA FIKTIF'), strpos($html, 'data:image/png;base64,qr-fiktif'));
    }

    public function test_legacy_types_with_missing_new_fields_still_render(): void
    {
        foreach ([LetterType::Sku, LetterType::KtpKk] as $type) {
            $application = $this->application(['jenis_surat' => $type->value]);
            $parsed = $this->pdfText(Letter::render($application, null));
            $this->assertStringContainsString($type->title(), $parsed['text']);
            $this->assertStringContainsString('Jalan Fiktif 9', $parsed['text']);
        }
    }
}
