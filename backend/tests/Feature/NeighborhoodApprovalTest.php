<?php

namespace Tests\Feature;

use App\Domain\AreaCode;
use App\Domain\LetterType;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Semua data warga dan akun di sini fiktif. */
class NeighborhoodApprovalTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, ?string $rt = null, ?string $rw = null): User
    {
        return User::factory()->create(['role' => $role, 'rt' => $rt, 'rw' => $rw, 'username' => $role.'-'.Str::lower(Str::random(6))]);
    }

    private function actAs(User $user): User
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['applications:manage']);

        return $user;
    }

    private function application(array $attributes = []): Application
    {
        return Application::create($attributes + [
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'rahasia-fiktif'),
            'jenis_surat' => 'DOMISILI', 'nama' => 'Warga Fiktif',
            'nik' => '0000000000001234', 'no_kk' => '0000000000005678',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Perempuan',
            'alamat' => 'Alamat fiktif', 'rt' => '1', 'rw' => '02', 'telepon' => '08000000000',
            'keperluan' => 'Keperluan fiktif', 'status' => 'SUBMITTED',
        ]);
    }

    private function change(Application $application, string $status, ?string $note = null)
    {
        return $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => $status, 'catatan' => $note]);
    }

    private function lookup(Application $application)
    {
        return $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => 'rahasia-fiktif']);
    }

    public function test_letter_type_configuration(): void
    {
        $this->assertSame(['SKU' => false, 'DOMISILI' => true, 'SKTM' => true, 'KTP_KK' => true],
            array_combine(array_column(LetterType::cases(), 'value'), array_map(fn ($type) => $type->requiresNeighborhoodApproval(), LetterType::cases())));
    }

    public function test_area_code_normalization(): void
    {
        foreach (['1' => '001', '01' => '001', '001' => '001', '120' => '120'] as $input => $expected) $this->assertSame($expected, AreaCode::normalize((string) $input));
        $this->assertSame('001', AreaCode::normalize(1));
        foreach (['', '0001', 'a1', ' 1', null, -1, 1.0] as $input) $this->assertNull(AreaCode::normalize($input));
        $application = $this->application(['rt' => '7', 'rw' => '03']);
        $this->assertSame(['007', '003'], [DB::table('applications')->where('id', $application->id)->value('rt'), DB::table('applications')->where('id', $application->id)->value('rw')]);
        $user = $this->user('rt_head', '07', '3');
        $this->assertSame(['007', '003'], [DB::table('users')->where('id', $user->id)->value('rt'), DB::table('users')->where('id', $user->id)->value('rw')]);
        $this->actAs($user);
        $this->getJson('/api/v1/staff/applications')->assertOk()->assertJsonPath('total', 1);
    }

    public function test_submission_normalizes_area_and_returns_letter_type(): void
    {
        $payload = [
            'jenis_surat' => 'SKTM', 'nama' => 'Warga Fiktif', 'nik' => '0000000000000000', 'no_kk' => '0000000000000000',
            'tempat_lahir' => 'Contoh', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Laki-laki',
            'alamat' => 'Alamat fiktif', 'rt' => '5', 'rw' => '09', 'telepon' => '08000000000', 'keperluan' => 'Keperluan fiktif',
        ];
        $this->postJson('/api/v1/applications', $payload)->assertCreated()->assertJsonPath('jenis_surat', 'SKTM');
        $this->assertDatabaseHas('applications', ['rt' => '005', 'rw' => '009']);
    }

    public function test_full_domisili_flow_with_five_accounts(): void
    {
        $application = $this->application();
        $accounts = [
            [$this->user('rt_head', '001', '2'), 'RT_APPROVED'],
            [$this->user('rw_head', null, '002'), 'RW_APPROVED'],
            [$this->user('staff'), 'VERIFIED'],
            [$this->user('admin'), 'PROCESSING'],
            [$this->user('staff'), 'WAITING_APPROVAL'],
            [$this->user('village_head'), 'APPROVED'],
            [$this->user('admin'), 'READY_FOR_PICKUP'],
            [$this->user('staff'), 'COMPLETED'],
        ];
        foreach ($accounts as [$user, $to]) {
            $from = $application->fresh()->status;
            $this->actAs($user);
            $this->change($application, $to)->assertOk()->assertJsonPath('status', $to);
            $this->assertDatabaseHas('application_events', ['application_id' => $application->id, 'user_id' => $user->id, 'from_status' => $from, 'to_status' => $to]);
        }
        $this->assertSame(5, count(array_unique(array_map(fn ($pair) => $pair[0]->role, $accounts))));
        $this->lookup($application)->assertOk()->assertJsonPath('jenis_surat', 'DOMISILI')->assertJsonPath('status', 'COMPLETED');
    }

    public function test_sku_flow_is_unchanged_and_neighborhood_heads_cannot_act(): void
    {
        $application = $this->application(['jenis_surat' => 'SKU', 'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Alamat fiktif']);
        $this->actAs($this->user('rt_head', '001', '002'));
        $this->getJson('/api/v1/staff/applications')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertNotFound();
        $this->change($application, 'RT_APPROVED')->assertForbidden();
        $this->change($application, 'VERIFIED')->assertForbidden();
        $this->actAs($this->user('staff'));
        $this->change($application, 'VERIFIED')->assertOk();
    }

    public function test_staff_cannot_skip_neighborhood_approval(): void
    {
        foreach (['DOMISILI', 'SKTM', 'KTP_KK'] as $type) {
            $application = $this->application(['jenis_surat' => $type]);
            $this->actAs($this->user('staff'));
            $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->assertJsonPath('allowed_transitions', []);
            $this->change($application, 'VERIFIED')->assertUnprocessable();
            $this->change($application, 'RT_APPROVED')->assertForbidden();
            $this->assertSame('SUBMITTED', $application->fresh()->status);
        }
    }

    public function test_rw_cannot_act_on_submitted_and_rt_cannot_act_on_rt_approved(): void
    {
        $application = $this->application();
        $this->actAs($this->user('rw_head', null, '002'));
        $this->change($application, 'RT_APPROVED')->assertForbidden();
        $this->change($application, 'RW_APPROVED')->assertUnprocessable();
        $this->change($application, 'REJECTED', 'Catatan fiktif')->assertForbidden();
        $this->actAs($this->user('rt_head', '001', '002'));
        $this->change($this->application(['status' => 'RT_APPROVED']), 'RW_APPROVED')->assertForbidden();
        $this->assertSame(0, DB::table('application_events')->count());
    }

    public function test_cross_territory_mutation_is_403_and_detail_is_404(): void
    {
        $otherRt = $this->application(['rt' => '003']);
        $otherRw = $this->application(['status' => 'RT_APPROVED', 'rw' => '009']);
        $this->actAs($this->user('rt_head', '001', '002'));
        $this->change($otherRt, 'RT_APPROVED')->assertForbidden();
        $this->getJson('/api/v1/staff/applications/'.$otherRt->request_id)->assertNotFound();
        $this->actAs($this->user('rw_head', null, '002'));
        $this->change($otherRw, 'RW_APPROVED')->assertForbidden();
        $this->getJson('/api/v1/staff/applications/'.$otherRw->request_id)->assertNotFound();
        // Same RT number in another RW is still outside an RT head's territory.
        $sameRtOtherRw = $this->application(['rt' => '001', 'rw' => '009']);
        $this->actAs($this->user('rt_head', '001', '002'));
        $this->change($sameRtOtherRw, 'RT_APPROVED')->assertForbidden();
        $this->getJson('/api/v1/staff/applications/'.$sameRtOtherRw->request_id)->assertNotFound();
        $this->assertSame(['SUBMITTED', 'RT_APPROVED', 'SUBMITTED'], [$otherRt->fresh()->status, $otherRw->fresh()->status, $sameRtOtherRw->fresh()->status]);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_list_is_scoped_to_territory(): void
    {
        $mine = $this->application(['rt' => '01', 'rw' => '2']);
        $sameRw = $this->application(['rt' => '004', 'rw' => '002']);
        $this->application(['rt' => '001', 'rw' => '003']);
        $this->application(['rt' => '001', 'rw' => '002', 'jenis_surat' => 'SKU', 'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Alamat fiktif']);
        $this->actAs($this->user('rt_head', '1', '2'));
        $this->assertSame([$mine->request_id], array_column($this->getJson('/api/v1/staff/applications')->assertOk()->json('data'), 'request_id'));
        $this->actAs($this->user('rw_head', null, '02'));
        $this->assertEqualsCanonicalizing([$mine->request_id, $sameRw->request_id], array_column($this->getJson('/api/v1/staff/applications')->json('data'), 'request_id'));
        $this->actAs($this->user('staff'));
        $this->getJson('/api/v1/staff/applications')->assertJsonPath('total', 4);
    }

    public function test_neighborhood_detail_is_minimal_with_full_identity_and_audited(): void
    {
        $application = $this->application(['status' => 'RT_APPROVED']);
        DB::table('application_events')->insert(['application_id' => $application->id, 'to_status' => 'SUBMITTED', 'created_at' => now()]);
        $user = $this->actAs($this->user('rw_head', null, '002'));
        $detail = $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()
            ->assertJsonPath('nik', $application->nik)->assertJsonPath('no_kk', $application->no_kk)
            ->assertJsonPath('allowed_transitions', ['RW_APPROVED', 'REJECTED'])->json();
        foreach (['telepon', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin'] as $field) $this->assertArrayNotHasKey($field, $detail);
        $this->assertEqualsCanonicalizing([
            'request_id', 'jenis_surat', 'nama', 'nik', 'no_kk', 'alamat', 'rt', 'rw', 'nama_usaha', 'jenis_usaha', 'alamat_usaha',
            'keperluan', 'status', 'catatan', 'created_at', 'updated_at', 'allowed_transitions', 'can_reset_access_code', 'history',
        ], array_keys($detail));
        $this->assertDatabaseHas('audit_logs', ['user_id' => $user->id, 'action' => 'application.viewed', 'subject_id' => $application->id]);
        $this->actAs($this->user('staff'));
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertJsonPath('nik', '0000000000001234')->assertJsonPath('telepon', '08000000000');
    }

    public function test_rejection_requires_note_and_public_message_names_rejecting_head(): void
    {
        $rtRejected = $this->application();
        $rt = $this->actAs($this->user('rt_head', '001', '002'));
        $this->change($rtRejected, 'REJECTED')->assertUnprocessable()->assertJsonValidationErrors('catatan');
        $this->change($rtRejected, 'REJECTED', 'Alamat belum sesuai.')->assertOk();
        $this->assertDatabaseHas('application_events', ['application_id' => $rtRejected->id, 'user_id' => $rt->id, 'from_status' => 'SUBMITTED', 'to_status' => 'REJECTED']);
        // Message follows the recorded stage, not the account's current role.
        $rt->forceFill(['role' => 'staff', 'rt' => null, 'rw' => null])->save();
        $this->lookup($rtRejected)->assertOk()->assertExactJson([
            'success' => true, 'request_id' => $rtRejected->request_id, 'jenis_surat' => 'DOMISILI', 'status' => 'REJECTED',
            'catatan' => 'Ditolak oleh Ketua RT: Alamat belum sesuai. Silakan ajukan ulang setelah data diperbaiki.',
        ]);

        $rwRejected = $this->application(['status' => 'RT_APPROVED']);
        $this->actAs($this->user('rw_head', null, '002'));
        $this->change($rwRejected, 'REJECTED', 'Data RW berbeda')->assertOk();
        $this->lookup($rwRejected)->assertJsonPath('catatan', 'Ditolak oleh Ketua RW: Data RW berbeda. Silakan ajukan ulang setelah data diperbaiki.');

        $officeRejected = $this->application(['status' => 'RW_APPROVED']);
        $this->actAs($this->user('staff'));
        $this->change($officeRejected, 'REJECTED', 'Catatan petugas')->assertOk();
        $this->lookup($officeRejected)->assertJsonPath('catatan', 'Catatan petugas');
    }

    public function test_grandfathered_advanced_status_keeps_office_flow(): void
    {
        $application = $this->application(['status' => 'VERIFIED']);
        $this->actAs($this->user('staff'));
        $this->change($application, 'PROCESSING')->assertOk();
    }

    public function test_invalid_area_accounts_fail_closed_and_cannot_be_created(): void
    {
        $user = $this->user('rt_head', '001', '002');
        $token = $this->postJson('/api/v1/staff/login', ['username' => $user->username, 'password' => 'password'])
            ->assertOk()->assertJsonPath('user.rt', '001')->assertJsonPath('user.rw', '002')->json('token');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/me')->assertOk()
            ->assertExactJson(['name' => $user->name, 'username' => $user->username, 'role' => 'rt_head', 'rt' => '001', 'rw' => '002', 'must_change_password' => false]);

        DB::table('users')->where('id', $user->id)->update(['rt' => null]);
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/me')->assertForbidden();
        $this->withToken($token)->getJson('/api/v1/staff/applications')->assertForbidden();
        $this->postJson('/api/v1/staff/login', ['username' => $user->username, 'password' => 'password'])->assertUnauthorized();

        $this->expectException(ValidationException::class);
        $this->user('rw_head');
    }

    public function test_staff_create_validates_territory(): void
    {
        $this->artisan('staff:create', ['username' => 'rt-tanpa-wilayah', '--role' => 'rt_head', '--rw' => '1'])->assertFailed();
        $this->artisan('staff:create', ['username' => 'rw-salah', '--role' => 'rw_head', '--rw' => '1234'])->assertFailed();
        $this->artisan('staff:create', ['username' => 'rt-lokal', '--role' => 'rt_head', '--rt' => '1', '--rw' => '02'])
            ->expectsQuestion('Kata sandi (minimal 12 karakter)', 'kata-sandi-uji-panjang')
            ->expectsQuestion('Ulangi kata sandi', 'kata-sandi-uji-panjang')
            ->assertSuccessful();
        $this->assertDatabaseHas('users', ['username' => 'rt-lokal', 'role' => 'rt_head', 'rt' => '001', 'rw' => '002']);
        $this->assertDatabaseMissing('users', ['username' => 'rt-tanpa-wilayah']);
    }
}
