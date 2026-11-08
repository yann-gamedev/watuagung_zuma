<?php

namespace Tests\Feature;

use App\Domain\LetterType;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\LetterPayloads;
use Tests\TestCase;

/** Enam jenis surat final (docs/PROMPTS-SURAT.md). Seluruh data warga fiktif. */
class LetterTypesTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
    }

    private function submit(array $payload)
    {
        return $this->postJson('/api/v1/applications', $payload);
    }

    private function act(string $role, ?string $rt = null, ?string $rw = null): User
    {
        $user = User::factory()->create(['role' => $role, 'rt' => $rt, 'rw' => $rw]);
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, ['applications:manage']);

        return $user;
    }

    private function umum(string $status = 'SUBMITTED'): Application
    {
        $id = $this->submit(self::letterPayload('UMUM'))->assertCreated()->json('request_id');
        $application = Application::where('request_id', $id)->firstOrFail();
        $application->update(['status' => $status]);

        return $application;
    }

    private function edit(Application $application, string $text = 'Orang tersebut bekerja di kota fiktif lain.')
    {
        return $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/isi-keterangan', ['isi_keterangan' => $text]);
    }

    #[DataProvider('offeredLetterTypes')]
    public function test_each_offered_type_is_accepted_and_stored(string $type): void
    {
        $payload = self::letterPayload($type);
        $this->submit($payload)->assertCreated()->assertJsonPath('jenis_surat', $type);
        $application = Application::firstOrFail();
        foreach (array_diff_key($payload, array_flip(['rt', 'rw'])) as $field => $value) {
            $this->assertSame($value, $application->{$field}, $field);
        }
        $this->assertSame($type === 'UMUM' ? $payload['isi_keterangan'] : null, $application->isi_keterangan_awal);
    }

    public function test_titles_and_offered_types_live_in_letter_type(): void
    {
        $this->assertSame(['DOMISILI', 'SKTM', 'BELUM_MENIKAH', 'KERAMAIAN', 'KEHILANGAN', 'UMUM'], LetterType::offeredValues());
        $this->assertSame([
            'SKU' => 'SURAT KETERANGAN USAHA', 'DOMISILI' => 'SURAT KETERANGAN DOMISILI',
            'SKTM' => 'SURAT KETERANGAN TIDAK MAMPU', 'KTP_KK' => 'SURAT PENGANTAR KTP/KK',
            'BELUM_MENIKAH' => 'SURAT KETERANGAN BELUM MENIKAH', 'KERAMAIAN' => 'SURAT KETERANGAN IZIN KERAMAIAN',
            'KEHILANGAN' => 'SURAT KETERANGAN KEHILANGAN', 'UMUM' => 'SURAT KETERANGAN',
        ], array_combine(array_column(LetterType::cases(), 'value'), array_map(fn (LetterType $type) => $type->title(), LetterType::cases())));
    }

    public function test_retired_types_are_rejected_for_new_submissions(): void
    {
        foreach (['SKU', 'KTP_KK'] as $type) {
            $this->submit(self::letterPayload($type))->assertUnprocessable()
                ->assertJsonValidationErrors(['jenis_surat' => 'Jenis surat ini tidak dapat diajukan secara online.']);
        }
        $this->submit(self::letterPayload('SKU', ['nama_usaha' => 'Usaha fiktif', 'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Pasar fiktif']))
            ->assertUnprocessable()->assertJsonValidationErrors(['jenis_surat', 'nama_usaha']);
        $this->submit(self::letterPayload('LAINNYA'))->assertUnprocessable()->assertJsonValidationErrors('jenis_surat');
        $this->assertDatabaseCount('applications', 0);
    }

    public static function requiredFields(): array
    {
        $personal = ['nama', 'nik', 'no_kk', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'dusun', 'alamat', 'rt', 'rw', 'telepon', 'keperluan'];
        $full = [...$personal, 'agama', 'status_perkawinan', 'pendidikan', 'pekerjaan'];

        return [
            'DOMISILI' => ['DOMISILI', $full],
            'SKTM' => ['SKTM', $full],
            'BELUM_MENIKAH' => ['BELUM_MENIKAH', $full],
            'KEHILANGAN' => ['KEHILANGAN', [...$full, 'barang_hilang']],
            'UMUM' => ['UMUM', [...$full, 'isi_keterangan']],
            'KERAMAIAN' => ['KERAMAIAN', [...$personal, 'acara', 'tempat_acara', 'tanggal_mulai', 'tanggal_selesai', 'jenis_hiburan']],
        ];
    }

    #[DataProvider('requiredFields')]
    public function test_required_fields_per_type(string $type, array $fields): void
    {
        $response = $this->submit(['jenis_surat' => $type])->assertUnprocessable();
        $this->assertEqualsCanonicalizing($fields, array_keys($response->json('errors')));
        $this->assertSame('Dusun wajib diisi.', $response->json('errors.dusun.0'));
        foreach ($fields as $field) {
            $payload = self::letterPayload($type);
            unset($payload[$field]);
            $this->submit($payload)->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('applications', 0);
    }

    public function test_keramaian_does_not_require_but_still_validates_personal_choices(): void
    {
        $this->submit(self::letterPayload('KERAMAIAN', ['agama' => 'Agama fiktif']))->assertUnprocessable()->assertJsonValidationErrors('agama');
        $this->submit(self::letterPayload('KERAMAIAN', ['pekerjaan' => 'Wiraswasta']))->assertCreated();
        $this->assertNull(Application::firstOrFail()->agama);
    }

    public function test_choices_are_enums_and_citizenship_defaults_to_wni(): void
    {
        foreach ([
            'dusun' => 'Dusun Lain', 'agama' => 'islam', 'status_perkawinan' => 'Menikah', 'pendidikan' => 'SMA',
            'kewarganegaraan' => 'Indonesia', 'jenis_kelamin' => 'L',
        ] as $field => $value) {
            $this->submit(self::letterPayload('DOMISILI', [$field => $value]))->assertUnprocessable()
                ->assertJsonValidationErrors([$field => 'tidak valid. Pilih salah satu pilihan yang tersedia.']);
        }
        $this->submit(self::letterPayload('DOMISILI', ['pekerjaan' => str_repeat('a', 61)]))->assertUnprocessable()
            ->assertJsonValidationErrors(['pekerjaan' => 'Pekerjaan maksimal 60 karakter.']);
        $payload = self::letterPayload('DOMISILI', ['kewarganegaraan' => 'WNA']);
        $this->submit($payload)->assertCreated();
        unset($payload['kewarganegaraan']);
        $this->submit($payload)->assertCreated();
        $this->assertSame(['WNA', 'WNI'], Application::orderBy('id')->pluck('kewarganegaraan')->all());
    }

    public function test_fields_belonging_to_another_type_are_rejected(): void
    {
        foreach ([
            ['DOMISILI', 'barang_hilang', 'Dompet'], ['KEHILANGAN', 'isi_keterangan', 'Isi lain'],
            ['UMUM', 'acara', 'Hajatan'], ['SKTM', 'nama_usaha', 'Usaha fiktif'], ['KERAMAIAN', 'barang_hilang', 'KTP'],
        ] as [$type, $field, $value]) {
            $this->submit(self::letterPayload($type, [$field => $value]))->assertUnprocessable()
                ->assertJsonValidationErrors([$field => 'tidak dipakai untuk jenis surat ini.']);
        }
        // Isian kosong dari formulir lama tidak dianggap terisi.
        $this->submit(self::letterPayload('DOMISILI', ['barang_hilang' => '', 'nama_usaha' => null]))->assertCreated();
        $this->assertDatabaseCount('applications', 1);
    }

    public function test_keramaian_dates(): void
    {
        $this->travelTo(now()->setTimezone('Asia/Jakarta')->setDate(2026, 11, 8)->setTime(23, 30));
        $dates = fn (string $start, string $end) => self::letterPayload('KERAMAIAN', ['tanggal_mulai' => $start, 'tanggal_selesai' => $end]);
        $this->submit($dates('2026-11-07', '2026-11-08'))->assertUnprocessable()
            ->assertJsonValidationErrors(['tanggal_mulai' => 'Tanggal mulai tidak boleh sebelum hari ini.']);
        $this->submit($dates('2026-11-10', '2026-11-09'))->assertUnprocessable()
            ->assertJsonValidationErrors(['tanggal_selesai' => 'Tanggal selesai tidak boleh sebelum tanggal mulai.']);
        $this->submit($dates('2026-11-10', '2026-11-17'))->assertUnprocessable()
            ->assertJsonValidationErrors(['tanggal_selesai' => 'Izin keramaian paling lama 7 hari.']);
        foreach (['2026-02-30', '10-11-2026', '2026-11-10T00:00'] as $invalid) {
            $this->submit($dates($invalid, '2026-11-12'))->assertUnprocessable()->assertJsonValidationErrors('tanggal_mulai');
        }
        $this->submit($dates('2026-11-08', '2026-11-08'))->assertCreated();
        $this->submit($dates('2026-11-10', '2026-11-16'))->assertCreated();
        $this->assertSame([['2026-11-08', '2026-11-08'], ['2026-11-10', '2026-11-16']],
            Application::orderBy('id')->get()->map(fn ($row) => [substr($row->tanggal_mulai, 0, 10), substr($row->tanggal_selesai, 0, 10)])->all());
    }

    public function test_religion_and_marital_status_are_encrypted_hidden_and_never_listed(): void
    {
        $receipt = $this->submit(self::letterPayload('BELUM_MENIKAH', ['agama' => 'Konghucu', 'status_perkawinan' => 'Cerai Mati']))
            ->assertCreated()->json();
        $application = Application::firstOrFail();
        $raw = DB::table('applications')->where('id', $application->id)->first();
        foreach (['agama' => 'Konghucu', 'status_perkawinan' => 'Cerai Mati'] as $field => $value) {
            $this->assertStringNotContainsString($value, $raw->{$field});
            $this->assertSame($value, Crypt::decryptString($raw->{$field}));
            $this->assertArrayNotHasKey($field, $application->toArray());
        }
        $status = $this->postJson('/api/v1/applications/status', ['request_id' => $receipt['request_id'], 'lookup_secret' => $receipt['lookup_secret']])->assertOk();
        $this->act('staff');
        $responses = [
            $status,
            $this->getJson('/api/v1/staff/applications')->assertOk()->assertJsonPath('total', 1),
            $this->getJson('/api/v1/staff/summary')->assertOk(),
        ];
        foreach ($responses as $response) {
            foreach (['Konghucu', 'Cerai Mati', 'agama', 'status_perkawinan', 'pendidikan', 'pekerjaan'] as $needle) {
                $this->assertStringNotContainsString($needle, $response->getContent());
            }
        }
    }

    public function test_staff_detail_returns_decrypted_new_fields_and_neighborhood_heads_see_less(): void
    {
        $payload = self::letterPayload('KERAMAIAN', ['agama' => 'Hindu', 'status_perkawinan' => 'Kawin', 'pendidikan' => 'Strata II', 'pekerjaan' => 'Petani/Pekebun']);
        $id = $this->submit($payload)->assertCreated()->json('request_id');
        $this->act('staff');
        $detail = $this->getJson('/api/v1/staff/applications/'.$id)->assertOk()->json();
        foreach (['dusun', 'agama', 'kewarganegaraan', 'status_perkawinan', 'pendidikan', 'pekerjaan', 'acara', 'tempat_acara', 'tanggal_mulai', 'tanggal_selesai', 'jenis_hiburan'] as $field) {
            $this->assertSame($payload[$field], $detail[$field], $field);
        }
        $this->assertNull($detail['isi_keterangan']);
        $this->assertFalse($detail['can_edit_isi_keterangan']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'application.viewed']);

        config()->set('letters.neighborhood_approval', true);
        $this->act('rt_head', '001', '002');
        $detail = $this->getJson('/api/v1/staff/applications/'.$id)->assertOk()->assertJsonPath('dusun', 'Talang')->json();
        foreach (['agama', 'status_perkawinan', 'pendidikan', 'pekerjaan', 'kewarganegaraan'] as $field) $this->assertArrayNotHasKey($field, $detail);
    }

    public static function editableStatuses(): array
    {
        return [['SUBMITTED', true], ['VERIFIED', true], ['PROCESSING', true], ['NEED_REVISION', true],
            ['WAITING_APPROVAL', false], ['APPROVED', false], ['READY_FOR_PICKUP', false], ['COMPLETED', false], ['REJECTED', false]];
    }

    #[DataProvider('editableStatuses')]
    public function test_office_can_edit_statement_only_before_waiting_approval(string $status, bool $editable): void
    {
        $application = $this->umum($status);
        foreach (['staff', 'admin'] as $role) {
            $user = $this->act($role);
            $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertJsonPath('can_edit_isi_keterangan', $editable);
            $response = $this->edit($application, "  Disunting oleh $role.  ");
            if (! $editable) {
                $response->assertUnprocessable()->assertJsonPath('message', 'Isi keterangan tidak dapat disunting setelah diajukan ke Kepala Desa.');
                continue;
            }
            $response->assertOk()->assertJsonPath('isi_keterangan', "Disunting oleh $role.")->assertJsonPath('can_edit_isi_keterangan', true);
            $this->assertDatabaseHas('application_events', [
                'application_id' => $application->id, 'user_id' => $user->id, 'action' => 'STATEMENT_EDITED',
                'from_status' => $status, 'to_status' => $status, 'note' => 'Isi keterangan disunting',
            ]);
        }
        $fresh = $application->fresh();
        $this->assertSame($editable ? 'Disunting oleh admin.' : 'Orang tersebut bekerja di kota fiktif.', $fresh->isi_keterangan);
        $this->assertSame('Orang tersebut bekerja di kota fiktif.', $fresh->isi_keterangan_awal);
        $this->assertSame($status, $fresh->status);
        $this->assertSame($editable ? 2 : 0, DB::table('audit_logs')->where('action', 'application.statement_edited')->count());
        // Audit hanya aksi dan ID, tanpa isi lama/baru.
        foreach (DB::table('audit_logs')->get() as $audit) {
            $this->assertStringNotContainsString('Disunting', json_encode($audit));
            $this->assertStringNotContainsString('kota fiktif', json_encode($audit));
        }
    }

    public function test_statement_edit_roles_type_validation_and_territory(): void
    {
        $application = $this->umum('PROCESSING');
        foreach (['village_head', 'rt_head', 'rw_head'] as $role) {
            config()->set('letters.neighborhood_approval', in_array($role, ['rt_head', 'rw_head'], true));
            $this->act($role, '001', '002');
            $this->edit($application)->assertForbidden();
        }
        config()->set('letters.neighborhood_approval', false);
        $this->act('staff');
        $this->edit($application, 'a')->assertUnprocessable()->assertJsonValidationErrors(['isi_keterangan' => 'Isi keterangan minimal 2 karakter.']);
        $this->edit($application, str_repeat('a', 501))->assertUnprocessable()->assertJsonValidationErrors(['isi_keterangan' => 'Isi keterangan maksimal 500 karakter.']);
        $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/isi-keterangan', [])->assertUnprocessable()->assertJsonValidationErrors('isi_keterangan');
        $this->patchJson('/api/v1/staff/applications/REQ-2026-TIDAKADA/isi-keterangan', ['isi_keterangan' => 'Teks fiktif'])->assertNotFound();
        $this->patchJson('/api/v1/staff/applications/bukan-id/isi-keterangan', ['isi_keterangan' => 'Teks fiktif'])->assertUnprocessable();
        $other = $this->submit(self::letterPayload('DOMISILI'))->json('request_id');
        $this->patchJson('/api/v1/staff/applications/'.$other.'/isi-keterangan', ['isi_keterangan' => 'Teks fiktif'])
            ->assertUnprocessable()->assertJsonPath('message', 'Isi keterangan hanya ada pada Surat Keterangan Umum.');
        $this->assertSame('Orang tersebut bekerja di kota fiktif.', $application->fresh()->isi_keterangan);
        $this->assertDatabaseMissing('application_events', ['action' => 'STATEMENT_EDITED']);
        $this->app['auth']->forgetGuards();
        $this->edit($application)->assertUnauthorized();
    }

    public function test_edited_statement_is_shown_in_history_and_printed_letter(): void
    {
        $application = $this->umum('PROCESSING');
        $this->act('staff');
        $this->edit($application, 'Orang tersebut memiliki kesenian fiktif.')->assertOk();
        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()
            ->assertJsonPath('isi_keterangan', 'Orang tersebut memiliki kesenian fiktif.')
            ->assertJsonPath('isi_keterangan_awal', 'Orang tersebut bekerja di kota fiktif.')
            ->assertJsonPath('history.1.action', 'STATEMENT_EDITED')->assertJsonPath('history.1.note', 'Isi keterangan disunting');
        $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => 'WAITING_APPROVAL'])->assertOk();
        $this->assertSame('470/1/424.314.2.02/'.now()->year, DB::table('letter_numbers')->value('number'));
        $this->act('village_head');
        $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => 'APPROVED'])->assertOk();
        $this->assertNotNull(DB::table('letters')->value('path'), 'PDF jenis baru harus berhasil dibuat');
        $this->get('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf')->assertOk();
    }

    public function test_retention_purge_clears_new_personal_fields(): void
    {
        config(['retention.application_days' => 30]);
        $this->submit(self::letterPayload('KEHILANGAN'))->assertCreated();
        $this->submit(self::letterPayload('KERAMAIAN', ['agama' => 'Islam']))->assertCreated();
        $this->submit(self::letterPayload('UMUM'))->assertCreated();
        DB::table('applications')->update(['status' => 'COMPLETED', 'updated_at' => now()->subDays(31)]);
        $this->artisan('applications:purge')->expectsOutputToContain('3 permohonan dianonimkan')->assertSuccessful();
        $fields = ['dusun', 'agama', 'kewarganegaraan', 'status_perkawinan', 'pendidikan', 'pekerjaan', 'barang_hilang', 'acara',
            'tempat_acara', 'tanggal_mulai', 'tanggal_selesai', 'jenis_hiburan', 'isi_keterangan', 'isi_keterangan_awal'];
        foreach (DB::table('applications')->get($fields) as $row) {
            foreach ($fields as $field) $this->assertNull($row->{$field}, $field);
        }
    }
}
