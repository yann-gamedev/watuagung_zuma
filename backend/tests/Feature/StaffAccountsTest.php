<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Akun dan permohonan di sini fiktif. */
class StaffAccountsTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'staff', array $attributes = []): User
    {
        return User::factory()->create($attributes + [
            'name' => 'Akun Fiktif',
            'username' => $role.'-'.Str::lower(Str::random(6)),
            'email' => Str::lower(Str::random(6)).'@example.test',
            'password' => 'test-password-only',
            'role' => $role,
        ]);
    }

    private function login(User $user, string $password = 'test-password-only'): string
    {
        $this->app['auth']->forgetGuards();

        $token = $this->postJson('/api/v1/staff/login', ['username' => $user->username, 'password' => $password])
            ->assertOk()->json('token');
        $this->app['auth']->forgetGuards();

        return $token;
    }

    private function admin(): User
    {
        return $this->user('admin', ['username' => 'admin-fiktif', 'email' => 'admin@example.test']);
    }

    private function forgetGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }

    private function createPayload(array $attributes = []): array
    {
        return $attributes + [
            'name' => 'Petugas Baru Fiktif',
            'username' => 'petugas-baru',
            'role' => 'staff',
            'password' => 'sandi-sementara',
        ];
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

    public function test_admin_can_list_and_create_accounts(): void
    {
        $admin = $this->admin();
        $token = $this->login($admin);

        $this->withToken($token)->getJson('/api/v1/staff/users')
            ->assertOk()
            ->assertJsonPath('data.0.username', 'admin-fiktif')
            ->assertJsonMissingPath('data.0.email');

        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'role' => 'rt_head', 'rt' => '3', 'rw' => '01',
        ]))->assertCreated()
            ->assertJsonPath('name', 'Petugas Baru Fiktif')
            ->assertJsonPath('role', 'rt_head')
            ->assertJsonPath('rt', '003')
            ->assertJsonPath('rw', '001')
            ->assertJsonPath('is_active', true)
            ->assertJsonPath('must_change_password', true);

        $this->assertDatabaseHas('users', ['username' => 'petugas-baru', 'email' => null, 'rt' => '003', 'rw' => '001']);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'user.created', 'subject_type' => 'user']);
    }

    public function test_guest_and_non_admin_accounts_are_forbidden(): void
    {
        $this->getJson('/api/v1/staff/users')->assertUnauthorized();
        $this->postJson('/api/v1/staff/users', $this->createPayload())->assertUnauthorized();

        foreach (['staff', 'village_head'] as $role) {
            $user = $this->user($role);
            $token = $this->login($user);
            $this->withToken($token)->getJson('/api/v1/staff/users')->assertForbidden()->assertJsonMissingPath('data');
            $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload(['username' => 'baru-'.$role]))->assertForbidden();
            $this->withToken($token)->patchJson('/api/v1/staff/users/'.$user->id, ['name' => 'X', 'role' => 'staff', 'is_active' => true])->assertForbidden();
            $this->withToken($token)->postJson('/api/v1/staff/users/'.$user->id.'/reset-password', ['password' => 'sandi-baru-sekali'])->assertForbidden();
        }
    }

    public function test_create_validation_and_username_rules(): void
    {
        $token = $this->login($this->admin());

        foreach ([
            [[], ['name', 'username', 'role', 'password']],
            [$this->createPayload(['username' => 'UPPERCASE']), ['username']],
            [$this->createPayload(['username' => 'spasi salah']), ['username']],
            [$this->createPayload(['password' => 'pendek']), ['password']],
            [$this->createPayload(['role' => 'resident']), ['role']],
            [$this->createPayload(['role' => 'rt_head']), ['rt']],
            [$this->createPayload(['role' => 'rw_head']), ['rw']],
        ] as [$payload, $errors]) {
            $this->withToken($token)->postJson('/api/v1/staff/users', $payload)
                ->assertUnprocessable()->assertJsonValidationErrors($errors);
        }

        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload())->assertCreated();
        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload())->assertUnprocessable()->assertJsonValidationErrors('username');
    }

    public function test_new_account_must_change_password_and_other_tokens_are_revoked(): void
    {
        $token = $this->login($this->admin());
        $created = $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload(['role' => 'staff']))->assertCreated()->json();
        $staff = User::findOrFail($created['id']);
        $this->assertTrue($staff->must_change_password);

        $first = $this->login($staff, 'sandi-sementara');
        $this->assertNotNull($staff->fresh()->last_login_at);
        $this->forgetGuards();
        $this->withToken($first)->getJson('/api/v1/staff/me')
            ->assertOk()->assertJsonPath('must_change_password', true);
        $second = $this->login($staff, 'sandi-sementara');

        $this->withToken($first)->postJson('/api/v1/staff/me/password', ['old_password' => 'salah', 'password' => 'sandi-baru-panjang'])
            ->assertUnprocessable()->assertJsonValidationErrors('old_password');
        $this->withToken($first)->postJson('/api/v1/staff/me/password', ['old_password' => 'sandi-sementara', 'password' => 'pendek'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->withToken($first)->postJson('/api/v1/staff/me/password', ['old_password' => 'sandi-sementara', 'password' => 'sandi-baru-panjang'])
            ->assertOk()->assertJsonPath('success', true);
        $this->assertFalse($staff->fresh()->must_change_password);
        $this->forgetGuards();
        $this->withToken($first)->getJson('/api/v1/staff/me')->assertOk()->assertJsonPath('must_change_password', false);
        $this->forgetGuards();
        $this->withToken($second)->getJson('/api/v1/staff/me')->assertUnauthorized();
    }

    public function test_inactive_account_cannot_login_and_its_tokens_are_revoked(): void
    {
        $adminToken = $this->login($this->admin());
        $created = $this->withToken($adminToken)->postJson('/api/v1/staff/users', $this->createPayload())->assertCreated()->json();
        $staff = User::findOrFail($created['id']);
        $staffToken = $this->login($staff, 'sandi-sementara');

        $this->withToken($adminToken)->patchJson('/api/v1/staff/users/'.$staff->id, [
            'name' => $staff->name, 'role' => 'staff', 'is_active' => false,
        ])->assertOk()->assertJsonPath('is_active', false);

        $this->forgetGuards();
        $this->withToken($staffToken)->getJson('/api/v1/staff/me')->assertUnauthorized();
        $this->postJson('/api/v1/staff/login', ['username' => $staff->username, 'password' => 'sandi-sementara'])
            ->assertUnauthorized()->assertExactJson(['message' => 'Kredensial tidak valid.']);
    }

    public function test_admin_cannot_deactivate_or_demote_self_and_an_admin_always_remains(): void
    {
        $admin = $this->admin();
        $token = $this->login($admin);

        foreach ([
            ['name' => 'Admin Fiktif', 'role' => 'admin', 'is_active' => false],
            ['name' => 'Admin Fiktif', 'role' => 'staff', 'is_active' => true],
        ] as $payload) {
            $this->withToken($token)->patchJson('/api/v1/staff/users/'.$admin->id, $payload)
                ->assertUnprocessable()->assertJsonValidationErrors('role');
        }

        $other = $this->user('admin', ['username' => 'admin-lain']);
        $this->withToken($token)->patchJson('/api/v1/staff/users/'.$other->id, [
            'name' => $other->name, 'role' => 'admin', 'is_active' => false,
        ])->assertOk();
        $this->assertSame(1, User::where('role', 'admin')->where('is_active', true)->count());
    }

    public function test_only_one_active_head_per_territory(): void
    {
        $token = $this->login($this->admin());
        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rt-satu', 'role' => 'rt_head', 'rt' => '001', 'rw' => '001',
        ]))->assertCreated();
        $first = User::where('username', 'rt-satu')->firstOrFail();

        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rt-dua', 'role' => 'rt_head', 'rt' => '1', 'rw' => '1',
        ]))->assertUnprocessable()->assertJsonValidationErrors('rt');

        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rt-beda', 'role' => 'rt_head', 'rt' => '002', 'rw' => '001',
        ]))->assertCreated();

        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rw-satu', 'role' => 'rw_head', 'rw' => '001',
        ]))->assertCreated();
        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rw-dua', 'role' => 'rw_head', 'rw' => '1',
        ]))->assertUnprocessable()->assertJsonValidationErrors('rw');

        $this->withToken($token)->patchJson('/api/v1/staff/users/'.$first->id, [
            'name' => $first->name, 'role' => 'rt_head', 'rt' => '001', 'rw' => '001', 'is_active' => false,
        ])->assertOk();
        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rt-pengganti', 'role' => 'rt_head', 'rt' => '001', 'rw' => '001',
        ]))->assertCreated();

        $this->withToken($token)->patchJson('/api/v1/staff/users/'.$first->id, [
            'name' => $first->name, 'role' => 'rt_head', 'rt' => '001', 'rw' => '001', 'is_active' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors('rt');
    }

    public function test_reset_password_revokes_tokens_sets_flag_and_is_audited(): void
    {
        $admin = $this->admin();
        $adminToken = $this->login($admin);
        $created = $this->withToken($adminToken)->postJson('/api/v1/staff/users', $this->createPayload())->assertCreated()->json();
        $staff = User::findOrFail($created['id']);
        $staffToken = $this->login($staff, 'sandi-sementara');

        $this->withToken($adminToken)->postJson('/api/v1/staff/users/'.$staff->id.'/reset-password', ['password' => 'sandi-temp-baru'])
            ->assertOk()->assertJsonPath('success', true);

        $this->forgetGuards();
        $this->withToken($staffToken)->getJson('/api/v1/staff/me')->assertUnauthorized();
        $this->assertTrue($staff->fresh()->must_change_password);
        $response = $this->postJson('/api/v1/staff/login', ['username' => $staff->username, 'password' => 'sandi-temp-baru'])->assertOk();
        $response->assertJsonPath('must_change_password', true);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'user.password_reset', 'subject_id' => $staff->id]);
    }

    public function test_account_updates_are_audited_and_roles_can_change(): void
    {
        $admin = $this->admin();
        $token = $this->login($admin);
        $created = $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload())->assertCreated()->json();
        $staff = User::findOrFail($created['id']);

        $this->withToken($token)->patchJson('/api/v1/staff/users/'.$staff->id, [
            'name' => 'Nama Baru Fiktif', 'role' => 'village_head', 'is_active' => true,
        ])->assertOk()->assertJsonPath('name', 'Nama Baru Fiktif')->assertJsonPath('role', 'village_head');

        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'action' => 'user.updated', 'subject_id' => $staff->id]);
    }

    public function test_warnings_list_territories_with_pending_applications_without_active_heads(): void
    {
        $token = $this->login($this->admin());
        $this->application(['status' => 'SUBMITTED', 'rt' => '003', 'rw' => '001']);
        $this->application(['status' => 'RT_APPROVED', 'rt' => '003', 'rw' => '002']);

        $warnings = $this->withToken($token)->getJson('/api/v1/staff/users')->assertOk()->json('warnings');
        $this->assertContains(['role' => 'rt_head', 'rt' => '003', 'rw' => '001', 'pending' => 1], $warnings);
        $this->assertContains(['role' => 'rw_head', 'rt' => null, 'rw' => '002', 'pending' => 1], $warnings);

        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rt-wilayah', 'role' => 'rt_head', 'rt' => '003', 'rw' => '001',
        ]))->assertCreated();
        $this->withToken($token)->postJson('/api/v1/staff/users', $this->createPayload([
            'username' => 'rw-wilayah', 'role' => 'rw_head', 'rw' => '002',
        ]))->assertCreated();

        $this->assertSame([], $this->withToken($token)->getJson('/api/v1/staff/users')->assertOk()->json('warnings'));
    }
}
