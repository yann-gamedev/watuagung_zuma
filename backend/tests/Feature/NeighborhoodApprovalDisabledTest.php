<?php

namespace Tests\Feature;

use App\Domain\LetterType;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Identitas warga dan akun seluruhnya fiktif. */
class NeighborhoodApprovalDisabledTest extends TestCase
{
    use RefreshDatabase;

    private function payload(string $type): array
    {
        return [
            'jenis_surat' => $type, 'nama' => 'Warga Fiktif',
            'nik' => '0000000000001234', 'no_kk' => '0000000000005678',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Perempuan',
            'alamat' => 'Alamat fiktif', 'rt' => '1', 'rw' => '2', 'telepon' => '08000000000',
            'keperluan' => 'Keperluan fiktif', 'nama_usaha' => 'Usaha Fiktif',
            'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Alamat usaha fiktif',
        ];
    }

    private function actAs(User $user): void
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['applications:manage']);
    }

    public static function letterTypes(): array
    {
        return array_map(fn ($type) => [$type->value], LetterType::cases());
    }

    public static function publicFlags(): array
    {
        $cases = [];
        foreach ([false, true] as $enabled) {
            foreach (LetterType::cases() as $type) {
                $cases[] = [$enabled, $type->value, $enabled && $type !== LetterType::Sku];
            }
        }
        return $cases;
    }

    public function test_neighborhood_approval_is_disabled_by_default(): void
    {
        $this->assertFalse(config('letters.neighborhood_approval'));
        $this->assertSame([], LetterType::neighborhoodValues());
    }

    #[DataProvider('publicFlags')]
    public function test_public_responses_report_workflow_from_letter_type(bool $enabled, string $type, bool $expected): void
    {
        config()->set('letters.neighborhood_approval', $enabled);
        $this->assertSame($expected, LetterType::from($type)->requiresNeighborhoodApproval());
        $receipt = $this->postJson('/api/v1/applications', $this->payload($type))->assertCreated()
            ->assertJsonPath('requires_neighborhood_approval', $expected)->json();
        $this->postJson('/api/v1/applications/status', [
            'request_id' => $receipt['request_id'], 'lookup_secret' => $receipt['lookup_secret'],
        ])->assertOk()->assertJsonPath('requires_neighborhood_approval', $expected);
    }

    #[DataProvider('letterTypes')]
    public function test_all_types_complete_office_workflow_without_neighborhood_approval(string $type): void
    {
        config()->set('letters.neighborhood_approval', false);
        $receipt = $this->postJson('/api/v1/applications', $this->payload($type))->assertCreated()->json();
        $application = Application::where('request_id', $receipt['request_id'])->firstOrFail();
        $staff = User::factory()->create(['role' => 'staff']);
        $admin = User::factory()->create(['role' => 'admin']);
        $head = User::factory()->create(['role' => 'village_head']);
        $url = '/api/v1/staff/applications/'.$application->request_id;
        $this->actAs($staff);
        $this->getJson($url)->assertOk()->assertJsonPath('allowed_transitions', ['VERIFIED', 'NEED_REVISION', 'REJECTED']);
        $this->getJson('/api/v1/staff/summary')->assertOk()->assertJsonPath('my_queue', 1);
        $this->patchJson($url.'/status', ['status' => 'RT_APPROVED'])->assertUnprocessable();
        $this->patchJson($url.'/status', ['status' => 'RW_APPROVED'])->assertUnprocessable();
        foreach ([
            [$staff, 'VERIFIED'], [$admin, 'PROCESSING'], [$staff, 'WAITING_APPROVAL'],
            [$head, 'APPROVED'], [$admin, 'READY_FOR_PICKUP'], [$staff, 'COMPLETED'],
        ] as [$user, $status]) {
            $from = $application->fresh()->status;
            if ($status === 'APPROVED') {
                foreach ([$staff, $admin] as $unauthorized) {
                    $this->actAs($unauthorized);
                    $this->patchJson($url.'/status', ['status' => $status])->assertForbidden();
                }
            }
            $this->actAs($user);
            $this->patchJson($url.'/status', ['status' => $status])->assertOk()->assertJsonPath('status', $status);
            $this->assertDatabaseHas('application_events', [
                'application_id' => $application->id, 'user_id' => $user->id, 'from_status' => $from, 'to_status' => $status,
            ]);
        }
        $this->assertDatabaseHas('letter_numbers', ['application_id' => $application->id, 'status' => 'issued']);
        $this->assertDatabaseHas('letters', ['application_id' => $application->id, 'approved_by' => $head->id]);
        $this->postJson('/api/v1/applications/status', [
            'request_id' => $receipt['request_id'], 'lookup_secret' => $receipt['lookup_secret'],
        ])->assertOk()->assertJsonPath('status', 'COMPLETED')->assertJsonPath('requires_neighborhood_approval', false);
        $this->assertSame(0, DB::table('application_events')->whereIn('to_status', ['RT_APPROVED', 'RW_APPROVED'])->count());
    }

    public static function neighborhoodRoles(): array
    {
        return [['rt_head'], ['rw_head']];
    }

    #[DataProvider('neighborhoodRoles')]
    public function test_disabled_heads_cannot_login_or_use_previously_issued_tokens(string $role): void
    {
        config()->set('letters.neighborhood_approval', true);
        $user = User::factory()->create(['role' => $role, 'username' => 'ketua-fiktif', 'rt' => '001', 'rw' => '002']);
        $token = $this->postJson('/api/v1/staff/login', ['username' => $user->username, 'password' => 'password'])
            ->assertOk()->json('token');
        config()->set('letters.neighborhood_approval', false);
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/staff/login', ['username' => $user->username, 'password' => 'password'])
            ->assertUnauthorized()->assertExactJson(['message' => 'Kredensial tidak valid.']);
        $this->app['auth']->forgetGuards();
        foreach (['me', 'applications', 'summary', 'users'] as $path) {
            $this->withToken($token)->getJson('/api/v1/staff/'.$path)->assertForbidden();
        }
        $this->withToken($token)->postJson('/api/v1/staff/me/password', [
            'old_password' => 'password', 'password' => 'kata-sandi-uji-panjang',
        ])->assertForbidden();
    }

    #[DataProvider('neighborhoodRoles')]
    public function test_disabled_roles_cannot_be_created_assigned_or_activated_but_legacy_can_be_deactivated(string $role): void
    {
        config()->set('letters.neighborhood_approval', false);
        $admin = User::factory()->create(['role' => 'admin']);
        $legacy = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002', 'is_active' => false]);
        $staff = User::factory()->create(['role' => 'staff']);
        $this->actAs($admin);
        $data = ['name' => 'Ketua Fiktif', 'role' => $role, 'rt' => '1', 'rw' => '2'];
        $this->postJson('/api/v1/staff/users', $data + ['username' => 'ketua-baru', 'password' => 'kata-sandi-uji-panjang'])
            ->assertUnprocessable()->assertJsonValidationErrors('role')
            ->assertJsonPath('errors.role.0', 'Persetujuan RT/RW dinonaktifkan. Akun Ketua RT/RW tidak dapat dibuat, ditetapkan, atau diaktifkan.');
        $this->patchJson('/api/v1/staff/users/'.$legacy->id, $data + ['is_active' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('role');
        foreach ([false, true] as $active) {
            $this->patchJson('/api/v1/staff/users/'.$staff->id, $data + ['is_active' => $active])
                ->assertUnprocessable()->assertJsonValidationErrors('role');
        }
        $legacy->update(['is_active' => true]);
        $legacy->createToken('legacy', ['applications:manage']);
        $this->patchJson('/api/v1/staff/users/'.$legacy->id, $data + ['is_active' => false])
            ->assertOk()->assertJsonPath('is_active', false);
        $this->assertSame(0, $legacy->tokens()->count());
        $this->assertSame('staff', $staff->fresh()->role);
        $this->assertDatabaseMissing('users', ['username' => 'ketua-baru']);
        $this->artisan('staff:create', ['username' => 'ketua-cli', '--role' => $role, '--rt' => '1', '--rw' => '2'])
            ->expectsOutput('Persetujuan RT/RW dinonaktifkan. Akun Ketua RT/RW tidak dapat dibuat.')->assertFailed();
        $this->assertDatabaseMissing('users', ['username' => 'ketua-cli']);
    }

    public function test_warnings_are_empty_when_disabled_and_me_reports_current_flag(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        $this->actAs(User::factory()->create(['role' => 'admin']));
        $receipt = $this->postJson('/api/v1/applications', $this->payload('SKTM'))->assertCreated()->json();
        $application = Application::where('request_id', $receipt['request_id'])->firstOrFail();
        foreach (['SUBMITTED', 'RT_APPROVED'] as $status) {
            $application->update(['status' => $status]);
            config()->set('letters.neighborhood_approval', false);
            $this->getJson('/api/v1/staff/users')->assertOk()->assertJsonPath('warnings', []);
            $this->getJson('/api/v1/staff/me')->assertOk()->assertJsonPath('features.neighborhood_approval', false);
            config()->set('letters.neighborhood_approval', true);
            $this->getJson('/api/v1/staff/users')->assertOk()->assertJsonCount(1, 'warnings');
            $this->getJson('/api/v1/staff/me')->assertOk()->assertJsonPath('features.neighborhood_approval', true);
        }
    }
}
