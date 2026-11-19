<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Regresi: throttle tanpa nama berbagi satu kunci domain|IP, sehingga membuka halaman publik
 * menghabiskan jatah login petugas ("Too Many Attempts" walaupun kata sandi benar).
 */
class ThrottleIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function staff(string $username = 'petugas-fiktif'): User
    {
        return User::factory()->create([
            'username' => $username,
            'email' => $username.'@example.test',
            'password' => 'test-password-only',
            'role' => 'staff',
        ]);
    }

    private function login(string $username, string $password = 'test-password-only', string $ip = '192.0.2.10')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/v1/staff/login', compact('username', 'password'));
    }

    public function test_every_route_throttle_has_its_own_name(): void
    {
        foreach (Route::getRoutes() as $route) {
            foreach ($route->gatherMiddleware() as $middleware) {
                if (is_string($middleware) && str_starts_with($middleware, 'throttle:')) {
                    $this->assertDoesNotMatchRegularExpression(
                        '/^throttle:\d+(,\d+)?$/',
                        $middleware,
                        "Throttle tanpa nama pada {$route->uri()} berbagi kunci dengan rute lain.",
                    );
                }
            }
        }
    }

    public function test_public_browsing_does_not_consume_login_quota(): void
    {
        $this->staff();
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10']);
        for ($i = 0; $i < 6; $i++) {
            $this->getJson('/api/v1/posts')->assertOk();
            $this->getJson('/api/v1/site/profile');
            $this->getJson('/api/v1/businesses')->assertOk();
            $this->postJson('/api/v1/applications/status', ['request_id' => "X{$i}", 'lookup_secret' => 'Y'])->assertNotFound();
        }

        $this->login('petugas-fiktif')->assertOk();
    }

    public function test_citizen_status_check_is_not_blocked_by_public_pages(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.11']);
        for ($i = 0; $i < 12; $i++) {
            $this->getJson('/api/v1/posts')->assertOk();
        }

        $this->postJson('/api/v1/applications/status', ['request_id' => 'X', 'lookup_secret' => 'Y'])->assertNotFound();
    }

    public function test_login_limit_is_per_username_and_ip_with_indonesian_message(): void
    {
        $this->staff('petugas-satu');
        $this->staff('petugas-dua');
        for ($i = 0; $i < 5; $i++) {
            $this->login('petugas-satu', 'salah')
                ->assertUnauthorized()->assertExactJson(['message' => 'Username atau kata sandi salah.']);
        }

        $blocked = $this->login('petugas-satu')->assertStatus(429);
        $seconds = $blocked->json('retry_after');
        $this->assertIsInt($seconds);
        $this->assertGreaterThanOrEqual(1, $seconds);
        $this->assertLessThanOrEqual(60, $seconds);
        $wait = $seconds < 60 ? "{$seconds} detik" : '1 menit';
        $this->assertSame("Terlalu banyak percobaan. Tunggu {$wait}, lalu coba lagi.", $blocked->json('message'));
        $this->assertSame((string) $seconds, $blocked->headers->get('Retry-After'));

        // Rekan sekantor (IP sama) dan username yang sama dari perangkat lain tidak ikut terkunci.
        $this->login('petugas-dua')->assertOk();
        $this->login('petugas-satu', ip: '192.0.2.99')->assertOk();
        // Huruf besar/spasi tidak membuka kuota baru.
        $this->login(' PETUGAS-SATU ')->assertStatus(429);
    }

    public function test_ip_wide_login_limit_stops_guessing_many_usernames(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $this->login("tebakan-{$i}", 'salah')->assertUnauthorized();
        }

        $this->login('tebakan-baru', 'salah')->assertStatus(429)->assertJsonPath('retry_after', fn ($v) => is_int($v) && $v > 0);
    }

    public function test_other_throttled_routes_use_indonesian_message(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.12']);
        for ($i = 0; $i < 60; $i++) {
            $this->getJson('/api/v1/posts')->assertOk();
        }

        $response = $this->getJson('/api/v1/posts')->assertStatus(429);
        $this->assertStringStartsWith('Terlalu banyak percobaan. Tunggu ', $response->json('message'));
        $this->assertStringNotContainsString('Too Many', $response->getContent());
    }
}
