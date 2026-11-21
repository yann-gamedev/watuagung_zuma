<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\LetterPayloads;
use Tests\TestCase;

class QrLetterValidityMigrationTest extends TestCase
{
    // DDL must run outside RefreshDatabase's transaction, including on MariaDB.
    use DatabaseMigrations, LetterPayloads;

    public function test_up_backfills_only_released_letters_and_down_preserves_system_files_as_generated(): void
    {
        $migration = require database_path('migrations/2026_11_21_000000_add_qr_letter_validity.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('letters', 'valid_until'));
        $head = User::factory()->create(['role' => 'village_head']);
        $ids = [];
        foreach ([['uploaded', '2026-11-01 12:34:56'], ['generated', '2026-11-02 12:34:56'], ['generated', null]] as [$source, $ready]) {
            $application = Application::create(self::letterPayload('DOMISILI') + [
                'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
                'lookup_secret_hash' => hash('sha256', 'kode-fiktif'), 'status' => 'COMPLETED',
            ]);
            $ids[] = DB::table('letters')->insertGetId([
                'application_id' => $application->id, 'verification_code' => Str::random(32),
                'approved_by' => $head->id, 'approved_at' => '2026-11-01 12:34:56',
                'ready_at' => $ready, 'source' => $source, 'path' => 'letters/legacy-'.$application->id.'.pdf',
                'sha256' => hash('sha256', 'PDF fiktif'),
            ]);
        }
        $before = DB::table('letters')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        config(['letters.validity_days' => 99]); // Existing releases receive fixed seven-day policy.
        $migration->up();
        $rows = DB::table('letters')->orderBy('id')->get();
        $this->assertSame('2026-11-08 12:34:56', $rows[0]->valid_until);
        $this->assertSame('2026-11-09 12:34:56', $rows[1]->valid_until);
        $this->assertNull($rows[2]->valid_until);
        foreach ($rows as $index => $row) {
            $values = (array) $row;
            unset($values['valid_until']);
            $this->assertSame($before[$index], $values);
        }
        DB::table('letters')->where('id', $ids[0])->update(['source' => 'system']);
        $migration->down();
        $this->assertFalse(Schema::hasColumn('letters', 'valid_until'));
        $this->assertSame('generated', DB::table('letters')->where('id', $ids[0])->value('source'));
        $this->assertSame($before[0]['path'], DB::table('letters')->where('id', $ids[0])->value('path'));
        $this->assertSame($before[0]['sha256'], DB::table('letters')->where('id', $ids[0])->value('sha256'));
        $migration->up(); // Restore schema for subsequent tests on shared MariaDB database.
        $this->assertTrue(Schema::hasColumn('letters', 'valid_until'));
    }
}
