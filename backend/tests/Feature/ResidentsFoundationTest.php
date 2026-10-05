<?php

namespace Tests\Feature;

use App\Models\Resident;
use Database\Seeders\DummyResidentSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

class ResidentsFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_dummy_seed_is_repeatable_and_identity_is_encrypted_and_hidden(): void
    {
        $this->seed(DummyResidentSeeder::class);
        $this->seed(DummyResidentSeeder::class);
        $this->assertDatabaseCount('residents', 3);
        $resident = Resident::where('dummy_reference', 'demo-resident-1')->firstOrFail();
        $this->assertSame('0000000000000001', $resident->nik);
        $this->assertSame('2000-03-14', $resident->tanggal_lahir);
        $this->assertTrue($resident->is_dummy);
        $raw = DB::table('residents')->where('id', $resident->id)->first();
        foreach (['nik', 'nama', 'tempat_lahir', 'tanggal_lahir'] as $field) {
            $this->assertNotSame($resident->$field, $raw->$field);
            $this->assertArrayNotHasKey($field, $resident->toArray());
        }
    }

    public function test_seed_refuses_production(): void
    {
        $this->app->instance('env', 'production');
        try {
            $this->seed(DummyResidentSeeder::class);
            $this->fail('Production seed must be rejected.');
        } catch (LogicException $exception) {
            $this->assertDatabaseCount('residents', 0);
        } finally {
            $this->app->instance('env', 'testing');
        }
    }

    public function test_seed_never_overwrites_non_dummy_record(): void
    {
        $this->seed(DummyResidentSeeder::class);
        $resident = Resident::where('dummy_reference', 'demo-resident-2')->firstOrFail();
        $resident->update(['is_dummy' => false, 'nama' => 'Protected test record']);
        try {
            $this->seed(DummyResidentSeeder::class);
            $this->fail('Non-dummy collision must be rejected.');
        } catch (LogicException $exception) {
            $this->assertSame('Protected test record', $resident->fresh()->nama);
            $this->assertDatabaseCount('residents', 3);
        }
    }
}
