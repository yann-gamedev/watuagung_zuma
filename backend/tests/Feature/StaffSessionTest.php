<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class StaffSessionTest extends TestCase
{
    use RefreshDatabase;

    private function staff(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'name' => 'Petugas Fiktif',
            'username' => 'petugas-fiktif',
            'email' => 'petugas@example.test',
            'password' => 'test-password-only',
            'role' => 'staff',
        ], $attributes));
    }

    private function loginToken(User $user): string
    {
        return $this->postJson('/api/v1/staff/login', [
            'username' => $user->username, 'password' => 'test-password-only',
        ])->assertOk()->json('token');
    }

    /** The auth guard caches the user between requests inside one test. */
    private function me(?string $token = null)
    {
        $this->app['auth']->forgetGuards();
        return $token ? $this->withToken($token)->getJson('/api/v1/staff/me') : $this->getJson('/api/v1/staff/me');
    }

    public function test_me_returns_only_public_profile_for_panel_roles(): void
    {
        foreach (['staff', 'village_head', 'admin'] as $i => $role) {
            $user = $this->staff(['role' => $role, 'username' => "petugas-$i", 'email' => "p$i@example.test"]);
            $this->me($this->loginToken($user))
                ->assertOk()
                ->assertExactJson(['name' => 'Petugas Fiktif', 'username' => "petugas-$i", 'role' => $role, 'rt' => null, 'rw' => null, 'must_change_password' => false]);
        }
    }

    public function test_me_supports_legacy_accounts_without_username(): void
    {
        $user = $this->staff(['username' => null]);
        $token = $this->postJson('/api/v1/staff/login', [
            'email' => $user->email, 'password' => 'test-password-only',
        ])->assertOk()->json('token');
        $this->me($token)->assertOk()->assertExactJson(['name' => 'Petugas Fiktif', 'username' => null, 'role' => 'staff', 'rt' => null, 'rw' => null, 'must_change_password' => false]);
    }

    public function test_me_requires_a_token(): void
    {
        $this->me()->assertUnauthorized();
        $this->me('1|not-a-real-token')->assertUnauthorized();
    }

    public function test_token_expires_after_configured_minutes(): void
    {
        $this->assertSame(480, config('sanctum.expiration'));
        $token = $this->loginToken($this->staff());
        $this->travel(479)->minutes();
        $this->me($token)->assertOk();
        $this->travel(2)->minutes();
        $this->me($token)->assertUnauthorized();
        $this->getJson('/api/v1/staff/applications')->assertUnauthorized();
    }

    public function test_revoked_token_is_rejected(): void
    {
        $token = $this->loginToken($this->staff());
        $this->me($token)->assertOk();
        PersonalAccessToken::query()->delete();
        $this->me($token)->assertUnauthorized();
    }

    public function test_logout_revokes_token_for_me(): void
    {
        $token = $this->loginToken($this->staff());
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/v1/staff/logout')->assertOk();
        $this->me($token)->assertUnauthorized();
    }

    public function test_role_changed_after_login_is_forbidden(): void
    {
        $user = $this->staff();
        $token = $this->loginToken($user);
        $user->update(['role' => 'resident']);
        $this->me($token)->assertForbidden()->assertJsonMissingPath('name');
    }

    public function test_token_without_manage_ability_is_forbidden(): void
    {
        $user = $this->staff();
        $token = $user->createToken('other', ['something:else'])->plainTextToken;
        $this->me($token)->assertForbidden();
    }

    public function test_prune_expired_is_scheduled_daily(): void
    {
        $events = collect($this->app->make(Schedule::class)->events())
            ->filter(fn ($event) => str_contains($event->command ?? '', 'sanctum:prune-expired'));
        $this->assertCount(1, $events);
        $this->assertSame('0 0 * * *', $events->first()->expression);
    }

    public function test_prune_expired_removes_old_tokens_only(): void
    {
        $user = $this->staff();
        $this->loginToken($user);
        $this->travel(480 + 25 * 60)->minutes();
        $this->loginToken($user);
        $this->artisan('sanctum:prune-expired', ['--hours' => 24])->assertSuccessful();
        $this->assertSame(1, $user->tokens()->count());
    }
}
