<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Encryption\Encrypter;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\LetterPayloads;
use Tests\TestCase;

/** All identities, statements, and notes here are fictional. */
class ApplicationFreeTextEncryptionTest extends TestCase
{
    use DatabaseMigrations, LetterPayloads;

    private const FIELDS = [
        'keperluan', 'isi_keterangan', 'isi_keterangan_awal', 'barang_hilang',
        'pekerjaan', 'pendidikan', 'catatan',
    ];

    public function test_model_writes_encrypt_free_text_and_preserve_null_empty_and_unicode(): void
    {
        foreach ([null, '', "Teks fiktif é 漢字 🏡\nBaris kedua"] as $index => $value) {
            $fields = array_fill_keys(self::FIELDS, $value);
            $fields['keperluan'] ??= 'Keperluan fiktif';
            $application = Application::create(array_replace(self::letterPayload('UMUM'), $fields, [
                'request_id' => 'REQ-2026-TEXT'.$index,
                'lookup_secret_hash' => hash('sha256', 'kode-fiktif'),
                'status' => 'SUBMITTED',
            ]));
            $raw = DB::table('applications')->where('id', $application->id)->first();
            $fresh = $application->fresh();
            foreach ($fields as $field => $expected) {
                $this->assertSame($expected, $fresh->{$field}, $field);
                if ($expected === null) {
                    $this->assertNull($raw->{$field}, $field);
                } else {
                    $this->assertNotSame($expected, $raw->{$field}, $field);
                    $this->assertSame($expected, Crypt::decryptString($raw->{$field}), $field);
                }
            }
        }
    }

    public function test_submission_detail_status_history_and_void_reason_keep_plaintext_contracts(): void
    {
        $payload = self::letterPayload('UMUM', ['isi_keterangan' => 'Keterangan fiktif é 漢字.']);
        $submitted = $this->submitLetter($payload)->assertCreated();
        $id = $submitted->json('request_id');
        $url = '/api/v1/staff/applications/'.$id;
        $raw = DB::table('applications')->where('request_id', $id)->first();
        foreach (['keperluan', 'isi_keterangan', 'pendidikan', 'pekerjaan'] as $field) {
            $this->assertSame($payload[$field], Crypt::decryptString($raw->{$field}), $field);
        }
        $this->assertSame($payload['isi_keterangan'], Crypt::decryptString($raw->isi_keterangan_awal));

        Sanctum::actingAs(User::factory()->create(['role' => 'staff']), ['applications:manage']);
        $edited = 'Keterangan hasil suntingan fiktif é 漢字.';
        $this->patchJson($url.'/isi-keterangan', ['isi_keterangan' => $edited])->assertOk()
            ->assertJsonPath('isi_keterangan', $edited);
        $detail = $this->getJson($url)->assertOk()
            ->assertJsonPath('isi_keterangan', $edited)
            ->assertJsonPath('isi_keterangan_awal', $payload['isi_keterangan']);
        foreach (['keperluan', 'pendidikan', 'pekerjaan'] as $field) {
            $detail->assertJsonPath($field, $payload[$field]);
        }
        foreach (['VERIFIED', 'PROCESSING', 'WAITING_APPROVAL'] as $status) {
            $this->patchJson($url.'/status', ['status' => $status])->assertOk();
        }
        Sanctum::actingAs(User::factory()->create(['role' => 'village_head']), ['applications:manage']);
        $note = 'Perbaiki keterangan fiktif é 漢字.';
        $this->patchJson($url.'/status', ['status' => 'NEED_REVISION', 'catatan' => $note])->assertOk()
            ->assertJsonPath('catatan', $note);

        $raw = DB::table('applications')->where('request_id', $id)->first();
        $this->assertSame($edited, Crypt::decryptString($raw->isi_keterangan));
        $this->assertSame($note, Crypt::decryptString($raw->catatan));
        $events = DB::table('application_events')->where('application_id', $raw->id)->get();
        $this->assertSame('Isi keterangan disunting', Crypt::decryptString($events->firstWhere('action', 'STATEMENT_EDITED')->note));
        $this->assertSame($note, Crypt::decryptString($events->firstWhere('to_status', 'NEED_REVISION')->note));
        $this->assertSame($note, Crypt::decryptString(DB::table('letter_numbers')->where('application_id', $raw->id)->value('void_reason')));
        $this->getJson($url)->assertOk()->assertJsonPath('catatan', $note)
            ->assertJsonPath('letter_numbers.0.void_reason', $note)
            ->assertJsonFragment(['note' => $note])
            ->assertJsonFragment(['note' => 'Isi keterangan disunting']);
        $public = $this->postJson('/api/v1/applications/status', [
            'request_id' => $id, 'lookup_secret' => $submitted->json('lookup_secret'),
        ])->assertOk()->assertJsonPath('catatan', $note)->assertJsonPath('status', 'NEED_REVISION');
        foreach (array_diff(self::FIELDS, ['catatan']) as $field) {
            $public->assertJsonMissingPath($field);
        }
    }

