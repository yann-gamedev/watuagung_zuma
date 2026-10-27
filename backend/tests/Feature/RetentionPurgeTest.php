<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** All identities here are fictional. */
class RetentionPurgeTest extends TestCase
{
    use RefreshDatabase;

    private const SECRETS = ['Siti', 'Wulandari', '0000000000000001', '0000000000000002', 'Jalan Fiktif 9', '08000000000', 'Pasar Fiktif', 'Tempat Fiktif', '2000-01-02', 'Keperluan fiktif', 'Catatan fiktif'];

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['retention.application_days' => null]);
    }

    private function application(string $status, int $ageDays): Application
    {
        $application = Application::create([
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'kode-fiktif'),
            'jenis_surat' => 'SKU', 'nama' => 'Siti Wulandari',
            'nik' => '0000000000000001', 'no_kk' => '0000000000000002',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-02',
            'jenis_kelamin' => 'Perempuan', 'alamat' => 'Jalan Fiktif 9',
            'rt' => '001', 'rw' => '002', 'telepon' => '08000000000',
            'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Pasar Fiktif',
            'keperluan' => 'Keperluan fiktif', 'status' => $status, 'catatan' => 'Catatan fiktif',
        ]);
        DB::table('applications')->where('id', $application->id)->update(['updated_at' => now()->subDays($ageDays)]);

        return $application->fresh();
    }

    /** Surat selesai lewat alur API: nomor, PDF final tersimpan, riwayat status. */
    private function completedLetter(): Application
    {
        $application = $this->application('PROCESSING', 0);
        $flow = [['staff', 'WAITING_APPROVAL'], ['village_head', 'APPROVED'], ['staff', 'READY_FOR_PICKUP'], ['staff', 'COMPLETED']];
        foreach ($flow as [$role, $status]) {
            Sanctum::actingAs(User::factory()->create(['role' => $role]), ['applications:manage']);
            $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => $status])->assertOk();
        }
        DB::table('applications')->where('id', $application->id)->update(['updated_at' => now()->subDays(400)]);
        $this->assertNotNull(DB::table('letters')->value('path'));

        return $application->fresh();
    }

    private function snapshot(): array
    {
        return array_map(fn ($table) => DB::table($table)->get()->toJson(), ['applications', 'letters', 'letter_numbers', 'application_events', 'audit_logs']);
    }

    public function test_disabled_by_default_changes_nothing(): void
    {
        $this->application('COMPLETED', 9999);
        $before = $this->snapshot();
        $this->artisan('applications:purge')->expectsOutputToContain('Retensi belum diaktifkan')->assertSuccessful();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_invalid_days_fail_without_changes(): void
    {
        $this->application('COMPLETED', 9999);
        $before = $this->snapshot();
        foreach (['0', '-5', 'abc', '1.5'] as $value) {
            config(['retention.application_days' => $value]);
            $this->artisan('applications:purge')->assertFailed();
        }
        $this->assertSame($before, $this->snapshot());
    }

    public function test_dry_run_lists_targets_without_changes(): void
    {
        $application = $this->completedLetter();
        config(['retention.application_days' => '365']);
        $before = $this->snapshot();
        $path = DB::table('letters')->value('path');
        $this->artisan('applications:purge --dry-run')->expectsOutputToContain($application->request_id)
            ->expectsOutputToContain('1 permohonan akan dianonimkan')->assertSuccessful();
        $this->assertSame($before, $this->snapshot());
        Storage::disk('local')->assertExists($path);
    }

    public function test_only_closed_applications_past_the_limit_are_purged(): void
    {
        config(['retention.application_days' => '365']);
        $old = ['COMPLETED' => $this->application('COMPLETED', 366), 'REJECTED' => $this->application('REJECTED', 366)];
        $kept = [$this->application('COMPLETED', 364), $this->application('REJECTED', 10)];
        foreach (['SUBMITTED', 'RT_APPROVED', 'RW_APPROVED', 'VERIFIED', 'PROCESSING', 'WAITING_APPROVAL', 'APPROVED', 'READY_FOR_PICKUP', 'NEED_REVISION'] as $status) {
            $kept[] = $this->application($status, 9999);
        }
        $updatedAt = $old['COMPLETED']->updated_at->toDateTimeString();

        $this->artisan('applications:purge')->expectsOutputToContain('2 permohonan dianonimkan')->assertSuccessful();

        foreach ($old as $status => $application) {
            $row = $application->fresh();
            $this->assertSame('S. W.', $row->nama);
            foreach (['nik', 'no_kk', 'telepon', 'alamat', 'tempat_lahir', 'tanggal_lahir', 'keperluan'] as $field) $this->assertSame('', $row->$field);
            $this->assertNull($row->alamat_usaha);
            $this->assertNull($row->catatan);
            $this->assertNotNull($row->purged_at);
            $this->assertSame([$application->request_id, 'SKU', $status, '001', '002'], [$row->request_id, $row->jenis_surat, $row->status, $row->rt, $row->rw]);
            $this->assertSame($updatedAt, $row->updated_at->toDateTimeString());
            $this->assertDatabaseHas('audit_logs', ['user_id' => null, 'action' => 'application.purged', 'subject_type' => 'application', 'subject_id' => $application->id]);
        }
        foreach ($kept as $application) {
            $this->assertSame('Siti Wulandari', $application->fresh()->nama);
            $this->assertSame('0000000000000001', $application->fresh()->nik);
        }
        $this->assertDatabaseCount('audit_logs', 2);
        $raw = DB::table('applications')->whereNotNull('purged_at')->get()->toJson().DB::table('audit_logs')->get()->toJson();
        foreach (self::SECRETS as $secret) $this->assertStringNotContainsString($secret, $raw);

        // Idempoten: proses ulang tidak menyentuh atau mengaudit ulang.
        $this->artisan('applications:purge')->expectsOutputToContain('0 permohonan dianonimkan')->assertSuccessful();
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_letter_file_is_deleted_and_register_verify_and_history_still_work(): void
    {
        $application = $this->completedLetter();
        $letter = DB::table('letters')->first();
        $number = DB::table('letter_numbers')->value('number');
        $events = DB::table('application_events')->count();
        $this->assertGreaterThan(0, $events);
        config(['retention.application_days' => '365']);

        $this->artisan('applications:purge')->assertSuccessful();

        Storage::disk('local')->assertMissing($letter->path);
        $after = DB::table('letters')->first();
        $this->assertNull($after->path);
        $this->assertNotNull($after->file_purged_at);
        $this->assertSame([$letter->verification_code, $letter->sha256, $letter->approved_at], [$after->verification_code, $after->sha256, $after->approved_at]);
        $this->assertSame($events, DB::table('application_events')->count());

        auth()->forgetGuards();
        $this->getJson('/api/v1/verify/'.$letter->verification_code)->assertOk()
            ->assertJsonPath('status', 'valid')->assertJsonPath('number', $number)->assertJsonPath('nama', 'S* W*');
        DB::table('letter_numbers')->update(['status' => 'void', 'void_reason' => 'Pembatalan fiktif']);
        $this->getJson('/api/v1/verify/'.$letter->verification_code)->assertOk()->assertJsonPath('status', 'revoked');

        Sanctum::actingAs(User::factory()->create(['role' => 'staff']), ['applications:manage']);
        $this->getJson('/api/v1/staff/letter-register?year='.now()->year)->assertOk()
            ->assertJsonPath('data.0.number', $number)->assertJsonPath('data.0.nama', 'S. W.');
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()
            ->assertJsonPath('nik', '')->assertJsonPath('nama', 'S. W.')->assertJsonCount($events, 'history')
            ->assertJsonPath('letter.file_purged_at', fn ($value) => is_string($value));
        // PDF tidak dibuat ulang dari data anonim.
        $this->getJson('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf')->assertStatus(410);
        $this->assertNull(DB::table('letters')->value('path'));
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_purge_is_scheduled_daily(): void
    {
        $this->artisan('schedule:list')->expectsOutputToContain('applications:purge')->assertSuccessful();
    }
}
