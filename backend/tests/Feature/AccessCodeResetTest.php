<?php

namespace Tests\Feature;

use App\Domain\AccessCode;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Semua data warga dan akun di sini fiktif. */
class AccessCodeResetTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, ?string $rt = null, ?string $rw = null): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => $rt, 'rw' => $rw, 'username' => $role.'-'.Str::lower(Str::random(6))]);
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['applications:manage']);
        return $user;
    }

    private function application(array $attributes = []): Application
    {
        return Application::create($attributes + [
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => AccessCode::hash('WAD-1111-2222'),
            'jenis_surat' => 'SKTM', 'nama' => 'Warga Fiktif',
            'nik' => '0000000000001234', 'no_kk' => '0000000000005678',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Perempuan',
            'alamat' => 'Alamat fiktif', 'rt' => '001', 'rw' => '001', 'telepon' => '08000000000',
            'keperluan' => 'Keperluan fiktif', 'status' => 'SUBMITTED',
        ]);
    }

    private function reset(Application $application)
    {
        return $this->postJson('/api/v1/staff/applications/'.$application->request_id.'/lookup-secret');
    }

    private function lookup(Application $application, string $code)
    {
        return $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => $code]);
    }

    public function test_staff_resets_code_old_code_stops_working_and_history_and_audit_are_written(): void
    {
        $application = $this->application();
        $staff = $this->user('staff');
        $code = $this->reset($application)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('lookup_secret');
        $this->assertMatchesRegularExpression('/\AWAD-[0-9]{4}-[0-9]{4}\z/', $code);
        $this->lookup($application, 'WAD-1111-2222')->assertNotFound();
        $this->lookup($application, $code)->assertOk()->assertJsonPath('status', 'SUBMITTED');
        $this->assertDatabaseHas('application_events', ['application_id' => $application->id, 'user_id' => $staff->id, 'action' => 'ACCESS_CODE_RESET', 'to_status' => 'SUBMITTED']);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $staff->id, 'action' => 'application.access_code_reset', 'subject_id' => $application->id]);
        $this->assertStringNotContainsString(substr($code, 4), json_encode(DB::table('audit_logs')->get().DB::table('application_events')->get()));
        $history = $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->json('history');
        $this->assertSame('ACCESS_CODE_RESET', end($history)['action']);
    }

    public function test_neighborhood_heads_reset_only_in_territory(): void
    {
        $application = $this->application();
        $this->user('rt_head', '001', '001');
        $this->reset($application)->assertOk();
        $this->user('rw_head', null, '001');
        $this->reset($application)->assertOk();
        $this->user('rt_head', '002', '001');
        $this->reset($application)->assertNotFound();
        $this->user('rw_head', null, '002');
        $this->reset($application)->assertNotFound();
    }

    public function test_missing_token_wrong_role_and_validation(): void
    {
        $application = $this->application();
        $this->reset($application)->assertUnauthorized();
        $this->user('village_head');
        $this->reset($application)->assertForbidden();
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertJsonPath('can_reset_access_code', false);
        $this->user('staff');
        $this->postJson('/api/v1/staff/applications/bukan-nomor/lookup-secret')->assertUnprocessable();
        $this->postJson('/api/v1/staff/applications/REQ-2026-TIDAKADA/lookup-secret')->assertNotFound();
        $completed = $this->application(['status' => 'COMPLETED']);
        $this->reset($completed)->assertUnprocessable();
        $this->getJson('/api/v1/staff/applications/'.$completed->request_id)->assertJsonPath('can_reset_access_code', false);
        $this->assertDatabaseCount('application_events', 0);
    }

    public function test_reset_unlocks_lookout_and_keeps_rt_rejection_note(): void
    {
        $application = $this->application(['status' => 'REJECTED', 'catatan' => 'Alamat tidak sesuai']);
        DB::table('application_events')->insert(['application_id' => $application->id, 'from_status' => 'SUBMITTED', 'to_status' => 'REJECTED', 'note' => 'Alamat tidak sesuai', 'created_at' => now()]);
        for ($i = 0; $i < 5; $i++) $this->lookup($application, 'WAD-0000-0000')->assertNotFound();
        $this->user('staff');
        $code = $this->reset($application)->assertOk()->json('lookup_secret');
        $this->lookup($application, $code)->assertOk()->assertJsonPath('catatan', 'Ditolak oleh Ketua RT: Alamat tidak sesuai. Silakan ajukan ulang setelah data diperbaiki.');
    }
}
