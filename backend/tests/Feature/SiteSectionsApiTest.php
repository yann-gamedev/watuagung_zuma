<?php

namespace Tests\Feature;

use App\Domain\SiteSection as SectionKey;
use App\Domain\SiteSectionRules;
use App\Models\SiteSection;
use App\Models\User;
use Database\Seeders\SiteSectionDefaults;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SiteSectionsApiTest extends TestCase
{
    use RefreshDatabase;

    private function act(string $role = 'staff', array $abilities = ['applications:manage']): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002']);
        Sanctum::actingAs($user, $abilities);
        return $user;
    }

    private function text(): array
    {
        return ['intro' => 'Pengantar fiktif', 'blocks' => [['title' => 'Judul fiktif', 'text' => "Baris satu\nBaris dua"]]];
    }

    private function contact(): array
    {
        return ['address' => 'Alamat kantor fiktif', 'hours' => 'Jam fiktif', 'contactName' => 'Kontak fiktif', 'phone' => '', 'mapsEmbedUrl' => '', 'mapsLinkUrl' => ''];
    }

    public function test_public_missing_and_unknown_keys_are_404_without_audit(): void
    {
        foreach (SectionKey::cases() as $key) $this->getJson('/api/v1/site/'.$key->value)->assertNotFound();
        foreach (['unknown', 'vision', 'visi-misi'] as $key) $this->getJson('/api/v1/site/'.$key)->assertNotFound();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_staff_endpoints_require_token_even_with_invalid_key(): void
    {
        $this->getJson('/api/v1/staff/site/profile')->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
        $this->putJson('/api/v1/staff/site/profile', ['data' => $this->text()])->assertUnauthorized();
        $this->postJson('/api/v1/staff/site/profile/image')->assertUnauthorized();
        $this->getJson('/api/v1/staff/site/unknown')->assertUnauthorized();
    }

    public static function roles(): array
    {
        return [['village_head'], ['rt_head'], ['rw_head'], ['resident']];
    }

    #[DataProvider('roles')]
    public function test_wrong_roles_cannot_read_write_or_upload(string $role): void
    {
        config(['letters.neighborhood_approval' => true]);
        $this->act($role);
        foreach (['profile', 'unknown'] as $key) {
            $this->getJson('/api/v1/staff/site/'.$key)->assertForbidden();
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => $this->text()])->assertForbidden();
            $this->postJson('/api/v1/staff/site/'.$key.'/image')->assertForbidden();
        }
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_inactive_account_and_wrong_ability_are_forbidden(): void
    {
        $this->act()->forceFill(['is_active' => false])->save();
        $this->getJson('/api/v1/staff/site/profile')->assertForbidden();
        $this->putJson('/api/v1/staff/site/profile', [])->assertForbidden();
        $this->postJson('/api/v1/staff/site/profile/image')->assertForbidden();
        $this->act('admin', ['other']);
        $this->getJson('/api/v1/staff/site/profile')->assertForbidden();
        $this->putJson('/api/v1/staff/site/profile', [])->assertForbidden();
        $this->postJson('/api/v1/staff/site/profile/image')->assertForbidden();
    }

    public function test_staff_admin_whole_object_replacement_and_public_safe_response(): void
    {
        $this->freezeSecond();
        $staff = $this->act();
        $this->getJson('/api/v1/staff/site/profile')->assertNotFound();
        foreach (['profile', 'history', 'contact'] as $key) {
            $data = $key === 'contact' ? $this->contact() : $this->text();
            $data[array_key_first($data)] = '  '.$data[array_key_first($data)].'  ';
            $saved = $this->putJson('/api/v1/staff/site/'.$key, ['data' => $data])->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')->json('data');
            $this->assertSame(trim($data[array_key_first($data)]), $saved[array_key_first($data)]);
            $response = $this->getJson('/api/v1/site/'.$key)->assertOk()->assertHeader('Cache-Control', 'max-age=60, public');
            $this->assertSame(['key', 'data', 'updated_at'], array_keys($response->json()));
            $this->assertSame($saved, $this->getJson('/api/v1/staff/site/'.$key)->assertOk()->json('data'));
            $this->assertSame($staff->id, SiteSection::find($key)->updated_by);
        }
        $admin = $this->act('admin');
        $replacement = ['intro' => '<script>fiktif</script>', 'blocks' => [['title' => 'Baru', 'text' => 'Teks baru']]];
        $this->putJson('/api/v1/staff/site/profile', ['data' => $replacement])->assertOk()->assertJsonPath('data', $replacement);
        $this->assertSame($admin->id, SiteSection::find('profile')->updated_by);
        $this->assertDatabaseCount('site_sections', 3);
        $this->assertDatabaseCount('audit_logs', 4);
        $audit = (array) DB::table('audit_logs')->latest('id')->first();
        $this->assertSame(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'created_at'], array_keys($audit));
        $this->assertSame('site.updated', $audit['action']);
        $this->assertSame('site_section', $audit['subject_type']);
        $this->assertSame('profile', $audit['subject_id']);
        $this->assertStringNotContainsString('fiktif', json_encode(DB::table('audit_logs')->get()));
    }

    public function test_profile_history_validation_and_no_silent_unknown_fields(): void
    {
        $this->act();
        $cases = [
            [], ['intro' => 'x'], ['intro' => '', 'blocks' => []],
            ['intro' => str_repeat('x', 2001), 'blocks' => $this->text()['blocks']],
            ['intro' => 'x', 'blocks' => array_fill(0, 21, ['title' => 'x', 'text' => 'y'])],
            ['intro' => 'x', 'blocks' => ['named' => ['title' => 'x', 'text' => 'y']]],
            ['intro' => 'x', 'blocks' => [['title' => str_repeat('x', 161), 'text' => 'y']]],
            ['intro' => 'x', 'blocks' => [['title' => 'x', 'text' => str_repeat('x', 10001)]]],
            ['intro' => 'x', 'blocks' => [['title' => 'x', 'text' => 'y', 'nik' => '0000000000000001']]],
            $this->text() + ['updated_by' => 1],
        ];
        foreach (['profile', 'history'] as $key) {
            foreach ($cases as $data) $this->putJson('/api/v1/staff/site/'.$key, ['data' => $data])->assertUnprocessable();
            foreach (["\0abc", "abc\x7f", "abc\t", "abc\x1b", "abc\n"] as $bad) {
                $this->putJson('/api/v1/staff/site/'.$key, ['data' => array_replace($this->text(), ['intro' => $bad])])->assertUnprocessable();
            }
            $data = $this->text();
            $data['blocks'][0]['text'] = "abc\t";
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => $data])->assertUnprocessable();
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => $this->text(), 'extra' => true])->assertUnprocessable();
            $this->putJson('/api/v1/staff/site/'.$key, ['data' => null])->assertUnprocessable();
        }
        $this->assertDatabaseCount('site_sections', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_contact_validates_all_fields_phone_and_google_maps_urls(): void
    {
        $this->act();
        foreach (array_keys($this->contact()) as $field) {
            $data = $this->contact();
            unset($data[$field]);
            $this->putJson('/api/v1/staff/site/contact', ['data' => $data])->assertUnprocessable();
        }
        $bad = [
            ['address' => str_repeat('x', 1001)], ['hours' => str_repeat('x', 201)], ['contactName' => str_repeat('x', 161)],
            ['phone' => '+620000000000'], ['phone' => "62000\n"], ['phone' => '6200000000000000'],
            ['mapsEmbedUrl' => 'https://www.google.com.evil.test/maps/embed?x=1'],
            ['mapsEmbedUrl' => 'javascript:alert(1)'], ['mapsEmbedUrl' => str_repeat('x', 2049)],
            ['mapsEmbedUrl' => []], ['mapsLinkUrl' => null],
            ['mapsLinkUrl' => 'https://maps.app.goo.gl.evil.test/x'], ['mapsLinkUrl' => '//www.google.com/maps/'],
            ['address' => "\0Alamat"], ['nik' => '0000000000000001'],
        ];
        foreach ($bad as $override) $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), $override)])->assertUnprocessable();
        foreach (['', '[PLACEHOLDER]', '620000000000'] as $phone) {
            $this->putJson('/api/v1/staff/site/contact', ['data' => array_replace($this->contact(), ['phone' => $phone])])->assertOk();
        }
        $valid = array_replace($this->contact(), ['mapsEmbedUrl' => 'https://www.google.com/maps/embed?pb=fiktif', 'mapsLinkUrl' => 'https://maps.app.goo.gl/fiktif']);
        $this->putJson('/api/v1/staff/site/contact', ['data' => $valid])->assertOk();
        $valid['mapsLinkUrl'] = 'https://www.google.com/maps/?q=fiktif';
        $this->putJson('/api/v1/staff/site/contact', ['data' => $valid])->assertOk();
    }

    public function test_reserved_keys_reject_every_payload_and_unknown_keys_are_404(): void
    {
        $this->act();
        foreach (['statistics', 'transparency', 'structure', 'videos'] as $key) {
            foreach ([[], ['data' => []], ['data' => (object) []], ['data' => ['x' => 'y']]] as $payload) {
                $this->putJson('/api/v1/staff/site/'.$key, $payload)->assertUnprocessable()->assertJsonValidationErrors('data');
            }
        }
        $this->getJson('/api/v1/staff/site/unknown')->assertNotFound();
        $this->putJson('/api/v1/staff/site/unknown', [])->assertNotFound();
        $this->postJson('/api/v1/staff/site/unknown/image')->assertNotFound();
        $this->assertDatabaseCount('site_sections', 0);
    }

    public function test_images_disabled_for_every_key_without_storing_originals(): void
    {
        Storage::fake('public');
        $this->act();
        foreach (SectionKey::cases() as $key) {
            $this->post('/api/v1/staff/site/'.$key->value.'/image', ['file' => UploadedFile::fake()->create('fiktif.jpg', 10, 'image/jpeg')], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('file')->assertHeader('Cache-Control', 'no-store, private');
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_import_is_valid_idempotent_and_preserves_existing_even_empty_data(): void
    {
        foreach (SiteSectionDefaults::data() as $key => $data) $this->assertSame($data, SiteSectionRules::validate(SectionKey::from($key), ['data' => $data]));
        SiteSection::create(['key' => 'profile', 'data' => []]);
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 2. Dipertahankan: 1.')->assertSuccessful();
        $this->assertSame([], SiteSection::find('profile')->data);
        $this->artisan('site:import-defaults')->expectsOutput('Dibuat: 0. Dipertahankan: 3.')->assertSuccessful();
        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseCount('site_sections', 3);
        foreach (['contact', 'history'] as $key) $this->assertSame(SiteSectionDefaults::data()[$key], SiteSection::find($key)->data);
        $this->getJson('/api/v1/site/history')->assertOk();
    }

    public function test_audit_failure_rolls_back_create_and_replace(): void
    {
        $this->act();
        SiteSection::create(['key' => 'profile', 'data' => $this->text()]);
        DB::statement('DROP TABLE audit_logs');
        $this->putJson('/api/v1/staff/site/history', ['data' => $this->text()])->assertStatus(500);
        $this->putJson('/api/v1/staff/site/profile', ['data' => ['intro' => 'Nanti', 'blocks' => $this->text()['blocks']]])->assertStatus(500);
        $this->assertNull(SiteSection::find('history'));
        $this->assertSame($this->text(), SiteSection::find('profile')->data);
    }

    public function test_updated_by_null_on_delete_and_key_unique(): void
    {
        $user = User::factory()->create();
        SiteSection::create(['key' => 'profile', 'data' => $this->text(), 'updated_by' => $user->id]);
        $user->delete();
        $this->assertNull(SiteSection::find('profile')->updated_by);
        $this->expectException(\Illuminate\Database\QueryException::class);
        SiteSection::create(['key' => 'profile', 'data' => $this->text()]);
    }

    public function test_public_throttle_and_put_cors_preflight(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.141']);
        for ($i = 0; $i < 60; $i++) $this->getJson('/api/v1/site/profile')->assertNotFound();
        $this->getJson('/api/v1/site/profile')->assertStatus(429);
        $this->options('/api/v1/staff/site/profile', [], ['Origin' => 'http://localhost:3000', 'Access-Control-Request-Method' => 'PUT', 'Access-Control-Request-Headers' => 'authorization,content-type'])
            ->assertNoContent()->assertHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    }
}
