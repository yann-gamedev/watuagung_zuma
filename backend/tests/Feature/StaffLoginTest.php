<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StaffLoginTest extends TestCase
{
    use RefreshDatabase;

    private function staff(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'username' => 'petugas-fiktif',
            'email' => 'petugas@example.test',
            'password' => 'test-password-only',
            'role' => 'staff',
        ], $attributes));
    }

    public function test_username_login_issues_scoped_token_and_logout_revokes_it(): void
    {
        $user = $this->staff();
        $this->assertTrue(Hash::check('test-password-only', $user->password));
        $response = $this->postJson('/api/v1/staff/login', [
            'username' => $user->username, 'password' => 'test-password-only',
        ])->assertOk()->assertJsonPath('user.role', 'staff');
        $this->assertArrayNotHasKey('password', $response->json('user'));
        $this->assertSame(['applications:manage'], $user->tokens()->first()->abilities);
        $token = $response->json('token');
        $this->withToken($token)->getJson('/api/v1/staff/applications')->assertOk();
        $this->withToken($token)->postJson('/api/v1/staff/logout')->assertOk();
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_admin_can_login_by_username(): void
    {
        $user = $this->staff(['role' => 'admin']);
        $this->postJson('/api/v1/staff/login', [
            'username' => $user->username, 'password' => 'test-password-only',
        ])->assertOk()->assertJsonPath('user.role', 'admin');
    }

    public function test_existing_email_only_account_can_still_login(): void
    {
        $user = $this->staff(['username' => null]);
        $this->postJson('/api/v1/staff/login', [
            'email' => $user->email, 'password' => 'test-password-only',
        ])->assertOk();
    }

    public function test_wrong_password_unknown_username_and_disallowed_role_are_rejected(): void
    {
        $user = $this->staff();
        foreach ([['petugas-fiktif', 'wrong'], ['unknown', 'test-password-only']] as [$username, $password]) {
            $this->postJson('/api/v1/staff/login', compact('username', 'password'))
                ->assertUnauthorized()->assertExactJson(['message' => 'Kredensial tidak valid.']);
        }
        $user->update(['role' => 'resident']);
        $this->postJson('/api/v1/staff/login', [
            'username' => $user->username, 'password' => 'test-password-only',
        ])->assertUnauthorized();
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_identifiers_are_validated_and_cannot_be_combined(): void
    {
        $this->postJson('/api/v1/staff/login', ['password' => 'test-password-only'])
            ->assertUnprocessable()->assertJsonValidationErrors(['username', 'email']);
        foreach (['not valid!', str_repeat('a', 65), 'UPPERCASE'] as $username) {
            $this->postJson('/api/v1/staff/login', ['username' => $username, 'password' => 'test-password-only'])
                ->assertUnprocessable()->assertJsonValidationErrors('username');
        }
        $this->postJson('/api/v1/staff/login', [
            'username' => 'petugas-fiktif', 'email' => 'petugas@example.test', 'password' => 'test-password-only',
        ])->assertUnprocessable();
    }

    public function test_username_is_unique_but_legacy_accounts_can_have_null_usernames(): void
    {
        $this->staff(['username' => null]);
        $this->staff(['username' => null, 'email' => 'second@example.test']);
        $this->staff(['email' => 'third@example.test']);
        $this->expectException(QueryException::class);
        $this->staff(['email' => 'fourth@example.test']);
    }

    public function test_login_remains_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/staff/login', ['username' => 'unknown', 'password' => 'wrong'])
                ->assertUnauthorized();
        }
        $this->postJson('/api/v1/staff/login', ['username' => 'unknown', 'password' => 'wrong'])
            ->assertTooManyRequests();
    }
}
