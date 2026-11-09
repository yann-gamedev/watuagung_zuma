<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\LetterPayloads;
use Tests\TestCase;

/** Peran KIM: hanya berita dan UMKM. Akun, berita, dan usaha di sini fiktif. */
class KimRoleTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    private function login(string $role, bool $active = true): array
    {
        $user = User::factory()->create(['role' => $role, 'username' => "uji-$role", 'password' => 'kata-sandi-uji-panjang', 'is_active' => $active]);
        $token = $this->postJson('/api/v1/staff/login', ['username' => $user->username, 'password' => 'kata-sandi-uji-panjang'])->assertOk()->json('token');
        return [$user, $token];
    }

    /** @return list<Route> route petugas di grup ability tertentu, dibaca dari router agar route baru ikut teruji. */
    private function routesWithAbility(string $ability): array
    {
        $routes = array_values(array_filter(app('router')->getRoutes()->getRoutes(),
            fn (Route $route) => in_array("abilities:$ability", $route->gatherMiddleware(), true)));
        $this->assertNotEmpty($routes, "Tidak ada route dengan abilities:$ability");
        return $routes;
    }

    private function hit(Route $route, string $token)
    {
        $this->app['auth']->forgetGuards();
        $uri = preg_replace(['/\{application(:[a-z_]+)?\}|\{request_id\}/', '/\{id\}/', '/\{key\}/'], ['REQ-2026-FIKTIF', '1', 'profile'], $route->uri());
        $method = collect($route->methods())->first(fn ($m) => $m !== 'HEAD');
        return $this->withToken($token)->json($method, '/'.$uri);
    }

    public function test_kim_token_has_only_panel_and_media_abilities(): void
    {
        [$user] = $this->login('kim');
        $this->assertSame(['panel', 'media:manage'], $user->tokens()->first()->abilities);
        $this->assertSame([], \App\Domain\ApplicationStatus::allowedFor('SUBMITTED', 'kim', \App\Domain\LetterType::Sku));
    }

    public function test_me_reports_abilities_per_role(): void
    {
        $expected = [
            'kim' => ['panel', 'media:manage'],
            'staff' => ['panel', 'applications:manage', 'media:manage', 'site:manage'],
            'admin' => ['panel', 'applications:manage', 'media:manage', 'site:manage'],
            'village_head' => ['panel', 'applications:manage'],
        ];
        foreach ($expected as $role => $abilities) {
            [, $token] = $this->login($role);
            $this->app['auth']->forgetGuards();
            $this->withToken($token)->getJson('/api/v1/staff/me')->assertOk()->assertJsonPath('role', $role)->assertJsonPath('abilities', $abilities);
        }
    }

    public function test_kim_gets_403_on_every_application_and_site_route(): void
    {
        [, $token] = $this->login('kim');
        foreach (['applications:manage', 'site:manage'] as $ability) {
            foreach ($this->routesWithAbility($ability) as $route) {
                $this->assertSame(403, $this->hit($route, $token)->status(), implode('|', $route->methods()).' '.$route->uri());
            }
        }
        $this->assertSame(0, DB::table('audit_logs')->count());
    }

    public function test_kim_is_rejected_by_controllers_even_with_leaked_abilities(): void
    {
        $this->postJson('/api/v1/applications', self::letterPayload('UMUM'))->assertCreated();
        DB::table('applications')->update(['request_id' => 'REQ-2026-FIKTIF']);
        $kim = User::factory()->create(['role' => 'kim']);
        $token = $kim->createToken('bocor', ['panel', 'applications:manage', 'media:manage', 'site:manage'])->plainTextToken;
        foreach (['applications:manage', 'site:manage'] as $ability) {
            foreach ($this->routesWithAbility($ability) as $route) {
                $this->assertSame(403, $this->hit($route, $token)->status(), implode('|', $route->methods()).' '.$route->uri());
            }
        }
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/applications')->assertForbidden();
    }

    public function test_village_head_gets_no_media_or_site(): void
    {
        [, $token] = $this->login('village_head');
        foreach (['media:manage', 'site:manage'] as $ability) {
            foreach ($this->routesWithAbility($ability) as $route) {
                $this->assertSame(403, $this->hit($route, $token)->status(), implode('|', $route->methods()).' '.$route->uri());
            }
        }
    }

    public function test_kim_crud_posts_and_businesses_with_audit(): void
    {
        Storage::fake('public');
        [$kim, $token] = $this->login('kim');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/posts')->assertOk();
        $post = $this->withToken($token)->postJson('/api/v1/staff/posts', [
            'title' => 'Kerja Bakti Fiktif', 'category' => 'kegiatan_desa', 'summary' => 'Ringkasan fiktif.', 'body' => 'Isi fiktif.', 'status' => 'draft',
        ])->assertCreated()->json('id');
        $this->withToken($token)->patchJson("/api/v1/staff/posts/$post", ['status' => 'published'])->assertOk()->assertJsonPath('status', 'published');
        $this->withToken($token)->getJson("/api/v1/staff/posts/$post")->assertOk();

        $this->withToken($token)->getJson('/api/v1/staff/businesses')->assertOk();
        $business = $this->withToken($token)->postJson('/api/v1/staff/businesses', [
            'name' => 'Keripik Fiktif', 'category' => 'makanan_minuman', 'description' => 'Deskripsi fiktif.', 'hamlet' => 'Talang',
            'owner_name' => 'Pemilik Fiktif', 'whatsapp' => '6280000000001', 'consent_public_contact' => false, 'status' => 'published',
        ])->assertCreated()->json('id');
        $this->withToken($token)->patchJson("/api/v1/staff/businesses/$business", ['name' => 'Keripik Fiktif Baru'])->assertOk();

        $this->withToken($token)->deleteJson("/api/v1/staff/posts/$post")->assertOk();
        $this->withToken($token)->deleteJson("/api/v1/staff/businesses/$business")->assertOk();
        $this->assertSoftDeleted(Post::withTrashed()->find($post));
        $this->assertSoftDeleted(Business::withTrashed()->find($business));

        $actions = DB::table('audit_logs')->where('user_id', $kim->id)->pluck('action')->all();
        foreach (['post.created', 'post.published', 'post.updated', 'post.deleted', 'business.created', 'business.published', 'business.updated', 'business.deleted'] as $action) {
            $this->assertContains($action, $actions);
        }
        $this->assertSame(0, DB::table('audit_logs')->whereNot('user_id', $kim->id)->count());
    }

    public function test_kim_uploads_and_removes_media_photos(): void
    {
        if (! function_exists('imagewebp') && ! function_exists('imagejpeg')) {
            $this->markTestSkipped('GD JPEG or WebP required for KIM photo test.');
        }
        Storage::fake('public');
        [$kim, $token] = $this->login('kim');
        $post = Post::create(['title' => 'Foto Fiktif', 'slug' => 'foto-fiktif', 'category' => 'kegiatan_desa', 'summary' => 'Ringkasan.', 'body' => 'Isi.', 'status' => 'draft']);
        $business = Business::forceCreate(['name' => 'Usaha Fiktif', 'slug' => 'usaha-fiktif', 'category' => 'jasa', 'description' => 'Deskripsi.', 'status' => 'draft']);
        $this->app['auth']->forgetGuards();
        foreach ([['posts', $post, 'cover'], ['businesses', $business, 'photo']] as [$resource, $model, $field]) {
            $uri = "/api/v1/staff/$resource/{$model->id}/$field";
            $this->withToken($token)->post($uri, ['file' => UploadedFile::fake()->image('foto.png', 800, 600)], ['Accept' => 'application/json'])
                ->assertOk()->assertJsonPath('id', $model->id);
            $path = $model->fresh()->{$field.'_path'};
            Storage::disk('public')->assertExists($path);
            $this->withToken($token)->deleteJson($uri)->assertOk()->assertJsonPath($field.'_url', null);
            Storage::disk('public')->assertMissing($path);
            $this->assertSame(2, DB::table('audit_logs')->where('user_id', $kim->id)->where('action', $resource === 'posts' ? 'post.updated' : 'business.updated')->count());
        }
    }

    public function test_ability_migration_revokes_old_tokens_without_restoring_them(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $token = $user->createToken('staff', ['applications:manage'])->plainTextToken;
        $migration = require database_path('migrations/2026_11_08_000001_revoke_staff_tokens_for_abilities.php');
        $migration->up();
        $this->assertSame(0, $user->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/me')->assertUnauthorized();
        $migration->down();
        $this->assertSame(0, $user->tokens()->count());
        $this->assertTrue($user->fresh()->is_active);
    }

    public function test_deactivated_kim_loses_tokens_and_access(): void
    {
        [$kim, $token] = $this->login('kim');
        [, $adminToken] = $this->login('admin');
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)->patchJson("/api/v1/staff/users/{$kim->id}", ['name' => $kim->name, 'role' => 'kim', 'is_active' => false])->assertOk();
        $this->assertSame(0, $kim->tokens()->count());
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/posts')->assertUnauthorized();
        $this->postJson('/api/v1/staff/login', ['username' => $kim->username, 'password' => 'kata-sandi-uji-panjang'])->assertUnauthorized();
    }

    public function test_admin_creates_kim_without_territory_and_last_admin_rule_holds(): void
    {
        [$admin, $token] = $this->login('admin');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/v1/staff/users', [
            'name' => 'Pengelola KIM Fiktif', 'username' => 'kim-baru', 'role' => 'kim', 'password' => 'kata-sandi-uji-panjang', 'rt' => '1', 'rw' => '2',
        ])->assertCreated()->assertJsonPath('role', 'kim')->assertJsonPath('rt', null)->assertJsonPath('rw', null);
        $this->withToken($token)->patchJson("/api/v1/staff/users/{$admin->id}", ['name' => $admin->name, 'role' => 'kim', 'is_active' => true])
            ->assertUnprocessable();
        $this->assertSame('admin', $admin->fresh()->role);
    }

    public function test_kim_cannot_manage_users(): void
    {
        [, $token] = $this->login('kim');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/staff/users')->assertForbidden();
        $this->withToken($token)->postJson('/api/v1/staff/me/password', ['old_password' => 'kata-sandi-uji-panjang', 'password' => 'kata-sandi-baru-panjang'])->assertOk();
    }
}