    public function test_migration_up_down_up_preserves_legacy_rows_across_chunk_boundary(): void
    {
        $migration = require database_path('migrations/2026_11_18_000000_encrypt_application_free_text.php');
        $migration->down();
        $user = User::factory()->create(['role' => 'staff']);
        $applications = $events = $numbers = [];
        for ($i = 1; $i <= 503; $i++) {
            $fields = [];
            foreach (self::FIELDS as $index => $field) {
                $fields[$field] = match (($i + $index) % 3) {
                    0 => $field === 'keperluan' ? 'Keperluan fiktif '.$i : null,
                    1 => '',
                    2 => 'Teks fiktif é 漢字 🏡 '.$i,
                };
            }
            $applications[] = $fields + [
                'id' => $i, 'request_id' => 'REQ-2026-LEGACY'.$i,
                'lookup_secret_hash' => hash('sha256', 'kode-fiktif-'.$i),
                'jenis_surat' => 'UMUM', 'nama' => 'Pemohon Fiktif '.$i,
                'nik' => Crypt::encryptString('0000000000000001'),
                'no_kk' => Crypt::encryptString('0000000000000002'),
                'tempat_lahir' => Crypt::encryptString('Tempat Fiktif'),
                'tanggal_lahir' => Crypt::encryptString('2000-01-02'),
                'jenis_kelamin' => 'Perempuan', 'alamat' => Crypt::encryptString('Alamat fiktif'),
                'rt' => '001', 'rw' => '002', 'telepon' => Crypt::encryptString('08000000000'),
                'dusun' => 'Talang', 'kewarganegaraan' => 'WNI', 'status' => 'NEED_REVISION',
                'created_at' => '2026-01-02 03:04:05', 'updated_at' => '2026-02-03 04:05:06',
            ];
            $note = match ($i % 3) { 0 => null, 1 => '', 2 => 'Catatan fiktif é 漢字 🏡 '.$i };
            $events[] = [
                'application_id' => $i, 'user_id' => $user->id, 'action' => null,
                'from_status' => 'WAITING_APPROVAL', 'to_status' => 'NEED_REVISION',
                'note' => $note, 'created_at' => '2026-02-03 04:05:06',
            ];
            $numbers[] = [
                'application_id' => $i, 'year' => 2026, 'sequence' => $i,
                'number' => '470/'.$i.'/424.314.2.02/2026', 'status' => 'void',
                'void_reason' => $note, 'issued_by' => $user->id, 'issued_at' => '2026-01-02 03:04:05',
            ];
        }
        foreach (['applications' => $applications, 'application_events' => $events, 'letter_numbers' => $numbers] as $table => $rows) {
            foreach (array_chunk($rows, 100) as $chunk) DB::table($table)->insert($chunk);
        }
        $columns = ['applications' => self::FIELDS, 'application_events' => ['note'], 'letter_numbers' => ['void_reason']];
        $before = [];
        foreach ($columns as $table => $fields) {
            $before[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
            $this->assertCount(503, $before[$table]);
        }

        $previousStep = null;
        $previousRows = [];
        foreach (['up', 'up', 'down', 'down', 'up'] as $step) {
            $migration->{$step}();
            foreach ($columns as $table => $fields) {
                $rows = DB::table($table)->orderBy('id')->get();
                $this->assertCount(503, $rows, $table);
                if ($previousStep === $step) {
                    $this->assertEquals($previousRows[$table], $rows, 'Retry must not rewrite '.$table);
                }
                $previousRows[$table] = $rows;
                foreach ($rows as $index => $row) {
                    $actual = (array) $row;
                    foreach ($fields as $field) {
                        if ($step === 'up' && $before[$table][$index][$field] !== null) {
                            $this->assertNotSame($before[$table][$index][$field], $actual[$field], $table.'.'.$field);
                            $actual[$field] = Crypt::decryptString($actual[$field]);
                        }
                    }
                    // Comparing whole rows also protects searchable fields, IDs, and every timestamp.
                    $this->assertSame($before[$table][$index], $actual, $step.' '.$table.' '.$row->id);
                }
            }
            $previousStep = $step;
        }
    }

    public function test_migration_rejects_mixed_or_unreadable_data_without_partial_rewrites(): void
    {
        $migration = require database_path('migrations/2026_11_18_000000_encrypt_application_free_text.php');
        $application = Application::create(self::letterPayload('UMUM') + [
            'request_id' => 'REQ-2026-REFUSAL', 'lookup_secret_hash' => 'fiktif', 'status' => 'SUBMITTED',
        ]);
        $original = (array) DB::table('applications')->where('id', $application->id)->first();
        $wrongKey = new Encrypter(random_bytes(32), 'AES-256-CBC');
        $invalid = [
            ['Teks biasa fiktif', 'Mixed plaintext and ciphertext'],
            [$wrongKey->encryptString('Teks fiktif'), 'Unreadable encrypted free-text payload'],
        ];
        foreach ($invalid as [$value, $message]) {
            DB::table('applications')->where('id', $application->id)->update(['pekerjaan' => $value]);
            $before = (array) DB::table('applications')->where('id', $application->id)->first();
            foreach (['up', 'down'] as $step) {
                try {
                    $migration->{$step}();
                    $this->fail('Migration should refuse '.$step);
                } catch (\RuntimeException $exception) {
                    $this->assertStringContainsString($message, $exception->getMessage());
                }
                $this->assertSame($before, (array) DB::table('applications')->where('id', $application->id)->first());
            }
        }
        DB::table('applications')->where('id', $application->id)->update(['pekerjaan' => $original['pekerjaan']]);
    }

    public function test_rollback_refuses_overlong_plaintext_before_decrypting_any_row(): void
    {
        $migration = require database_path('migrations/2026_11_18_000000_encrypt_application_free_text.php');
        $application = Application::create(self::letterPayload('UMUM') + [
            'request_id' => 'REQ-2026-LENGTH', 'lookup_secret_hash' => 'fiktif', 'status' => 'SUBMITTED',
        ]);
        foreach (['pekerjaan' => 61, 'pendidikan' => 61, 'barang_hilang' => 201] as $field => $length) {
            $original = DB::table('applications')->where('id', $application->id)->value($field);
            DB::table('applications')->where('id', $application->id)->update([$field => Crypt::encryptString(str_repeat('é', $length))]);
            $before = (array) DB::table('applications')->where('id', $application->id)->first();
            try {
                $migration->down();
                $this->fail('Rollback should refuse overlong '.$field);
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Cannot restore applications.'.$field, $exception->getMessage());
            }
            $this->assertSame($before, (array) DB::table('applications')->where('id', $application->id)->first());
            DB::table('applications')->where('id', $application->id)->update([$field => $original]);
        }
    }
}
