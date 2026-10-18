<?php

namespace Tests\Feature;

use App\Domain\ApplicationStatus;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Semua data warga di sini fiktif. */
class StatusWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private const ROLES = ['staff', 'village_head', 'admin'];

    private function user(string $role): User
    {
        return User::factory()->create(['role' => $role, 'username' => $role.'-'.Str::lower(Str::random(6))]);
    }

    private function act(string $role, array $abilities = ['applications:manage']): User
    {
        $user = $this->user($role);
        Sanctum::actingAs($user, $abilities);

        return $user;
    }

    private function application(string $status = 'SUBMITTED', string $secret = 'rahasia-fiktif'): Application
    {
        return Application::create([
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', $secret),
            'jenis_surat' => 'DOMISILI', 'nama' => 'Warga Contoh',
            'nik' => '0000000000000000', 'no_kk' => '0000000000000000',
            'tempat_lahir' => 'Contoh', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Perempuan',
            'alamat' => 'Alamat fiktif', 'rt' => '01', 'rw' => '02', 'telepon' => '08000000000',
            'keperluan' => 'Keperluan contoh', 'status' => $status,
        ]);
    }

    private function changeStatus(Application $application, string $status, ?string $note = null)
    {
        return $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => $status, 'catatan' => $note]);
    }

    /** @return iterable<string, array{string, string, string}> */
    public static function allowedTransitions(): iterable
    {
        foreach (ApplicationStatus::rules() as $from => $targets) {
            foreach ($targets as $to => $roles) {
                foreach ($roles as $role) yield "$role: $from -> $to" => [$from, $to, $role];
            }
        }
    }

    #[DataProvider('allowedTransitions')]
    public function test_each_allowed_transition_succeeds_and_is_audited(string $from, string $to, string $role): void
    {
        $application = $this->application($from);
        $user = $this->act($role);
        $note = ApplicationStatus::requiresNote($to) ? 'Catatan fiktif' : null;

        $this->changeStatus($application, $to, $note)->assertOk()
            ->assertJsonPath('status', $to)
            ->assertJsonPath('catatan', $note)
            ->assertJsonPath('allowed_transitions', ApplicationStatus::allowedFor($to, $role));

        $this->assertSame($to, $application->fresh()->status);
        $this->assertDatabaseHas('application_events', [
            'application_id' => $application->id, 'user_id' => $user->id,
            'from_status' => $from, 'to_status' => $to, 'note' => $note,
        ]);
    }

    public function test_every_other_combination_is_rejected_without_side_effects(): void
    {
        $users = array_combine(self::ROLES, array_map(fn ($role) => $this->user($role), self::ROLES));
        $checked = 0;
        foreach (ApplicationStatus::values() as $from) {
            $application = $this->application($from);
            foreach (ApplicationStatus::values() as $to) {
                foreach (self::ROLES as $role) {
                    if (ApplicationStatus::canTransition($from, $to, $role)) continue;
                    Sanctum::actingAs($users[$role], ['applications:manage']);
                    $expected = ApplicationStatus::isTransition($from, $to) ? 403 : 422;
                    $this->changeStatus($application, $to, 'Catatan fiktif')->assertStatus($expected);
                    $checked++;
                }
            }
            $this->assertSame($from, $application->fresh()->status);
        }
        $this->assertGreaterThan(200, $checked);
        $this->assertSame(0, DB::table('application_events')->count());
    }

    public function test_staff_and_admin_cannot_approve(): void
    {
        foreach (['staff', 'admin'] as $role) {
            $application = $this->application('WAITING_APPROVAL');
            $this->act($role);
            $this->changeStatus($application, 'APPROVED')->assertForbidden()
                ->assertJsonPath('message', 'Peran Anda tidak berwenang melakukan perubahan status ini.');
            $this->changeStatus($application, 'REJECTED', 'Catatan fiktif')->assertForbidden();
            $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        }
    }

    public function test_village_head_cannot_do_office_work(): void
    {
        $this->act('village_head');
        $this->changeStatus($this->application('SUBMITTED'), 'VERIFIED')->assertForbidden();
        $this->changeStatus($this->application('APPROVED'), 'READY_FOR_PICKUP')->assertForbidden();
        $this->changeStatus($this->application('READY_FOR_PICKUP'), 'COMPLETED')->assertForbidden();
    }

    public function test_skipped_and_terminal_transitions_are_invalid(): void
    {
        $this->act('admin');
        $this->changeStatus($this->application('SUBMITTED'), 'PROCESSING')->assertUnprocessable()->assertJsonPath('message', 'Transisi status tidak valid.');
        $this->changeStatus($this->application('SUBMITTED'), 'APPROVED')->assertUnprocessable();
        $this->changeStatus($this->application('VERIFIED'), 'READY_FOR_PICKUP')->assertUnprocessable();
        $this->changeStatus($this->application('WAITING_APPROVAL'), 'COMPLETED')->assertUnprocessable();
        $this->changeStatus($this->application('APPROVED'), 'COMPLETED')->assertUnprocessable();
        $this->changeStatus($this->application('COMPLETED'), 'READY_FOR_PICKUP')->assertUnprocessable();
        $this->changeStatus($this->application('REJECTED'), 'VERIFIED')->assertUnprocessable();
    }

    public function test_note_is_required_for_rejection_and_revision(): void
    {
        foreach ([['staff', 'SUBMITTED'], ['village_head', 'WAITING_APPROVAL']] as [$role, $from]) {
            $this->act($role);
            foreach (['REJECTED', 'NEED_REVISION'] as $to) {
                $application = $this->application($from);
                $this->changeStatus($application, $to)->assertUnprocessable()->assertJsonValidationErrors('catatan');
                $this->changeStatus($application, $to, '   ')->assertUnprocessable()->assertJsonValidationErrors('catatan');
                $this->assertSame($from, $application->fresh()->status);
            }
        }
        $this->assertSame(0, DB::table('application_events')->count());
    }

    public function test_full_flow_from_submission_to_completion(): void
    {
        $application = $this->application();
        $steps = [
            ['staff', 'VERIFIED'], ['staff', 'PROCESSING'], ['admin', 'WAITING_APPROVAL'],
            ['village_head', 'APPROVED'], ['staff', 'READY_FOR_PICKUP'], ['admin', 'COMPLETED'],
        ];
        foreach ($steps as [$role, $to]) {
            $this->act($role);
            $this->changeStatus($application, $to)->assertOk();
        }
        $this->assertSame('COMPLETED', $application->fresh()->status);
        $this->assertSame(6, DB::table('application_events')->whereNotNull('user_id')->count());
        $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => 'rahasia-fiktif'])
            ->assertOk()->assertJsonPath('status', 'COMPLETED')->assertJsonMissing(['nik' => '0000000000000000']);
    }

    public function test_public_lookup_reports_pickup_statuses(): void
    {
        foreach (['READY_FOR_PICKUP', 'COMPLETED'] as $status) {
            $application = $this->application($status);
            $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => 'rahasia-fiktif'])
                ->assertOk()->assertExactJson(['success' => true, 'request_id' => $application->request_id, 'status' => $status, 'catatan' => null]);
        }
    }

    public function test_list_includes_allowed_transitions_for_current_role(): void
    {
        $this->application('WAITING_APPROVAL');
        $this->application('APPROVED');
        $expected = [
            'staff' => ['WAITING_APPROVAL' => [], 'APPROVED' => ['READY_FOR_PICKUP']],
            'admin' => ['WAITING_APPROVAL' => [], 'APPROVED' => ['READY_FOR_PICKUP']],
            'village_head' => ['WAITING_APPROVAL' => ['APPROVED', 'REJECTED', 'NEED_REVISION'], 'APPROVED' => []],
        ];
        foreach ($expected as $role => $byStatus) {
            $this->act($role);
            $rows = collect($this->getJson('/api/v1/staff/applications')->assertOk()->json('data'))->keyBy('status');
            foreach ($byStatus as $status => $allowed) $this->assertSame($allowed, $rows[$status]['allowed_transitions'], "$role $status");
        }
    }

    public function test_list_never_exposes_sensitive_fields(): void
    {
        $this->application();
        $this->act('admin');
        $row = $this->getJson('/api/v1/staff/applications')->assertOk()->json('data.0');
        $this->assertEqualsCanonicalizing(['request_id', 'nama', 'jenis_surat', 'status', 'created_at', 'allowed_transitions'], array_keys($row));
        $this->getJson('/api/v1/staff/applications')->assertJsonMissing(['nik' => '0000000000000000'])->assertJsonMissing(['telepon' => '08000000000']);
    }

    public function test_list_filters_by_one_or_many_statuses(): void
    {
        foreach (['SUBMITTED', 'APPROVED', 'READY_FOR_PICKUP', 'COMPLETED', 'WAITING_APPROVAL'] as $status) $this->application($status);
        $this->act('staff');
        $this->getJson('/api/v1/staff/applications?status=COMPLETED')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.status', 'COMPLETED');
        $response = $this->getJson('/api/v1/staff/applications?statuses[]=APPROVED&statuses[]=READY_FOR_PICKUP')->assertOk()->assertJsonPath('total', 2);
        $this->assertEqualsCanonicalizing(['APPROVED', 'READY_FOR_PICKUP'], array_column($response->json('data'), 'status'));
    }

    public function test_multi_status_filter_paginates_on_server(): void
    {
        for ($i = 0; $i < 21; $i++) $this->application($i % 2 ? 'APPROVED' : 'READY_FOR_PICKUP');
        $this->application('SUBMITTED');
        $this->act('admin');
        $this->getJson('/api/v1/staff/applications?statuses[]=APPROVED&statuses[]=READY_FOR_PICKUP')->assertOk()
            ->assertJsonPath('total', 21)->assertJsonPath('last_page', 2)->assertJsonCount(20, 'data');
        $this->getJson('/api/v1/staff/applications?statuses[]=APPROVED&statuses[]=READY_FOR_PICKUP&page=2')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_list_validation_errors(): void
    {
        $this->act('staff');
        $this->getJson('/api/v1/staff/applications?status=BOGUS')->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->getJson('/api/v1/staff/applications?statuses[]=BOGUS')->assertUnprocessable()->assertJsonValidationErrors('statuses.0');
        $this->getJson('/api/v1/staff/applications?status=APPROVED&statuses[]=APPROVED')->assertUnprocessable()->assertJsonValidationErrors(['status', 'statuses']);
        $this->getJson('/api/v1/staff/applications?statuses[]=APPROVED&statuses[]=APPROVED')->assertUnprocessable()->assertJsonValidationErrors('statuses.0');
        $this->getJson('/api/v1/staff/applications?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
        $this->getJson('/api/v1/staff/applications?page=abc')->assertUnprocessable()->assertJsonValidationErrors('page');
    }

    public function test_update_validation_errors(): void
    {
        $application = $this->application();
        $this->act('staff');
        $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', [])->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->changeStatus($application, 'BOGUS')->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->changeStatus($application, 'VERIFIED', str_repeat('a', 1001))->assertUnprocessable()->assertJsonValidationErrors('catatan');
        $this->changeStatus($application, 'VERIFIED')->assertOk();
        $this->patchJson('/api/v1/staff/applications/REQ-2026-TIDAKADA/status', ['status' => 'VERIFIED'])->assertNotFound();
    }

    public function test_endpoints_require_token(): void
    {
        $application = $this->application();
        $this->getJson('/api/v1/staff/applications')->assertUnauthorized();
        $this->changeStatus($application, 'VERIFIED')->assertUnauthorized();
        $this->assertSame('SUBMITTED', $application->fresh()->status);
    }

    public function test_endpoints_reject_wrong_role_and_missing_ability(): void
    {
        $application = $this->application();
        $this->act('resident');
        $this->getJson('/api/v1/staff/applications')->assertForbidden()->assertJsonMissingPath('data');
        $this->changeStatus($application, 'VERIFIED')->assertForbidden();
        $this->getJson('/api/v1/staff/me')->assertForbidden();

        $this->act('staff', ['something:else']);
        $this->getJson('/api/v1/staff/applications')->assertForbidden();
        $this->changeStatus($application, 'VERIFIED')->assertForbidden();
        $this->assertSame('SUBMITTED', $application->fresh()->status);
    }

    public function test_role_downgraded_after_token_issue_loses_approval(): void
    {
        $application = $this->application('WAITING_APPROVAL');
        $head = $this->act('village_head');
        $head->forceFill(['role' => 'staff'])->save();
        $this->changeStatus($application, 'APPROVED')->assertForbidden();
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
    }

    public function test_stale_client_cannot_repeat_a_transition(): void
    {
        $application = $this->application('APPROVED');
        $this->act('staff');
        $this->changeStatus($application, 'READY_FOR_PICKUP')->assertOk();
        $this->changeStatus($application, 'READY_FOR_PICKUP')->assertUnprocessable();
        $this->assertSame(1, DB::table('application_events')->count());
    }

    public function test_village_head_can_login_and_read_profile(): void
    {
        User::factory()->create(['name' => 'Kepala Desa Fiktif', 'username' => 'kades-fiktif', 'password' => 'test-password-only', 'role' => 'village_head']);
        $token = $this->postJson('/api/v1/staff/login', ['username' => 'kades-fiktif', 'password' => 'test-password-only'])
            ->assertOk()->assertJsonPath('user.role', 'village_head')->json('token');
        $this->withToken($token)->getJson('/api/v1/staff/me')->assertOk()
            ->assertExactJson(['name' => 'Kepala Desa Fiktif', 'username' => 'kades-fiktif', 'role' => 'village_head']);
    }

    public function test_staff_create_command_prompts_for_hidden_password(): void
    {
        $this->artisan('staff:create', ['username' => 'kades-lokal', '--role' => 'village_head', '--name' => 'Kepala Desa Lokal'])
            ->expectsQuestion('Kata sandi (minimal 12 karakter)', 'kata-sandi-uji-panjang')
            ->expectsQuestion('Ulangi kata sandi', 'kata-sandi-uji-panjang')
            ->assertSuccessful();
        $this->assertDatabaseHas('users', ['username' => 'kades-lokal', 'role' => 'village_head']);

        $this->artisan('staff:create', ['username' => 'salah-peran', '--role' => 'resident'])->assertFailed();
        $this->artisan('staff:create', ['username' => 'pendek'])
            ->expectsQuestion('Kata sandi (minimal 12 karakter)', 'pendek')
            ->assertFailed();
        $this->assertDatabaseMissing('users', ['username' => 'pendek']);
    }
}
