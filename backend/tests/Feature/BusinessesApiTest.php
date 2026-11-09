<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Usaha, pemilik, nomor WhatsApp, foto, dan akun di sini fiktif. */
class BusinessesApiTest extends TestCase
{
    use RefreshDatabase;

    private const OWNER = 'Pemilik Fiktif Rahasia';
    private const PHONE = '6280000000001';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    private function act(string $role = 'staff', ?array $abilities = null): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002']);
        Sanctum::actingAs($user, $abilities ?? $user->abilities());
        return $user;
    }

    private function payload(array $override = []): array
    {
        return array_replace([
            'name' => 'Keripik Fiktif', 'category' => 'makanan_minuman', 'description' => "Baris satu.\nBaris dua.",
            'hamlet' => 'Talang', 'owner_name' => self::OWNER, 'whatsapp' => self::PHONE, 'consent_public_contact' => false, 'status' => 'draft',
        ], $override);
    }

    private function make(array $attributes = []): Business
    {
        $business = new Business(array_replace([
            'name' => 'Usaha Fiktif', 'category' => 'kerajinan', 'description' => 'Deskripsi fiktif.',
            'owner_name' => self::OWNER, 'whatsapp' => self::PHONE, 'consent_public_contact' => false, 'status' => 'published',
        ], array_diff_key($attributes, ['slug' => 1, 'published_at' => 1, 'photo_path' => 1])));
        $business->forceFill([
            'slug' => $attributes['slug'] ?? 'usaha-'.uniqid(),
            'published_at' => array_key_exists('published_at', $attributes) ? $attributes['published_at'] : now()->subHour(),
            'photo_path' => $attributes['photo_path'] ?? null,
        ])->save();
        return $business;
    }

    private function auditActions(int $id): array
    {
        return DB::table('audit_logs')->where('subject_type', 'business')->where('subject_id', $id)->orderBy('id')->pluck('action')->all();
    }

    private function image(int $width = 2000, int $height = 1200): UploadedFile
    {
        if (! extension_loaded('gd')) $this->markTestSkipped('php-gd diperlukan untuk tes foto UMKM.');
        if (! function_exists('imagejpeg')) $this->markTestSkipped('GD tanpa JPEG; fallback JPEG butuh php-gd dengan JPEG.');
        return UploadedFile::fake()->image('foto.png', $width, $height);
    }

    public function test_public_without_consent_never_leaks_owner_or_whatsapp(): void
    {
        $this->make(['slug' => 'tanpa-izin', 'name' => 'A Tanpa Izin']);
        $this->make(['slug' => 'dengan-izin', 'name' => 'B Dengan Izin', 'consent_public_contact' => true]);
        $list = $this->getJson('/api/v1/businesses')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonPath('total', 2)->assertJsonPath('per_page', 12);
        $this->assertSame(['slug', 'name', 'category', 'category_label', 'description', 'hamlet', 'photo_url', 'published_at'], array_keys($list->json('data.0')));
        $this->assertSame('tanpa-izin', $list->json('data.0.slug'));
        $this->assertSame(['owner_name' => self::OWNER, 'whatsapp' => self::PHONE], array_intersect_key($list->json('data.1'), ['owner_name' => 1, 'whatsapp' => 1]));
        $this->assertArrayNotHasKey('consent_public_contact', $list->json('data.1'));

        $detail = $this->getJson('/api/v1/businesses/tanpa-izin')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public');
        $this->assertStringNotContainsString(self::OWNER, $detail->getContent());
        $this->assertStringNotContainsString(self::PHONE, $detail->getContent());
        $this->assertArrayNotHasKey('owner_name', $detail->json());
        $this->getJson('/api/v1/businesses/dengan-izin')->assertOk()->assertJsonPath('owner_name', self::OWNER)->assertJsonPath('whatsapp', self::PHONE)
            ->assertJsonPath('category_label', 'Kerajinan');
        // Teks list keseluruhan hanya memuat kontak usaha yang memberi izin (satu kali).
        $this->assertSame(1, substr_count($list->getContent(), self::PHONE));
    }

    public function test_owner_and_whatsapp_are_encrypted_at_rest(): void
    {
        $business = $this->make();
        $row = (array) DB::table('businesses')->where('id', $business->id)->first();
        $this->assertNotSame(self::OWNER, $row['owner_name']);
        $this->assertNotSame(self::PHONE, $row['whatsapp']);
        $this->assertStringNotContainsString(self::PHONE, json_encode($row));
        $this->assertSame(self::PHONE, $business->fresh()->whatsapp);
    }

    public function test_draft_future_and_deleted_are_404_and_hidden_from_list(): void
    {
        $this->make(['slug' => 'terbit']);
        $this->make(['slug' => 'draf', 'status' => 'draft', 'published_at' => null]);
        $this->make(['slug' => 'nanti', 'published_at' => now()->addDay()]);
        $this->make(['slug' => 'dihapus'])->delete();
        $this->getJson('/api/v1/businesses')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.slug', 'terbit');
        foreach (['draf', 'nanti', 'dihapus', 'tidak-ada'] as $slug) $this->getJson('/api/v1/businesses/'.$slug)->assertNotFound();
    }

    public function test_public_category_filter_pagination_and_validation(): void
    {
        for ($i = 0; $i < 13; $i++) $this->make(['name' => sprintf('Jasa %02d', $i), 'category' => 'jasa']);
        $this->make(['name' => 'Tani', 'category' => 'pertanian_peternakan']);
        $this->getJson('/api/v1/businesses?category=jasa')->assertOk()->assertJsonPath('total', 13)->assertJsonCount(12, 'data')->assertJsonPath('data.0.name', 'Jasa 00');
        $this->getJson('/api/v1/businesses?category=jasa&page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/businesses?category=pertanian_peternakan')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.category_label', 'Pertanian & Peternakan');
        $this->make(['name' => 'Zebra Terbaru', 'category' => 'jasa', 'published_at' => now()->subMinute()]);
        $this->getJson('/api/v1/businesses?category=jasa&sort=latest')->assertOk()->assertJsonPath('data.0.name', 'Zebra Terbaru');
        $this->getJson('/api/v1/businesses?category=jasa&sort=name')->assertOk()->assertJsonPath('data.0.name', 'Jasa 00');
        $this->getJson('/api/v1/businesses?sort=acak')->assertUnprocessable()->assertJsonValidationErrors('sort');
        $this->getJson('/api/v1/businesses?category=salah')->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->getJson('/api/v1/businesses?page=0')->assertUnprocessable()->assertJsonValidationErrors('page');
    }

    public function test_staff_endpoints_require_token(): void
    {
        $this->getJson('/api/v1/staff/businesses')->assertUnauthorized();
        $this->postJson('/api/v1/staff/businesses', $this->payload())->assertUnauthorized();
        $this->getJson('/api/v1/staff/businesses/1')->assertUnauthorized();
        $this->patchJson('/api/v1/staff/businesses/1', [])->assertUnauthorized();
        $this->deleteJson('/api/v1/staff/businesses/1')->assertUnauthorized();
        $this->postJson('/api/v1/staff/businesses/1/photo')->assertUnauthorized();
        $this->deleteJson('/api/v1/staff/businesses/1/photo')->assertUnauthorized();
    }

    public static function wrongRoles(): array
    {
        return [['village_head'], ['rt_head'], ['rw_head'], ['resident']];
    }

    #[DataProvider('wrongRoles')]
    public function test_wrong_roles_get_403_before_validation_or_lookup(string $role): void
    {
        config(['letters.neighborhood_approval' => true]);
        $business = $this->make();
        $this->act($role);
        $this->getJson('/api/v1/staff/businesses')->assertForbidden()->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson('/api/v1/staff/businesses', [])->assertForbidden();
        $this->getJson('/api/v1/staff/businesses/'.$business->id)->assertForbidden();
        $this->getJson('/api/v1/staff/businesses/999')->assertForbidden();
        $this->patchJson('/api/v1/staff/businesses/'.$business->id, ['name' => 'Ubah'])->assertForbidden();
        $this->deleteJson('/api/v1/staff/businesses/'.$business->id)->assertForbidden();
        $this->postJson('/api/v1/staff/businesses/'.$business->id.'/photo', [])->assertForbidden();
        $this->deleteJson('/api/v1/staff/businesses/'.$business->id.'/photo')->assertForbidden();
        $this->assertSame('Usaha Fiktif', $business->fresh()->name);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_inactive_account_or_missing_ability_get_403(): void
    {
        $this->act()->forceFill(['is_active' => false])->save();
        $this->getJson('/api/v1/staff/businesses')->assertForbidden();
        $this->postJson('/api/v1/staff/businesses', $this->payload())->assertForbidden();
        $this->act('admin', ['other']);
        $this->getJson('/api/v1/staff/businesses')->assertForbidden();
        $this->postJson('/api/v1/staff/businesses', $this->payload())->assertForbidden();
        $this->assertDatabaseCount('businesses', 0);
    }

    public function test_staff_create_publish_update_delete_with_audit_and_stable_slug(): void
    {
        $staff = $this->act();
        $created = $this->postJson('/api/v1/staff/businesses', $this->payload())->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('status', 'draft')->assertJsonPath('published_at', null)->assertJsonPath('slug', 'keripik-fiktif')
            ->assertJsonPath('owner_name', self::OWNER)->assertJsonPath('whatsapp', self::PHONE)->assertJsonPath('consent_public_contact', false);
        $id = $created->json('id');
        $this->assertSame($staff->id, Business::find($id)->created_by);
        $this->getJson('/api/v1/businesses/keripik-fiktif')->assertNotFound();

        // Nama berubah sebelum terbit → slug ikut; setelah terbit tetap.
        $this->patchJson("/api/v1/staff/businesses/$id", ['name' => 'Keripik Baru'])->assertOk()->assertJsonPath('slug', 'keripik-baru');
        $published = $this->patchJson("/api/v1/staff/businesses/$id", ['status' => 'published'])->assertOk()->json('published_at');
        $this->assertNotNull($published);
        $admin = $this->act('admin');
        $this->patchJson("/api/v1/staff/businesses/$id", ['name' => 'Keripik Lain', 'hamlet' => null, 'whatsapp' => null])->assertOk()
            ->assertJsonPath('slug', 'keripik-baru')->assertJsonPath('hamlet', null)->assertJsonPath('whatsapp', null)->assertJsonPath('owner_name', self::OWNER);
        $this->getJson('/api/v1/businesses/keripik-baru')->assertOk()->assertJsonPath('name', 'Keripik Lain');
        // Kembali ke draf mempertahankan tanggal terbit pertama dan menyembunyikan dari publik.
        $this->patchJson("/api/v1/staff/businesses/$id", ['status' => 'draft'])->assertOk()->assertJsonPath('published_at', $published);
        $this->getJson('/api/v1/businesses/keripik-baru')->assertNotFound();

        $this->deleteJson("/api/v1/staff/businesses/$id")->assertOk()->assertJsonPath('success', true);
        $this->assertSoftDeleted('businesses', ['id' => $id]);
        $this->assertSame($admin->id, Business::withTrashed()->find($id)->updated_by);
        $this->getJson("/api/v1/staff/businesses/$id")->assertNotFound();
        $this->deleteJson("/api/v1/staff/businesses/$id")->assertNotFound();
        $this->assertSame(['business.created', 'business.updated', 'business.updated', 'business.published', 'business.updated', 'business.updated', 'business.deleted'], $this->auditActions($id));

        // Slug terhapus tidak dipakai ulang.
        $this->postJson('/api/v1/staff/businesses', $this->payload(['name' => 'Keripik Baru', 'status' => 'published']))->assertCreated()->assertJsonPath('slug', 'keripik-baru-2');
    }

    public function test_create_as_published_sets_date_and_audits_publish(): void
    {
        $this->act();
        $id = $this->postJson('/api/v1/staff/businesses', $this->payload(['status' => 'published', 'consent_public_contact' => true]))
            ->assertCreated()->json('id');
        $this->assertNotNull(Business::find($id)->published_at);
        $this->assertSame(['business.created', 'business.published'], $this->auditActions($id));
        $this->getJson('/api/v1/businesses/keripik-fiktif')->assertOk()->assertJsonPath('whatsapp', self::PHONE);
    }

    public function test_validation_rejects_bad_input_with_422(): void
    {
        $this->act();
        $this->postJson('/api/v1/staff/businesses', [])->assertUnprocessable()->assertJsonValidationErrors(['name', 'category', 'description', 'status']);
        foreach ([
            'name' => [str_repeat('x', 121), "Nama\tusaha", ['x']],
            'category' => ['makanan', 'Makanan & Minuman', ''],
            'description' => [str_repeat('x', 3001), "Te\x00ks","Teks\tdengan tab"],
            'hamlet' => ['Watu', 'talang', 'Dusun Sekar'],
            'owner_name' => [str_repeat('x', 121), "Nama\nbaris"],
            'whatsapp' => ['081234567890', '+6281234567890', '62 812 3456', '6212345', '62'.str_repeat('1', 14), 'abc'],
            'consent_public_contact' => ['ya', 2],
            'status' => ['archived'],
        ] as $field => $values) {
            foreach ($values as $value) {
                $this->postJson('/api/v1/staff/businesses', $this->payload([$field => $value]))->assertUnprocessable()->assertJsonValidationErrors($field);
            }
        }
        $this->assertDatabaseCount('businesses', 0);
        $max = $this->payload(['name' => str_repeat('n', 120), 'description' => str_repeat('d', 3000), 'hamlet' => null, 'owner_name' => null, 'whatsapp' => '6281234567', 'status' => 'published']);
        $this->postJson('/api/v1/staff/businesses', $max)->assertCreated()->assertJsonPath('hamlet', null)->assertJsonPath('owner_name', null);
        $minimal = array_intersect_key($this->payload(['name' => 'Minimal']), array_flip(['name', 'category', 'description', 'status']));
        $this->postJson('/api/v1/staff/businesses', $minimal)->assertCreated()->assertJsonPath('consent_public_contact', false)->assertJsonPath('whatsapp', null);
        $this->postJson('/api/v1/staff/businesses', $this->payload(['name' => '<b>Usaha</b>', 'description' => '  <script>x</script>  ']))->assertCreated()
            ->assertJsonPath('name', '<b>Usaha</b>')->assertJsonPath('description', '<script>x</script>');
    }

    public function test_staff_list_filters_and_never_includes_contact(): void
    {
        $this->act();
        $this->make(['name' => 'Kopi Fiktif', 'category' => 'makanan_minuman', 'consent_public_contact' => true]);
        $this->make(['name' => 'Anyaman Fiktif', 'status' => 'draft', 'published_at' => null]);
        $this->make(['name' => 'Dihapus Fiktif'])->delete();
        $list = $this->getJson('/api/v1/staff/businesses')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('total', 2);
        $this->assertStringNotContainsString(self::OWNER, $list->getContent());
        $this->assertStringNotContainsString(self::PHONE, $list->getContent());
        $this->assertSame(['id', 'status', 'slug', 'name', 'category', 'category_label', 'hamlet', 'photo_url', 'published_at', 'consent_public_contact', 'updated_at'], array_keys($list->json('data.0')));
        $this->getJson('/api/v1/staff/businesses?status=draft')->assertJsonPath('total', 1)->assertJsonPath('data.0.name', 'Anyaman Fiktif');
        $this->getJson('/api/v1/staff/businesses?category=makanan_minuman')->assertJsonPath('total', 1)->assertJsonPath('data.0.name', 'Kopi Fiktif');
        $this->getJson('/api/v1/staff/businesses?q=KOPI')->assertJsonPath('total', 1);
        $this->getJson('/api/v1/staff/businesses?q=%25')->assertJsonPath('total', 0);
        $this->getJson('/api/v1/staff/businesses?status=x')->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_audit_never_contains_business_content(): void
    {
        $this->act();
        $id = $this->postJson('/api/v1/staff/businesses', $this->payload(['status' => 'published']))->assertCreated()->json('id');
        $this->patchJson("/api/v1/staff/businesses/$id", ['description' => 'Rahasia deskripsi'])->assertOk();
        $this->deleteJson("/api/v1/staff/businesses/$id")->assertOk();
        $audit = json_encode(DB::table('audit_logs')->get());
        foreach (['Keripik', self::OWNER, self::PHONE, 'Rahasia'] as $text) $this->assertStringNotContainsString($text, $audit);
        $this->assertSame(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'created_at'], array_keys((array) DB::table('audit_logs')->first()));
    }

    public function test_photo_upload_reencodes_resizes_replaces_and_deletes(): void
    {
        $this->act();
        $business = $this->make(['slug' => 'foto']);
        $first = $this->post("/api/v1/staff/businesses/{$business->id}/photo", ['file' => $this->image()], ['Accept' => 'application/json'])
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $path = $business->fresh()->photo_path;
        $this->assertMatchesRegularExpression('/\Abusinesses\/[0-9a-f-]{36}\.(webp|jpg)\z/', $path);
        Storage::disk('public')->assertExists($path);
        $this->assertSame(1600, getimagesizefromstring(Storage::disk('public')->get($path))[0]);
        $this->assertSame(Storage::disk('public')->url($path), $first->json('photo_url'));
        $this->getJson('/api/v1/businesses/foto')->assertJsonPath('photo_url', Storage::disk('public')->url($path));

        $this->post("/api/v1/staff/businesses/{$business->id}/photo", ['file' => $this->image(800, 600)], ['Accept' => 'application/json'])->assertOk();
        $second = $business->fresh()->photo_path;
        Storage::disk('public')->assertMissing($path);
        $this->assertSame(800, getimagesizefromstring(Storage::disk('public')->get($second))[0]);

        $this->deleteJson("/api/v1/staff/businesses/{$business->id}/photo")->assertOk()->assertJsonPath('photo_url', null);
        Storage::disk('public')->assertMissing($second);
        $this->assertSame(['business.updated', 'business.updated', 'business.updated'], $this->auditActions($business->id));
    }

    public static function smallPhotos(): array
    {
        return [[519, 385], [599, 400], [600, 399], [1, 1]];
    }

    #[DataProvider('smallPhotos')]
    public function test_small_photo_is_not_upscaled_and_exposes_public_url(int $width, int $height): void
    {
        $this->act();
        $business = $this->make(['slug' => 'foto-kecil']);
        Storage::fake('public', ['url' => 'https://desa.example/media']);
        $response = $this->post("/api/v1/staff/businesses/{$business->id}/photo", ['file' => $this->image($width, $height)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonMissingPath('photo_path');
        $path = $business->fresh()->photo_path;
        $this->assertSame([$width, $height], array_slice(getimagesizefromstring(Storage::disk('public')->get($path)), 0, 2));
        $url = 'https://desa.example/media/'.$path;
        $response->assertJsonPath('photo_url', $url);
        $this->getJson('/api/v1/businesses/foto-kecil')->assertOk()->assertJsonPath('photo_url', $url)->assertJsonMissingPath('photo_path');
        $this->getJson('/api/v1/businesses')->assertJsonPath('data.0.photo_url', $url)->assertJsonMissingPath('data.0.photo_path');
    }

    public function test_photo_size_and_dimension_boundaries_are_accepted(): void
    {
        $this->act();
        $business = $this->make();
        foreach ([$this->image(6000, 400)->size(3072), $this->image(600, 6000)] as $file) {
            $this->post("/api/v1/staff/businesses/{$business->id}/photo", ['file' => $file], ['Accept' => 'application/json'])->assertOk();
        }
    }

    public function test_photo_rejects_invalid_files_without_changing_photo(): void
    {
        $this->act();
        $business = $this->make();
        $url = "/api/v1/staff/businesses/{$business->id}/photo";
        $this->postJson($url, [])->assertUnprocessable()->assertJsonPath('errors.file.0', 'Pilih foto yang akan diunggah.');
        $this->postJson($url, ['file' => 'bukan file'])->assertUnprocessable()->assertJsonPath('errors.file.0', 'Foto harus berupa file yang valid.');
        foreach ([
            [UploadedFile::fake()->create('dokumen.pdf', 10, 'application/pdf'), 'Format foto harus JPG, JPEG, PNG, atau WebP.'],
            [UploadedFile::fake()->createWithContent('palsu.jpg', 'bukan gambar'), 'Lebar foto harus 1–6000 piksel dan tinggi 1–6000 piksel.'],
            [UploadedFile::fake()->image('foto.gif', 600, 400), 'Format foto harus JPG, JPEG, PNG, atau WebP.'],
            [$this->image(6001, 400), 'Lebar foto harus 1–6000 piksel dan tinggi 1–6000 piksel.'],
            [$this->image(600, 6001), 'Lebar foto harus 1–6000 piksel dan tinggi 1–6000 piksel.'],
            [$this->image()->size(3073), 'Ukuran foto maksimal 3072 KiB.'],
        ] as [$file, $message]) {
            $this->post($url, ['file' => $file], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('file')->assertJsonPath('errors.file.0', $message);
        }
        $this->post('/api/v1/staff/businesses/999/photo', ['file' => $this->image()], ['Accept' => 'application/json'])->assertNotFound();
        $this->assertNull($business->fresh()->photo_path);
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_soft_delete_keeps_photo_file(): void
    {
        $this->act();
        $business = $this->make();
        $this->post("/api/v1/staff/businesses/{$business->id}/photo", ['file' => $this->image()], ['Accept' => 'application/json'])->assertOk();
        $path = $business->fresh()->photo_path;
        $this->deleteJson("/api/v1/staff/businesses/{$business->id}")->assertOk();
        Storage::disk('public')->assertExists($path);
    }

    public function test_photo_mutations_share_limit_of_ten_per_minute(): void
    {
        $this->act();
        $business = $this->make();
        for ($i = 0; $i < 10; $i++) $this->deleteJson("/api/v1/staff/businesses/{$business->id}/photo")->assertOk();
        $this->postJson("/api/v1/staff/businesses/{$business->id}/photo", [])->assertStatus(429);
    }

    public function test_delete_preflight_allows_panel_origin_only(): void
    {
        $headers = ['Origin' => 'http://127.0.0.1:3000', 'Access-Control-Request-Method' => 'DELETE', 'Access-Control-Request-Headers' => 'authorization'];
        foreach (['/api/v1/staff/businesses/1', '/api/v1/staff/businesses/1/photo', '/api/v1/staff/posts/1', '/api/v1/staff/posts/1/cover'] as $path) {
            $this->options($path, [], $headers)->assertNoContent()
                ->assertHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3000')
                ->assertHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        }
        // Origin lain tidak mendapat izin CORS walau DELETE diizinkan.
        $this->options('/api/v1/staff/businesses/1', [], ['Origin' => 'https://evil.example'] + $headers)->assertHeaderMissing('Access-Control-Allow-Origin');
        // Preflight bukan otorisasi: DELETE tanpa token tetap 401.
        $this->deleteJson('/api/v1/staff/businesses/1', [], ['Origin' => 'http://127.0.0.1:3000'])->assertUnauthorized();
    }

    public function test_public_throttle(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.150']);
        for ($i = 0; $i < 60; $i++) $this->getJson('/api/v1/businesses')->assertOk();
        $this->getJson('/api/v1/businesses')->assertStatus(429);
    }
}
