<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** All identities here are fictional. */
class BirthDataEncryptionTest extends TestCase
{
    use RefreshDatabase;

    private function application(string $id = 'REQ-2026-BIRTH1'): Application
    {
        return Application::create([
            'request_id' => $id, 'lookup_secret_hash' => hash('sha256', 'kode-fiktif'),
            'jenis_surat' => 'SKU', 'nama' => 'Siti Wulandari',
            'nik' => '0000000000000001', 'no_kk' => '0000000000000002',
            'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-02',
            'jenis_kelamin' => 'Perempuan', 'alamat' => 'Jalan Fiktif 9',
            'rt' => '001', 'rw' => '002', 'telepon' => '08000000000',
            'nama_usaha' => 'Usaha Fiktif', 'jenis_usaha' => 'Dagang', 'alamat_usaha' => 'Pasar Fiktif',
            'keperluan' => 'Keperluan fiktif', 'status' => 'PROCESSING',
        ]);
    }

    private function raw(int $id): object
    {
        return DB::table('applications')->where('id', $id)->first(['tempat_lahir', 'tanggal_lahir', 'nama', 'jenis_kelamin', 'rt', 'rw']);
    }

    public function test_birth_data_is_encrypted_at_rest_and_hidden(): void
    {
        $application = $this->application();
        $raw = $this->raw($application->id);

        $this->assertStringNotContainsString('Tempat Fiktif', $raw->tempat_lahir);
        $this->assertStringNotContainsString('2000', $raw->tanggal_lahir);
        $this->assertSame('Tempat Fiktif', Crypt::decryptString($raw->tempat_lahir));
        $this->assertSame('2000-01-02', Crypt::decryptString($raw->tanggal_lahir));
        // Search/territory columns stay plain.
        $this->assertSame(['Siti Wulandari', 'Perempuan', '001', '002'], [$raw->nama, $raw->jenis_kelamin, $raw->rt, $raw->rw]);
        $this->assertArrayNotHasKey('tempat_lahir', $application->toArray());
        $this->assertArrayNotHasKey('tanggal_lahir', $application->toArray());
    }

    public function test_staff_detail_and_letter_show_decrypted_birth_data(): void
    {
        $application = $this->application();
        Sanctum::actingAs(User::factory()->create(['role' => 'staff']), ['applications:manage']);

        $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()
            ->assertJsonPath('tempat_lahir', 'Tempat Fiktif')
            ->assertJsonPath('tanggal_lahir', '2000-01-02');

        $html = view('letters.sku', [
            'a' => $application->fresh(), 'draft' => true, 'number' => null, 'qr' => null,
            'date' => now()->locale('id'), 'desa' => config('letters.desa'),
        ])->render();
        $this->assertStringContainsString('Tempat Fiktif, 2 Januari 2000', $html);
    }

    public function test_migration_round_trip_keeps_legacy_rows_intact(): void
    {
        $migration = require database_path('migrations/2026_10_25_000000_encrypt_application_birth_data.php');
        $migration->down();

        // Legacy plaintext rows: SQLite stored dates with a time part, PostgreSQL without.
        $ids = [];
        foreach (['2000-01-02 00:00:00', '1985-12-31'] as $i => $date) {
            $ids[] = DB::table('applications')->insertGetId([
                'request_id' => 'REQ-2026-OLD'.$i, 'lookup_secret_hash' => 'x', 'jenis_surat' => 'SKU',
                'nama' => 'Nama Fiktif', 'nik' => Crypt::encryptString('0000000000000001'), 'no_kk' => Crypt::encryptString('0000000000000002'),
                'tempat_lahir' => 'Kota Fiktif '.$i, 'tanggal_lahir' => $date, 'jenis_kelamin' => 'Laki-laki',
                'alamat' => Crypt::encryptString('Jalan Fiktif'), 'rt' => '001', 'rw' => '002',
                'telepon' => Crypt::encryptString('08000000000'), 'keperluan' => 'Fiktif', 'status' => 'SUBMITTED',
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        $expected = [['Kota Fiktif 0', '2000-01-02'], ['Kota Fiktif 1', '1985-12-31']];

        foreach (['up', 'down', 'up'] as $step) {
            $migration->{$step}();
            foreach ($ids as $i => $id) {
                if ($step === 'up') {
                    $model = Application::find($id);
                    $this->assertSame($expected[$i], [$model->tempat_lahir, $model->tanggal_lahir], $step);
                    $this->assertNotSame($expected[$i][0], $this->raw($id)->tempat_lahir);
                } else {
                    $raw = $this->raw($id);
                    $this->assertSame($expected[$i][0], $raw->tempat_lahir);
                    $this->assertStringStartsWith($expected[$i][1], (string) $raw->tanggal_lahir);
                }
            }
        }
    }
}
