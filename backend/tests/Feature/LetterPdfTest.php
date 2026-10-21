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

/** All identities here are fictional. */
class LetterPdfTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_all_four_templates_render(): void
    {
        foreach (LetterType::cases() as $type) {
            $application = $this->application(['jenis_surat' => $type->value]);
            $this->act();
            $this->assertStringStartsWith('%PDF-', $this->pdf($application)->assertOk()->getContent());
        }
    }
}
