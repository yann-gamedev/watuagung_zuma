<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\LetterPayloads;
use Tests\TestCase;
class ApplicationsApiTest extends TestCase {
    use RefreshDatabase, LetterPayloads;
    private function payload(): array { return self::letterPayload('SKTM', ['nik'=>'0000000000000000','no_kk'=>'0000000000000000']); }
    public function test_submission_and_private_status_lookup(): void {
        $response = $this->postJson('/api/v1/applications', $this->payload())->assertCreated()->assertJsonPath('status','SUBMITTED');
        $id = $response->json('request_id'); $secret = $response->json('lookup_secret');
        $this->assertNotEmpty($secret);
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>'wrong'])->assertNotFound();
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>$secret])->assertOk()->assertJsonMissing(['nik'=>'0000000000000000']);
        $this->assertEquals(1, DB::table('application_events')->count());
        $this->assertNotEquals('0000000000000000', DB::table('applications')->value('nik'));
    }
    public function test_access_code_format_normalization_and_lockout(): void {
        $response = $this->postJson('/api/v1/applications', $this->payload())->assertCreated();
        $id = $response->json('request_id'); $secret = $response->json('lookup_secret');
        $this->assertMatchesRegularExpression('/\AWAD-[0-9]{4}-[0-9]{4}\z/', $secret);
        $this->assertNotEquals(hash('sha256', $secret), DB::table('applications')->value('lookup_secret_hash'));
        $loose = strtolower(str_replace('-', ' ', $secret));
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>$loose])->assertOk();
        for ($i = 0; $i < 5; $i++) $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>'WAD-0000-0000'])->assertNotFound();
        // Terkunci: kode benar pun ditolak sampai 15 menit berlalu.
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>$secret])->assertTooManyRequests();
        $this->travel(16)->minutes();
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>$secret])->assertOk();
    }
    public function test_legacy_access_code_still_works(): void {
        $id = $this->postJson('/api/v1/applications', $this->payload())->json('request_id');
        $legacy = str_repeat('aB3', 16);
        DB::table('applications')->update(['lookup_secret_hash'=>hash('sha256', $legacy)]);
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>$legacy])->assertOk();
    }
    public function test_validation_and_authentication(): void {
        $this->postJson('/api/v1/applications', array_merge($this->payload(), ['nik'=>'123','nama_usaha'=>'Usaha fiktif']))->assertUnprocessable()->assertJsonValidationErrors(['nik'=>'NIK harus 16 digit angka.','nama_usaha'=>'Nama usaha tidak dipakai untuk jenis surat ini.']);
        $this->getJson('/api/v1/staff/applications')->assertUnauthorized();
        $this->postJson('/api/v1/staff/login',['email'=>'wrong@example.com','password'=>'wrong'])->assertUnauthorized();
    }
    public function test_staff_can_progress_status_with_audit(): void {
        $id = $this->postJson('/api/v1/applications', $this->payload())->json('request_id');
        Sanctum::actingAs(User::factory()->create(['role'=>'staff']), ['applications:manage']);
        $url = '/api/v1/staff/applications/'.$id.'/status';
        $this->patchJson($url,['status'=>'APPROVED'])->assertUnprocessable();
        $this->patchJson($url,['status'=>'NEED_REVISION'])->assertUnprocessable();
        $this->patchJson($url,['status'=>'VERIFIED'])->assertOk();
        $this->getJson('/api/v1/staff/applications?status=VERIFIED')->assertOk()->assertJsonPath('total',1)->assertJsonMissing(['nik'=>'0000000000000000']);
        $this->assertEquals(2, DB::table('application_events')->count());
    }
}
