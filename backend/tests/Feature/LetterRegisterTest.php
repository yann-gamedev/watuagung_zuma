<?php

namespace Tests\Feature;

use App\Domain\ApplicationStatus;
use App\Domain\LetterType;
use App\Models\Application;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** All identities and reasons here are fictional. */
class LetterRegisterTest extends TestCase
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
            'jenis_kelamin' => 'Perempuan', 'alamat' => 'Alamat fiktif',
            'rt' => '001', 'rw' => '002', 'telepon' => '08000000000',
            'keperluan' => 'Keperluan fiktif', 'status' => 'PROCESSING',
        ], $attributes));
    }

    private function act(string $role = 'staff', array $abilities = ['applications:manage'], bool $active = true): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002', 'is_active' => $active]);
        Sanctum::actingAs($user, $abilities);

        return $user;
    }

    private function change(Application $application, string $status, ?string $note = null)
    {
        return $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => $status, 'catatan' => $note]);
    }

    private function lookup(Application $application)
    {
        return $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => 'kode-fiktif']);
    }

    public function test_sequence_is_global_across_types_and_resets_by_issue_year(): void
    {
        $this->travelTo(now()->setDate(2026, 12, 31)->startOfSecond());
        $user = $this->act();
        foreach (LetterType::cases() as $index => $type) {
            $application = $this->application(['jenis_surat' => $type->value]);
            $this->change($application, 'WAITING_APPROVAL')->assertOk();
            $this->assertDatabaseHas('letter_numbers', [
                'application_id' => $application->id, 'year' => 2026, 'sequence' => $index + 1,
                'number' => '[PLACEHOLDER]/'.($index + 1).'/[PLACEHOLDER]/XII/2026',
                'status' => 'issued', 'void_reason' => null, 'issued_by' => $user->id,
                'issued_at' => now()->format('Y-m-d H:i:s'),
            ]);
        }
        $this->travelTo(now()->setDate(2027, 1, 1));
        $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();
        $this->assertDatabaseHas('letter_numbers', ['year' => 2027, 'sequence' => 1, 'number' => '[PLACEHOLDER]/1/[PLACEHOLDER]/I/2027']);
        $this->assertDatabaseHas('letter_number_counters', ['year' => 2026, 'sequence' => 4]);
        $this->assertDatabaseHas('letter_number_counters', ['year' => 2027, 'sequence' => 1]);
    }

    public function test_number_at_2359_wib_on_december_31_uses_the_current_year(): void
    {
        $this->travelTo(Carbon::parse('2026-12-31 23:59:00', 'Asia/Jakarta'));
        $this->act();
        $application = $this->application();

        $this->change($application, 'WAITING_APPROVAL')->assertOk();

        $this->assertDatabaseHas('letter_numbers', [
            'application_id' => $application->id, 'year' => 2026, 'sequence' => 1,
            'number' => '[PLACEHOLDER]/1/[PLACEHOLDER]/XII/2026',
            'issued_at' => '2026-12-31 23:59:00',
        ]);
        $this->getJson('/api/v1/staff/letter-register')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.issued_at', '2026-12-31T16:59:00.000000Z');
    }

    public function test_number_at_0001_wib_on_january_1_restarts_at_one_for_the_new_year(): void
    {
        $this->travelTo(Carbon::parse('2026-12-31 23:59:00', 'Asia/Jakarta'));
        $this->act();
        $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();
        $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();

        $this->travelTo(Carbon::parse('2027-01-01 00:01:00', 'Asia/Jakarta'));
        $application = $this->application();
        $this->change($application, 'WAITING_APPROVAL')->assertOk();

        $this->assertDatabaseHas('letter_numbers', [
            'application_id' => $application->id, 'year' => 2027, 'sequence' => 1,
            'number' => '[PLACEHOLDER]/1/[PLACEHOLDER]/I/2027',
            'issued_at' => '2027-01-01 00:01:00',
        ]);
        $this->assertDatabaseHas('letter_number_counters', ['year' => 2026, 'sequence' => 2]);
        $this->assertDatabaseHas('letter_number_counters', ['year' => 2027, 'sequence' => 1]);
        $this->getJson('/api/v1/staff/letter-register')->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.number', '[PLACEHOLDER]/1/[PLACEHOLDER]/I/2027')
            ->assertJsonPath('data.0.issued_at', '2026-12-31T17:01:00.000000Z');
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()
            ->assertJsonPath('letter_numbers.0.issued_at', '2026-12-31T17:01:00.000000Z')
            ->assertJsonPath('history.0.created_at', '2026-12-31T17:01:00.000000Z');
    }

    public function test_configuration_and_roman_months_are_used(): void
    {
        config(['letters.kode_desa' => 'DESA-CONTOH', 'letters.kode_klasifikasi.SKU' => 'KLASIFIKASI-CONTOH']);
        $this->act('admin');
        foreach (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as $index => $month) {
            $this->travelTo(now()->setDate(2026, $index + 1, 1));
            $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();
            $this->assertDatabaseHas('letter_numbers', ['number' => 'KLASIFIKASI-CONTOH/'.($index + 1).'/DESA-CONTOH/'.$month.'/2026']);
        }
    }

    public static function voidStatuses(): array
    {
        return [['REJECTED'], ['NEED_REVISION']];
    }

    #[DataProvider('voidStatuses')]
    public function test_head_decision_voids_number_with_reason_and_never_reuses_it(string $status): void
    {
        $this->travelTo(now()->setDate(2026, 10, 21)->startOfSecond());
        $application = $this->application(['jenis_surat' => 'DOMISILI']);
        $this->act();
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $first = DB::table('letter_numbers')->first();
        $this->change($application, 'WAITING_APPROVAL')->assertUnprocessable();
        $this->act('village_head');
        $this->change($application, $status)->assertUnprocessable();
        $this->assertDatabaseHas('letter_numbers', ['id' => $first->id, 'status' => 'issued']);
        $this->change($application, $status, '  Alasan fiktif privat  ')->assertOk();
        $this->assertDatabaseHas('letter_numbers', ['id' => $first->id, 'status' => 'void', 'void_reason' => 'Alasan fiktif privat']);
        $this->lookup($application)->assertOk()->assertJsonPath('letter_number', null)->assertJsonMissingPath('letter_numbers');

        $this->act();
        $next = $status === 'NEED_REVISION' ? $application : $this->application();
        if ($status === 'NEED_REVISION') {
            $this->change($next, 'VERIFIED')->assertOk();
            $this->change($next, 'PROCESSING')->assertOk();
        }
        $this->change($next, 'WAITING_APPROVAL')->assertOk();
        $this->assertDatabaseHas('letter_numbers', ['application_id' => $next->id, 'year' => 2026, 'sequence' => 2, 'status' => 'issued']);
        $this->assertDatabaseCount('letter_numbers', 2);
        foreach (['staff', 'admin', 'village_head'] as $role) {
            $this->act($role);
            $history = $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->json('letter_numbers');
            $this->assertCount($status === 'NEED_REVISION' ? 2 : 1, $history);
            $this->assertSame([
                'number' => $first->number, 'status' => 'void', 'void_reason' => 'Alasan fiktif privat', 'issued_at' => now()->toISOString(),
            ], $history[0]);
        }
        foreach (['rt_head', 'rw_head'] as $role) {
            $this->act($role);
            $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->assertJsonMissingPath('letter_numbers');
        }
    }

    public function test_public_lookup_exposes_only_issued_number_after_approval_and_never_backfills_legacy(): void
    {
        $application = $this->application();
        $this->act();
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $number = DB::table('letter_numbers')->value('number');
        // The status matrix tests visibility, not the separately tested public rate limit.
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        foreach (ApplicationStatus::values() as $status) {
            $application->update(['status' => $status]);
            $this->lookup($application)->assertOk()->assertExactJson([
                'success' => true, 'request_id' => $application->request_id, 'jenis_surat' => 'SKU',
                'status' => $status, 'catatan' => null,
                'letter_number' => in_array($status, ['APPROVED', 'READY_FOR_PICKUP', 'COMPLETED']) ? $number : null,
            ]);
        }
        DB::table('letter_numbers')->update(['status' => 'void', 'void_reason' => 'Alasan fiktif']);
        $application->update(['status' => 'APPROVED']);
        $this->lookup($application)->assertOk()->assertJsonPath('letter_number', null);
        $legacy = $this->application(['status' => 'WAITING_APPROVAL']);
        $this->act('village_head');
        $this->change($legacy, 'APPROVED')->assertOk();
        $this->lookup($legacy)->assertOk()->assertJsonPath('letter_number', null);
        $this->getJson('/api/v1/staff/applications/'.$legacy->request_id)->assertOk()->assertJsonPath('letter_numbers', []);
        $this->assertDatabaseCount('letter_numbers', 1);
    }

    public function test_register_authentication_roles_active_flag_and_ability(): void
    {
        $url = '/api/v1/staff/letter-register';
        $this->getJson($url)->assertUnauthorized();
        foreach (['rt_head', 'rw_head', 'resident'] as $role) {
            $this->act($role);
            $this->getJson($url.'?year=invalid')->assertForbidden()->assertJsonMissingPath('data');
        }
        foreach (['staff', 'admin', 'village_head'] as $role) {
            $this->act($role, ['other:ability']);
            $this->getJson($url)->assertForbidden();
            $this->act($role, ['applications:manage'], false);
            $this->getJson($url)->assertForbidden();
            $this->act($role);
            $response = $this->getJson($url)->assertOk()->assertJsonPath('total', 0);
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        }
    }

    public static function invalidFilters(): array
    {
        return [
            ['year=abc', 'year'], ['year=0', 'year'], ['year=999', 'year'], ['year=10000', 'year'], ['year=2026.5', 'year'], ['year[]=2026', 'year'], ['year=', 'year'],
            ['jenis_surat=OTHER', 'jenis_surat'], ['jenis_surat[]=SKU', 'jenis_surat'], ['jenis_surat=', 'jenis_surat'],
            ['page=0', 'page'], ['page=-1', 'page'], ['page=1.5', 'page'], ['page[]=1', 'page'], ['page=abc', 'page'],
        ];
    }

    #[DataProvider('invalidFilters')]
    public function test_register_validates_filters(string $query, string $field): void
    {
        $this->act();
        $this->getJson('/api/v1/staff/letter-register?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field);
    }

    public function test_register_filters_year_and_type_paginates_and_only_returns_safe_fields(): void
    {
        $this->act();
        $this->travelTo(now()->setDate(2025, 12, 1));
        $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();
        $this->travelTo(now()->setDate(2026, 1, 1)->startOfSecond());
        for ($i = 0; $i < 22; $i++) {
            $application = $this->application(['jenis_surat' => $i === 21 ? 'SKTM' : 'SKU']);
            $this->change($application, 'WAITING_APPROVAL')->assertOk();
        }
        $this->act('village_head');
        $this->change($application, 'REJECTED', 'Alasan privat fiktif')->assertOk();
        $first = $this->getJson('/api/v1/staff/letter-register')->assertOk()->assertJsonPath('total', 22)
            ->assertJsonPath('per_page', 20)->assertJsonPath('last_page', 2)->assertJsonCount(20, 'data')
            ->assertJsonPath('data.0.status', 'void')->assertJsonPath('data.0.number', '[PLACEHOLDER]/22/[PLACEHOLDER]/I/2026');
        foreach ($first->json('data') as $row) {
            $this->assertEqualsCanonicalizing(['number', 'issued_at', 'jenis_surat', 'nama', 'status'], array_keys($row));
            $this->assertSame(now()->toISOString(), $row['issued_at']);
        }
        $this->getJson('/api/v1/staff/letter-register?page=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('current_page', 2);
        $this->getJson('/api/v1/staff/letter-register?year=2025')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/v1/staff/letter-register?year=2025&jenis_surat=SKTM')->assertOk()->assertJsonPath('total', 0);
        $this->getJson('/api/v1/staff/letter-register?jenis_surat=SKTM')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.status', 'void');
        $this->getJson('/api/v1/staff/letter-register?year=2024')->assertOk()->assertJsonPath('data', []);
    }

    public function test_invalid_or_unauthorized_transitions_do_not_allocate_numbers(): void
    {
        $application = $this->application();
        $this->change($application, 'WAITING_APPROVAL')->assertUnauthorized();
        foreach (['village_head', 'rt_head', 'rw_head', 'resident'] as $role) {
            $this->act($role);
            $this->change($application, 'WAITING_APPROVAL')->assertForbidden();
        }
        $this->act('staff', ['other:ability']);
        $this->change($application, 'WAITING_APPROVAL')->assertForbidden();
        $this->act();
        $this->change($application, 'APPROVED')->assertUnprocessable();
        $this->assertDatabaseCount('letter_numbers', 0);
        $this->assertDatabaseCount('letter_number_counters', 0);
        $this->assertDatabaseCount('application_events', 0);
        $this->assertSame('PROCESSING', $application->fresh()->status);
    }

    public function test_event_failure_rolls_back_number_counter_and_application(): void
    {
        $application = $this->application();
        $this->act();
        config(['app.debug' => false]);
        DB::unprepared("CREATE TRIGGER fail_letter_event BEFORE INSERT ON application_events BEGIN SELECT RAISE(ABORT, 'Test failure'); END");
        $this->change($application, 'WAITING_APPROVAL')->assertStatus(500);
        $this->assertSame('PROCESSING', $application->fresh()->status);
        $this->assertDatabaseCount('letter_numbers', 0);
        $this->assertDatabaseCount('letter_number_counters', 0);
        $this->assertDatabaseCount('application_events', 0);
        DB::unprepared('DROP TRIGGER fail_letter_event');
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $this->assertDatabaseHas('letter_numbers', ['sequence' => 1]);

        $this->act('village_head');
        DB::unprepared("CREATE TRIGGER fail_letter_event BEFORE INSERT ON application_events BEGIN SELECT RAISE(ABORT, 'Test failure'); END");
        $this->change($application, 'REJECTED', 'Alasan fiktif')->assertStatus(500);
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertDatabaseHas('letter_numbers', ['status' => 'issued', 'void_reason' => null]);
        $this->assertDatabaseCount('application_events', 1);
    }

    public function test_number_collision_rolls_back_transition_and_counter(): void
    {
        $this->act();
        config(['letters.format' => 'NOMOR-CONTOH-TETAP']);
        $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();
        $application = $this->application();
        config(['app.debug' => false]);
        $this->change($application, 'WAITING_APPROVAL')->assertStatus(500);
        $this->assertSame('PROCESSING', $application->fresh()->status);
        $this->assertDatabaseCount('letter_numbers', 1);
        $this->assertDatabaseCount('application_events', 1);
        $this->assertDatabaseHas('letter_number_counters', ['sequence' => 1]);
    }

    public static function constraintViolations(): array
    {
        return [['number'], ['year_sequence'], ['application_delete'], ['issuer_delete'], ['status']];
    }

    #[DataProvider('constraintViolations')]
    public function test_database_constraints_protect_unique_numbers_and_persistent_history(string $constraint): void
    {
        $application = $this->application();
        $user = $this->act();
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $letter = (array) DB::table('letter_numbers')->first();
        unset($letter['id']);
        $this->expectException(QueryException::class);
        match ($constraint) {
            'number' => DB::table('letter_numbers')->insert(array_replace($letter, ['sequence' => 2])),
            'year_sequence' => DB::table('letter_numbers')->insert(array_replace($letter, ['number' => 'AUTRE-CONTOH'])),
            'application_delete' => $application->delete(),
            'issuer_delete' => $user->delete(),
            'status' => DB::table('letter_numbers')->update(['status' => 'invalid']),
        };
    }

    public function test_sqlite_acquires_write_lock_before_transaction_reads_even_with_existing_counter(): void
    {
        $this->act();
        $this->change($this->application(), 'WAITING_APPROVAL')->assertOk();
        $application = $this->application();
        $queries = [];
        DB::listen(function ($query) use (&$queries) { $queries[] = $query->sql; });
        $this->change($application, 'WAITING_APPROVAL')->assertOk();
        $lock = array_search('update "letter_number_counters" set "year" = ? where "year" = ?', $queries);
        $this->assertNotFalse($lock);
        $freshRead = array_search('select * from "applications" where "applications"."id" = ? limit 1', $queries);
        $this->assertNotFalse($freshRead);
        $this->assertLessThan($freshRead, $lock);
        $this->assertDatabaseHas('letter_numbers', ['sequence' => 2]);
    }
}
