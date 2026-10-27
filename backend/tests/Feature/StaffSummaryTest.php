<?php

namespace Tests\Feature;

use App\Domain\ApplicationStatus;
use App\Domain\LetterType;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** All applicant identities in this suite are fictitious. */
class StaffSummaryTest extends TestCase
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
            'jenis_kelamin' => 'Perempuan', 'alamat' => 'Alamat Fiktif',
            'rt' => '001', 'rw' => '002', 'telepon' => '08000000000',
            'keperluan' => 'Keperluan Fiktif', 'status' => 'SUBMITTED',
            'catatan' => 'Catatan privat fiktif',
        ], $attributes));
    }

    private function act(string $role = 'staff', array $abilities = ['applications:manage'], bool $active = true): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002', 'is_active' => $active]);
        Sanctum::actingAs($user, $abilities);
        return $user;
    }

    private function assertPrivate($response): void
    {
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public static function roles(): array
    {
        return [['staff', 12, 72], ['village_head', 12, 12], ['admin', 12, 72], ['rt_head', 3, 3], ['rw_head', 6, 6]];
    }

    #[DataProvider('roles')]
    public function test_summary_and_filters_obey_each_roles_workflow_type_and_territory(string $role, int $perStatus, int $queueCount): void
    {
        $this->travelTo(now()->startOfSecond());
        foreach (ApplicationStatus::values() as $status) {
            foreach (LetterType::cases() as $type) {
                foreach ([['001', '002'], ['003', '002'], ['001', '004']] as [$rt, $rw]) {
                    $this->application(['status' => $status, 'jenis_surat' => $type->value, 'rt' => $rt, 'rw' => $rw]);
                }
            }
        }
        $user = $this->act($role);
        $summary = $this->getJson('/api/v1/staff/summary')->assertOk()
            ->assertJsonPath('by_status', array_fill_keys(ApplicationStatus::values(), $perStatus))
            ->assertJsonPath('my_queue', $queueCount)->assertJsonPath('today', $perStatus * count(ApplicationStatus::cases()));
        $this->assertPrivate($summary);
        foreach (['my_queue', 'today'] as $filter) {
            $this->getJson('/api/v1/staff/applications?'.$filter.'=1')->assertOk()->assertJsonPath('total', $summary->json($filter));
            $this->getJson('/api/v1/staff/applications?'.$filter.'=0')->assertOk()->assertJsonPath('total', $summary->json('today'));
        }
        foreach ($summary->json('by_status') as $status => $count) {
            $this->getJson('/api/v1/staff/applications?status='.$status)->assertOk()->assertJsonPath('total', $count);
        }
        $oldest = $this->getJson('/api/v1/staff/applications?my_queue=1&sort=terlama')->assertOk()->json('data');
        $this->assertSame(array_slice($oldest, 0, 5), $summary->json('oldest'));
        foreach ($summary->json('oldest') as $row) {
            $this->assertNotEmpty(ApplicationStatus::allowedFor($row['status'], $user->role, LetterType::from($row['jenis_surat'])));
        }
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_empty_summary_has_every_status_as_integer_zero(): void
    {
        $this->act();
        $this->assertPrivate($this->getJson('/api/v1/staff/summary')->assertOk()->assertExactJson([
            'by_status' => array_fill_keys(ApplicationStatus::values(), 0), 'my_queue' => 0, 'today' => 0, 'oldest' => [],
        ]));
    }

    public function test_oldest_is_capped_stable_safe_and_uses_sql_aggregates(): void
    {
        $this->travelTo(now()->startOfSecond());
        $ids = [];
        for ($i = 0; $i < 7; $i++) $ids[] = $this->application()->request_id;
        array_unshift($ids, $this->application(['created_at' => now()->subDay()])->request_id);
        $this->application(['status' => 'COMPLETED', 'created_at' => now()->subDays(2)]);
        $this->application(['jenis_surat' => 'DOMISILI', 'created_at' => now()->subDays(3)]);
        // Corrupt ciphertext proves list/summary never decrypt private columns.
        DB::table('applications')->update(['nik' => 'invalid-ciphertext', 'no_kk' => 'invalid-ciphertext']);
        $this->act();
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $response = $this->getJson('/api/v1/staff/summary')->assertOk()->assertJsonCount(5, 'oldest')
                ->assertJsonPath('my_queue', 8)->assertJsonPath('today', 7)->assertJsonPath('by_status.SUBMITTED', 9);
            $queries = array_values(array_filter(array_column(DB::getQueryLog(), 'query'), fn ($sql) => str_contains($sql, 'from "applications"')));
        } finally {
            DB::disableQueryLog();
        }
        $this->assertCount(4, $queries);
        $this->assertStringContainsString('COUNT(*) as total', $queries[0]);
        $this->assertStringContainsString('group by "status"', $queries[0]);
        $this->assertStringContainsString('count(*) as "aggregate"', $queries[1]);
        $this->assertStringContainsString('count(*) as "aggregate"', $queries[2]);
        $this->assertStringContainsString('limit 5', $queries[3]);
        $this->assertStringContainsString('order by "created_at" asc, "id" asc', $queries[3]);
        foreach ($queries as $sql) {
            $this->assertDoesNotMatchRegularExpression('/"(?:nik|no_kk|telepon|alamat|catatan|lookup_secret_hash|tempat_lahir|tanggal_lahir)"/', $sql);
            $this->assertStringNotContainsString('select *', $sql);
        }
        $this->assertSame(array_slice($ids, 0, 5), array_column($response->json('oldest'), 'request_id'));
        foreach ($response->json('oldest') as $row) {
            $this->assertEqualsCanonicalizing(['request_id', 'nama', 'jenis_surat', 'status', 'created_at', 'allowed_transitions'], array_keys($row));
        }
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_today_uses_app_local_midnight_not_utc_and_excludes_next_day(): void
    {
        config(['app.timezone' => 'Asia/Jakarta']);
        $this->travelTo(Carbon::parse('2026-10-27 00:01:00', 'Asia/Jakarta'));
        foreach (['2026-10-26 23:59:59', '2026-10-27 00:00:00', '2026-10-27 23:59:59', '2026-10-28 00:00:00'] as $date) {
            $this->application(['created_at' => $date]);
        }
        $this->act();
        $this->getJson('/api/v1/staff/summary')->assertOk()->assertJsonPath('today', 2);
        $list = $this->getJson('/api/v1/staff/applications?today=1&sort=terlama')->assertOk()->assertJsonPath('total', 2);
        $this->assertSame(['2026-10-26T17:00:00.000000Z', '2026-10-27T16:59:59.000000Z'], array_column($list->json('data'), 'created_at'));
        $this->travelTo(Carbon::parse('2026-10-28 00:00:00', 'Asia/Jakarta'));
        $this->getJson('/api/v1/staff/summary')->assertOk()->assertJsonPath('today', 1);
    }

    public function test_new_list_filters_are_anded_with_each_other_and_existing_filters(): void
    {
        $this->travelTo(now()->startOfSecond());
        $match = $this->application(['nama' => 'Cocok Fiktif']);
        $this->application(['nama' => 'Cocok Fiktif', 'created_at' => now()->subDay()]);
        $this->application(['nama' => 'Cocok Fiktif', 'jenis_surat' => 'DOMISILI']);
        $this->application(['nama' => 'Cocok Fiktif', 'status' => 'COMPLETED']);
        $this->application(['nama' => 'Cocok Fiktif', 'status' => 'VERIFIED']);
        $this->application();
        $this->act();
        foreach (['status=SUBMITTED', 'statuses[]=SUBMITTED&statuses[]=COMPLETED'] as $status) {
            $this->getJson('/api/v1/staff/applications?my_queue=1&today=1&q=Cocok&jenis_surat=SKU&sort=terlama&'.$status)
                ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.request_id', $match->request_id);
        }
    }

    public static function invalidFilters(): array
    {
        $cases = [];
        foreach (['my_queue', 'today'] as $field) {
            foreach (['', 'true', 'false', 'yes', '2', '-1', '1.5', '[]'] as $value) {
                $cases[] = [$value === '[]' ? $field.'[]=1' : $field.'='.$value, $field];
            }
        }
        return $cases;
    }

    #[DataProvider('invalidFilters')]
    public function test_invalid_boolean_filters_are_rejected(string $query, string $field): void
    {
        $this->act();
        $this->assertPrivate($this->getJson('/api/v1/staff/applications?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field));
    }

    public function test_unauthenticated_summary_is_private(): void
    {
        $this->assertPrivate($this->getJson('/api/v1/staff/summary')->assertUnauthorized());
    }

    public static function deniedUsers(): array
    {
        return [['staff', ['other:ability'], true], ['staff', ['applications:manage'], false], ['resident', ['applications:manage'], true]];
    }

    #[DataProvider('deniedUsers')]
    public function test_denied_summary_is_private_and_does_not_query_applications(string $role, array $abilities, bool $active): void
    {
        $this->act($role, $abilities, $active);
        DB::enableQueryLog();
        DB::flushQueryLog();
        try {
            $response = $this->getJson('/api/v1/staff/summary')->assertForbidden();
            $queries = array_column(DB::getQueryLog(), 'query');
        } finally {
            DB::disableQueryLog();
        }
        $this->assertPrivate($response);
        $this->assertEmpty(array_filter($queries, fn ($sql) => str_contains($sql, 'from "applications"')));
    }
}
