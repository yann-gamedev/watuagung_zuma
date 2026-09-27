<?php
namespace Tests\Feature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
class ApplicationsApiTest extends TestCase {
    use RefreshDatabase;
    private function payload(): array { return [
        'jenis_surat'=>'SKU','nama'=>'Warga Contoh','nik'=>'0000000000000000','no_kk'=>'0000000000000000',
        'tempat_lahir'=>'Contoh','tanggal_lahir'=>'2000-01-01','jenis_kelamin'=>'Laki-laki',
        'alamat'=>'Alamat fiktif','rt'=>'01','rw'=>'02','telepon'=>'08000000000',
        'nama_usaha'=>'Warung Contoh','jenis_usaha'=>'Perdagangan','alamat_usaha'=>'Alamat fiktif',
        'keperluan'=>'Keperluan contoh',
    ]; }
    public function test_submission_and_private_status_lookup(): void {
        $response = $this->postJson('/api/v1/applications', $this->payload())->assertCreated()->assertJsonPath('status','SUBMITTED');
        $id = $response->json('request_id'); $secret = $response->json('lookup_secret');
        $this->assertNotEmpty($secret);
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>'wrong'])->assertNotFound();
        $this->postJson('/api/v1/applications/status',['request_id'=>$id,'lookup_secret'=>$secret])->assertOk()->assertJsonMissing(['nik'=>'0000000000000000']);
        $this->assertEquals(1, DB::table('application_events')->count());
        $this->assertNotEquals('0000000000000000', DB::table('applications')->value('nik'));
    }
    public function test_validation_and_authentication(): void {
        $this->postJson('/api/v1/applications', array_merge($this->payload(), ['nik'=>'123','nama_usaha'=>null]))->assertUnprocessable()->assertJsonValidationErrors(['nik','nama_usaha']);
        $this->getJson('/api/v1/staff/applications')->assertUnauthorized();
        $this->postJson('/api/v1/staff/login',['email'=>'wrong@example.com','password'=>'wrong'])->assertUnauthorized();
    }
    public function test_staff_can_progress_status_with_audit(): void {
        $id = $this->postJson('/api/v1/applications', $this->payload())->json('request_id');
        Sanctum::actingAs(User::factory()->create(), ['applications:manage']);
        $url = '/api/v1/staff/applications/'.$id.'/status';
        $this->patchJson($url,['status'=>'APPROVED'])->assertUnprocessable();
        $this->patchJson($url,['status'=>'NEED_REVISION'])->assertUnprocessable();
        $this->patchJson($url,['status'=>'VERIFIED'])->assertOk();
        $this->getJson('/api/v1/staff/applications?status=VERIFIED')->assertOk()->assertJsonPath('total',1)->assertJsonMissing(['nik'=>'0000000000000000']);
        $this->assertEquals(2, DB::table('application_events')->count());
    }
}
