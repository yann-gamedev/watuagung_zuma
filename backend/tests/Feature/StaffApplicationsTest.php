<?php

namespace Tests\Feature;

use App\Domain\ApplicationStatus;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Semua identitas dan catatan di tes ini fiktif. */
class StaffApplicationsTest extends TestCase
{
    use RefreshDatabase;

    private function application(array $attributes = []): Application
    {
        return Application::create(array_replace([
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'kode-fiktif'),
            'jenis_surat' => 'SKU', 'nama' => 'Pemohon Fiktif',
            'nik' => '0000000000000001', 'no_kk' => '0000000000000002',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-02',
            'jenis_kelamin' => 'Perempuan', 'alamat' => 'Alamat rumah fiktif',
            'rt' => '01', 'rw' => '02', 'telepon' => '08000000000',
            'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Perdagangan contoh',
            'alamat_usaha' => 'Alamat usaha fiktif', 'keperluan' => 'Keperluan fiktif',
            'status' => 'WAITING_APPROVAL', 'catatan' => 'Catatan privat fiktif',
        ], $attributes));
    }

    private function act(string $role = 'staff', array $abilities = ['applications:manage']): User
    {
        $user = User::factory()->create(['role' => $role, 'name' => 'Petugas Fiktif']);
        Sanctum::actingAs($user, $abilities);

        return $user;
    }

    private function url(Application $application): string
    {
        return '/api/v1/staff/applications/'.$application->request_id;
    }

    public static function panelRoles(): array
    {
        return [['staff'], ['village_head'], ['admin']];
    }

    #[DataProvider('panelRoles')]
    public function test_every_panel_role_can_read_explicit_detail_and_access_is_audited(string $role): void
    {
        $this->travelTo(now()->startOfSecond());
        $application = $this->application();
        $user = $this->act($role);
        // Identical timestamps intentionally exercise the stable event ID tiebreaker.
        DB::table('application_events')->insert([
            ['application_id' => $application->id, 'user_id' => null, 'from_status' => null, 'to_status' => 'SUBMITTED', 'note' => null, 'created_at' => now()],
            ['application_id' => $application->id, 'user_id' => $user->id, 'from_status' => 'PROCESSING', 'to_status' => 'WAITING_APPROVAL', 'note' => 'Riwayat fiktif', 'created_at' => now()],
        ]);
        $other = $this->application();
        DB::table('application_events')->insert(['application_id' => $other->id, 'to_status' => 'SUBMITTED', 'created_at' => now()]);

        $expected = [
            'request_id' => $application->request_id, 'jenis_surat' => 'SKU', 'nama' => 'Pemohon Fiktif',
            'nik' => '0000000000000001', 'no_kk' => '0000000000000002',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-02', 'jenis_kelamin' => 'Perempuan',
            'alamat' => 'Alamat rumah fiktif', 'rt' => '01', 'rw' => '02', 'telepon' => '08000000000',
            'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Perdagangan contoh', 'alamat_usaha' => 'Alamat usaha fiktif',
            'keperluan' => 'Keperluan fiktif', 'status' => 'WAITING_APPROVAL', 'catatan' => 'Catatan privat fiktif',
            'created_at' => $application->created_at->toISOString(), 'updated_at' => $application->updated_at->toISOString(),
            'allowed_transitions' => ApplicationStatus::allowedFor('WAITING_APPROVAL', $role),
            'history' => [
                ['from_status' => null, 'to_status' => 'SUBMITTED', 'note' => null, 'staff_name' => null, 'created_at' => now()->toISOString()],
                ['from_status' => 'PROCESSING', 'to_status' => 'WAITING_APPROVAL', 'note' => 'Riwayat fiktif', 'staff_name' => 'Petugas Fiktif', 'created_at' => now()->toISOString()],
            ],
        ];
        $response = $this->getJson($this->url($application))->assertOk()->assertExactJson($expected);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertDatabaseCount('audit_logs', 1);
        $audit = (array) DB::table('audit_logs')->first();
        $this->assertEqualsCanonicalizing(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'created_at'], array_keys($audit));
        $this->assertSame([
            'id' => $audit['id'], 'user_id' => $user->id, 'action' => 'application.viewed',
            'subject_type' => 'application', 'subject_id' => $application->id, 'created_at' => now()->format('Y-m-d H:i:s'),
        ], $audit);
        foreach (['nik', 'no_kk', 'telepon', 'alamat', 'alamat_usaha'] as $field) {
            $this->assertNotSame($expected[$field], DB::table('applications')->where('id', $application->id)->value($field));
            $this->assertArrayNotHasKey($field, $application->toArray());
        }
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertDatabaseCount('application_events', 3);
        $this->getJson($this->url($application))->assertOk();
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_non_business_fields_and_history_may_be_null_or_empty(): void
    {
        $application = $this->application(['jenis_surat' => 'DOMISILI', 'nama_usaha' => null, 'jenis_usaha' => null, 'alamat_usaha' => null, 'catatan' => null]);
        $this->act();
        $this->getJson($this->url($application))->assertOk()->assertJsonPath('nama_usaha', null)
            ->assertJsonPath('jenis_usaha', null)->assertJsonPath('alamat_usaha', null)
            ->assertJsonPath('catatan', null)->assertJsonPath('history', []);
    }

    public function test_unauthenticated_detail_does_not_disclose_or_audit(): void
    {
        $application = $this->application();
        foreach ([$application->request_id, 'malformed'] as $id) {
            $response = $this->getJson('/api/v1/staff/applications/'.$id)->assertUnauthorized()->assertJsonMissingPath('nik');
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        }
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_role_and_ability_are_checked_before_querying_private_data(): void
    {
        // Invalid ciphertext makes any premature decryption fail, not merely hide the output.
        $application = $this->application();
        DB::table('applications')->where('id', $application->id)->update(['nik' => 'invalid-ciphertext']);
        $queries = [];
        DB::listen(function ($query) use (&$queries) { $queries[] = $query->sql; });
        foreach ([['resident', ['applications:manage']], ['staff', ['other:ability']]] as [$role, $abilities]) {
            $this->act($role, $abilities);
            foreach ([$application->request_id, 'malformed', 'REQ-2026-'.Str::ulid()] as $id) {
                $response = $this->getJson('/api/v1/staff/applications/'.$id)->assertForbidden()->assertJsonMissingPath('nik');
                $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            }
        }
        $this->assertEmpty(array_filter($queries, fn ($sql) => str_contains($sql, 'from "applications"')));
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_current_role_is_rechecked_after_token_issue(): void
    {
        $application = $this->application();
        $user = User::factory()->create(['role' => 'staff']);
        $token = $user->createToken('test', ['applications:manage'])->plainTextToken;
        $user->update(['role' => 'resident']);
        $this->withToken($token)->getJson($this->url($application))->assertForbidden();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_malformed_and_missing_request_ids_are_distinct_and_not_audited(): void
    {
        $this->act();
        foreach (['invalid', 'REQ-2026-', 'REQ-2026-ABC_123', 'REQ-2026-'.str_repeat('0', 65), 'req-2026-'.Str::ulid()] as $id) {
            $response = $this->getJson('/api/v1/staff/applications/'.$id)->assertUnprocessable()->assertJsonValidationErrors('request_id');
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        }
        $response = $this->getJson('/api/v1/staff/applications/REQ-2026-'.Str::ulid())->assertNotFound();
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_audit_failure_never_returns_private_detail(): void
    {
        $application = $this->application();
        $this->act();
        config(['app.debug' => false]);
        Schema::drop('audit_logs');
        $this->getJson($this->url($application))->assertStatus(500)->assertJsonMissingPath('nik')->assertJsonMissingPath('nama');
    }

    public function test_search_matches_partial_number_or_name_and_combines_with_filters(): void
    {
        $match = $this->application(['nama' => 'Warga Pencarian Fiktif', 'jenis_surat' => 'DOMISILI', 'status' => 'APPROVED']);
        $this->application(['nama' => 'Warga Pencarian Fiktif', 'jenis_surat' => 'SKU', 'status' => 'APPROVED']);
        $this->application(['nama' => 'Warga Pencarian Fiktif', 'jenis_surat' => 'DOMISILI', 'status' => 'SUBMITTED']);
        $this->application(['nama' => 'Warga Lain', 'jenis_surat' => 'DOMISILI', 'status' => 'APPROVED']);
        $this->act();
        $this->getJson('/api/v1/staff/applications?q=Pencarian&jenis_surat=DOMISILI&status=APPROVED')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.request_id', $match->request_id);
        $this->getJson('/api/v1/staff/applications?q=Pencarian&jenis_surat=DOMISILI&statuses[]=APPROVED&statuses[]=READY_FOR_PICKUP')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.request_id', $match->request_id);
        $this->getJson('/api/v1/staff/applications?q='.substr($match->request_id, -16))->assertOk()
            ->assertJsonPath('total', 1)->assertJsonPath('data.0.request_id', $match->request_id);
        $this->getJson('/api/v1/staff/applications?q=tidak-ada')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/v1/staff/applications?q=%20%20')->assertOk()->assertJsonPath('total', 4);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_short_fixture_request_ids_and_every_letter_type_are_supported(): void
    {
        $this->act();
        foreach (['SKU', 'DOMISILI', 'SKTM', 'KTP_KK'] as $index => $type) {
            $application = $this->application(['request_id' => 'REQ-2026-00000'.$index, 'jenis_surat' => $type]);
            $this->getJson($this->url($application))->assertOk()->assertJsonPath('request_id', $application->request_id);
        }
        foreach (['SKU', 'DOMISILI', 'SKTM', 'KTP_KK'] as $type) {
            $this->getJson('/api/v1/staff/applications?jenis_surat='.$type)->assertOk()
                ->assertJsonPath('total', 1)->assertJsonPath('data.0.jenis_surat', $type);
        }
        $this->getJson('/api/v1/staff/applications?q='.str_repeat('a', 100))->assertOk()->assertJsonPath('total', 0);
        $this->assertDatabaseCount('audit_logs', 4);
    }

    public function test_search_treats_wildcards_and_sql_as_literal_text(): void
    {
        $match = $this->application(['nama' => 'Usaha 100%_! Fiktif']);
        $this->application();
        $this->act();
        $this->getJson('/api/v1/staff/applications?q='.rawurlencode('%_!'))->assertOk()
            ->assertJsonPath('total', 1)->assertJsonPath('data.0.request_id', $match->request_id);
        $this->getJson('/api/v1/staff/applications?q='.rawurlencode("' OR 1=1 --"))->assertOk()->assertJsonPath('total', 0);
    }

    public function test_sort_is_stable_and_filtered_results_paginate_without_sensitive_fields(): void
    {
        $this->travelTo(now()->startOfSecond());
        $ids = [];
        for ($i = 0; $i < 22; $i++) $ids[] = $this->application(['nama' => 'Cocok Fiktif'])->request_id;
        // Created later but timestamp older: created_at takes precedence over ID.
        array_unshift($ids, $this->application(['nama' => 'Cocok Fiktif', 'created_at' => now()->subDay()])->request_id);
        $this->application(['nama' => 'Tidak masuk']);
        $this->act();
        foreach (['terlama' => $ids, 'terbaru' => array_reverse($ids)] as $sort => $expected) {
            $base = '/api/v1/staff/applications?q=Cocok&jenis_surat=SKU&statuses[]=WAITING_APPROVAL&sort='.$sort;
            $first = $this->getJson($base)->assertOk()->assertJsonPath('total', 23)->assertJsonPath('last_page', 2)->assertJsonCount(20, 'data');
            $second = $this->getJson($base.'&page=2')->assertOk()->assertJsonPath('current_page', 2)->assertJsonCount(3, 'data');
            $rows = array_merge($first->json('data'), $second->json('data'));
            $this->assertSame($expected, array_column($rows, 'request_id'));
            foreach ($rows as $row) {
                $this->assertEqualsCanonicalizing(['request_id', 'nama', 'jenis_surat', 'status', 'created_at', 'allowed_transitions'], array_keys($row));
            }
            $this->assertStringContainsString('no-store', $first->headers->get('Cache-Control'));
        }
        $this->getJson('/api/v1/staff/applications?q=Cocok')->assertOk()->assertJsonPath('data.0.request_id', end($ids));
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public static function invalidFilters(): array
    {
        return [
            ['q[]=abc', 'q'], ['q='.str_repeat('a', 101), 'q'],
            ['jenis_surat=UNKNOWN', 'jenis_surat'], ['jenis_surat[]=SKU', 'jenis_surat'],
            ['sort=newest', 'sort'], ['sort[]=terbaru', 'sort'],
            ['page=1.5', 'page'], ['page=-1', 'page'],
        ];
    }

    #[DataProvider('invalidFilters')]
    public function test_invalid_list_filters_return_422_without_audit(string $query, string $field): void
    {
        $this->act();
        $response = $this->getJson('/api/v1/staff/applications?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertDatabaseCount('audit_logs', 0);
    }
}
