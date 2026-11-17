<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use App\Support\AttachmentStore;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\LetterPayloads;
use Tests\TestCase;

/** Akses petugas, penggantian oleh warga, dan retensi lampiran. Seluruh identitas dan berkas fiktif. */
class AttachmentAccessTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    private const PDF = "%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n%%EOF\n";

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
    }

    /** @return array{0: Application, 1: string} permohonan + kode akses */
    private function submitted(array $files = []): array
    {
        $response = $this->submitLetter(self::letterPayload(), self::letterAttachments($files))->assertCreated();

        return [Application::where('request_id', $response->json('request_id'))->firstOrFail(), $response->json('lookup_secret')];
    }

    private function act(string $role, array $abilities = ['panel', 'applications:manage']): User
    {
        $user = User::factory()->create(['role' => $role, 'name' => 'Petugas Fiktif']);
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, $abilities);

        return $user;
    }

    private function attachment(Application $application, string $kind): object
    {
        return DB::table('application_attachments')->where('application_id', $application->id)->where('kind', $kind)->first();
    }

    private function url(Application $application, int|string $id): string
    {
        return '/api/v1/staff/applications/'.$application->request_id.'/attachments/'.$id;
    }

    private function replace(Application $application, string $secret, array $files)
    {
        return $this->post('/api/v1/applications/attachments', ['request_id' => $application->request_id, 'lookup_secret' => $secret, 'lampiran' => $files], ['Accept' => 'application/json']);
    }

    private function image(int $width = 900, int $height = 700): UploadedFile
    {
        return UploadedFile::fake()->image('KTP Warga Fiktif.jpg', $width, $height);
    }

    // ---- Detail dan unduhan petugas ----

    public function test_staff_detail_lists_attachments_without_storage_details(): void
    {
        [$application] = $this->submitted(['PENGANTAR_RT_RW' => UploadedFile::fake()->createWithContent('p.pdf', self::PDF)]);
        $this->act('staff');
        $list = $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->json('attachments');
        $this->assertSame(['KTP', 'KK', 'PENGANTAR_RT_RW'], array_column($list, 'kind'));
        $this->assertSame(['KTP', 'Kartu Keluarga (KK)', 'Surat Pengantar RT/RW'], array_column($list, 'label'));
        $this->assertSame(['id', 'kind', 'label', 'stored_mime', 'size_bytes', 'uploaded_at', 'purged'], array_keys($list[0]));
        $this->assertSame('application/pdf', $list[2]['stored_mime']);
        $this->assertSame(strlen(self::PDF), $list[2]['size_bytes']);
        $this->assertFalse($list[0]['purged']);
        $body = $this->getJson('/api/v1/staff/applications/'.$application->request_id)->getContent();
        $this->assertStringNotContainsString('attachments/', $body);
        $this->assertStringNotContainsString($this->attachment($application, 'KTP')->sha256, $body);
    }

    #[DataProvider('readerRoles')]
    public function test_office_roles_open_attachment_with_safe_headers_and_audit(string $role): void
    {
        [$application] = $this->submitted(['PENGANTAR_RT_RW' => UploadedFile::fake()->createWithContent('p.pdf', self::PDF)]);
        $user = $this->act($role);
        $ktp = $this->attachment($application, 'KTP');
        $image = $this->get($this->url($application, $ktp->id))->assertOk();
        $this->assertSame(AttachmentStore::contents($ktp), $image->getContent());
        $this->assertSame($ktp->stored_mime, $image->headers->get('Content-Type'));
        $extension = $ktp->stored_mime === 'image/webp' ? 'webp' : 'jpg';
        $this->assertSame('inline; filename="'.$application->request_id.'-KTP.'.$extension.'"', $image->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', $image->headers->get('Cache-Control'));
        $this->assertStringContainsString('private', $image->headers->get('Cache-Control'));
        $this->assertSame('nosniff', $image->headers->get('X-Content-Type-Options'));

        $pdf = $this->attachment($application, 'PENGANTAR_RT_RW');
        $download = $this->get($this->url($application, $pdf->id))->assertOk();
        $this->assertSame(self::PDF, $download->getContent());
        $this->assertSame('application/pdf', $download->headers->get('Content-Type'));
        $this->assertSame('attachment; filename="'.$application->request_id.'-PENGANTAR_RT_RW.pdf"', $download->headers->get('Content-Disposition'));

        // Setiap pembukaan dicatat, termasuk membuka berkas yang sama lagi.
        $this->get($this->url($application, $ktp->id))->assertOk();
        $audits = DB::table('audit_logs')->where('action', 'attachment.viewed')->orderBy('id')->get();
        $this->assertSame([(int) $ktp->id, (int) $pdf->id, (int) $ktp->id], $audits->pluck('subject_id')->map(fn ($id) => (int) $id)->all());
        foreach ($audits as $audit) {
            $this->assertSame('attachment', $audit->subject_type);
            $this->assertSame($user->id, (int) $audit->user_id);
        }
    }

    /** @return array<string, array{string}> */
    public static function readerRoles(): array
    {
        return ['staff' => ['staff'], 'admin' => ['admin'], 'village_head' => ['village_head']];
    }

    public function test_kim_and_neighborhood_heads_cannot_open_attachments(): void
    {
        [$application] = $this->submitted();
        $id = $this->attachment($application, 'KTP')->id;
        // KIM: token sesungguhnya tanpa applications:manage, lalu token bocor dengan ability itu.
        $this->act('kim', ['panel', 'media:manage']);
        $this->get($this->url($application, $id))->assertForbidden();
        $this->act('kim', ['panel', 'applications:manage', 'media:manage', 'site:manage']);
        $this->get($this->url($application, $id))->assertForbidden();
        // Ketua RT/RW (fitur aktif, wilayah sama) tidak membuka dokumen identitas.
        config(['letters.neighborhood_approval' => true]);
        foreach (['rt_head' => ['rt' => '001', 'rw' => '002'], 'rw_head' => ['rt' => null, 'rw' => '002']] as $role => $area) {
            $user = User::factory()->create(['role' => $role] + $area);
            $this->app['auth']->forgetGuards();
            Sanctum::actingAs($user, ['panel', 'applications:manage']);
            $this->get($this->url($application, $id))->assertForbidden();
            $this->assertArrayNotHasKey('attachments', $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->json());
        }
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'attachment.viewed')->count());
    }

    public function test_unauthenticated_and_wrong_ids(): void
    {
        [$application] = $this->submitted();
        [$other] = $this->submitted();
        $id = $this->attachment($application, 'KTP')->id;
        $this->getJson($this->url($application, $id))->assertUnauthorized();
        $this->act('staff');
        // Lampiran milik permohonan lain lewat nomor permohonan ini → 404, bukan isi lampiran.
        $this->getJson($this->url($other, $id))->assertNotFound();
        $this->getJson($this->url($application, 999999))->assertNotFound();
        $this->getJson('/api/v1/staff/applications/REQ-2026-TIDAKADA/attachments/'.$id)->assertNotFound();
        $this->getJson('/api/v1/staff/applications/bukan-nomor/attachments/'.$id)->assertUnprocessable();
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'attachment.viewed')->count());
    }

    public function test_purged_attachment_returns_410_without_audit(): void
    {
        [$application] = $this->submitted();
        $ktp = $this->attachment($application, 'KTP');
        DB::table('application_attachments')->where('id', $ktp->id)->update(['purged_at' => now(), 'path' => null]);
        $this->act('staff');
        $this->getJson($this->url($application, $ktp->id))->assertStatus(410);
        $this->assertTrue(collect($this->getJson('/api/v1/staff/applications/'.$application->request_id)->json('attachments'))->firstWhere('kind', 'KTP')['purged']);
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'attachment.viewed')->count());
    }

    public function test_audit_failure_withholds_contents(): void
    {
        [$application] = $this->submitted();
        $this->act('staff');
        $this->failInsertsInto('audit_logs');
        $response = $this->get($this->url($application, $this->attachment($application, 'KTP')->id));
        $this->assertSame(500, $response->status());
        $this->assertStringNotContainsString('WEBP', $response->getContent());
        $this->assertStringNotContainsString('JFIF', $response->getContent());
    }

    public function test_view_throttle_is_sixty_per_minute(): void
    {
        [$application] = $this->submitted();
        $this->withMiddleware(ThrottleRequests::class);
        $this->act('staff');
        $url = $this->url($application, $this->attachment($application, 'KTP')->id);
        for ($i = 0; $i < 60; $i++) $this->get($url)->assertOk();
        $this->get($url)->assertTooManyRequests();
        $this->assertSame(60, DB::table('audit_logs')->where('action', 'attachment.viewed')->count());
    }

    // ---- Penggantian oleh warga ----

    public function test_applicant_replaces_attachment_during_revision(): void
    {
        [$application, $secret] = $this->submitted();
        $application->update(['status' => 'NEED_REVISION']);
        $before = $this->attachment($application, 'KTP');
        $kkBefore = $this->attachment($application, 'KK');
        $pdf = UploadedFile::fake()->createWithContent('KTP Warga Fiktif.pdf', self::PDF);
        $this->replace($application, $secret, ['KTP' => $pdf])->assertOk()
            ->assertExactJson(['success' => true, 'request_id' => $application->request_id, 'status' => 'NEED_REVISION', 'lampiran' => ['KTP', 'KK', 'PENGANTAR_RT_RW']]);

        $after = $this->attachment($application, 'KTP');
        $this->assertSame($before->id, $after->id);
        $this->assertNotSame($before->path, $after->path);
        $this->assertSame('application/pdf', $after->stored_mime);
        $this->assertSame(hash('sha256', self::PDF), $after->sha256);
        $this->assertSame(self::PDF, AttachmentStore::contents($after));
        $this->assertFalse(Storage::disk('local')->exists($before->path));
        // Lampiran yang tidak dikirim tetap.
        $this->assertEquals($kkBefore, $this->attachment($application, 'KK'));
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
        $this->assertSame(3, DB::table('application_attachments')->count());

        $event = DB::table('application_events')->orderByDesc('id')->first();
        $this->assertSame('ATTACHMENTS_UPDATED', $event->action);
        $this->assertSame('NEED_REVISION', $event->from_status);
        $this->assertSame('NEED_REVISION', $event->to_status);
        $this->assertSame('Lampiran diperbarui: KTP', $event->note);
        $this->assertNull($event->user_id);
        $this->assertSame('NEED_REVISION', $application->fresh()->status);
        $this->assertStringNotContainsString('Warga Fiktif', json_encode(DB::table('application_attachments')->get()));

        // Beberapa lampiran sekaligus; staf melihatnya di riwayat.
        $this->replace($application, $secret, ['KK' => $this->image(), 'PENGANTAR_RT_RW' => $this->image()])->assertOk();
        $this->assertSame('Lampiran diperbarui: Kartu Keluarga (KK), Surat Pengantar RT/RW', DB::table('application_events')->orderByDesc('id')->value('note'));
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
        $this->act('staff');
        $history = $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->json('history');
        $this->assertSame('ATTACHMENTS_UPDATED', end($history)['action']);
    }

    public function test_replacement_only_while_need_revision(): void
    {
        [$application, $secret] = $this->submitted();
        foreach (['SUBMITTED', 'VERIFIED', 'PROCESSING', 'WAITING_APPROVAL', 'APPROVED', 'READY_FOR_PICKUP', 'COMPLETED', 'REJECTED'] as $status) {
            $application->update(['status' => $status]);
            $this->replace($application, $secret, ['KTP' => $this->image()])->assertUnprocessable()
                ->assertJsonPath('message', 'Lampiran hanya dapat diganti saat permohonan berstatus perlu perbaikan.');
        }
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
        $this->assertSame(1, DB::table('application_events')->count());
    }

    public function test_replacement_validation(): void
    {
        [$application, $secret] = $this->submitted();
        $application->update(['status' => 'NEED_REVISION']);
        $this->replace($application, $secret, [])->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran' => 'Pilih minimal satu lampiran yang akan diganti.']);
        $this->replace($application, $secret, ['LAINNYA' => $this->image()])->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran' => 'Jenis lampiran tidak dikenal untuk surat ini.']);
        $this->replace($application, $secret, ['KTP' => UploadedFile::fake()->createWithContent('ktp.jpg', 'bukan foto')])->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP']);
        $this->replace($application, $secret, ['KTP' => $this->image(800, 500)])->assertUnprocessable()
            ->assertJsonValidationErrors(['lampiran.KTP' => 'Foto terlalu kecil untuk dibaca.']);
        $this->post('/api/v1/applications/attachments', ['lampiran' => ['KTP' => $this->image()]], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors(['request_id', 'lookup_secret']);
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
        $this->assertSame(1, DB::table('application_events')->count());
    }

    public function test_wrong_access_code_shares_lockout_with_status_lookup(): void
    {
        [$application, $secret] = $this->submitted();
        $application->update(['status' => 'NEED_REVISION']);
        for ($i = 0; $i < 3; $i++) $this->replace($application, 'WAD-0000-0000', ['KTP' => $this->image()])->assertNotFound();
        for ($i = 0; $i < 2; $i++) $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => 'WAD-0000-0000'])->assertNotFound();
        // Lima salah gabungan: kode benar pun ditolak di kedua endpoint.
        $this->replace($application, $secret, ['KTP' => $this->image()])->assertTooManyRequests();
        $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => $secret])->assertTooManyRequests();
        $this->replace(new Application(['request_id' => 'REQ-2026-TIDAKADA']), $secret, ['KTP' => $this->image()])->assertNotFound();
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
        $this->travel(16)->minutes();
        $this->replace($application, $secret, ['KTP' => $this->image()])->assertOk();
    }

    public function test_failed_replacement_keeps_old_file_and_removes_new_one(): void
    {
        [$application, $secret] = $this->submitted();
        $application->update(['status' => 'NEED_REVISION']);
        $before = $this->attachment($application, 'KTP');
        $files = Storage::disk('local')->allFiles('attachments');
        $this->failInsertsInto('application_events');
        $this->replace($application, $secret, ['KTP' => $this->image()])->assertStatus(500);
        $this->restoreInsertsInto('application_events');
        $this->assertEquals($before, $this->attachment($application, 'KTP'));
        $this->assertSame($files, Storage::disk('local')->allFiles('attachments'));
        $this->assertNotFalse(getimagesizefromstring(AttachmentStore::contents($before)));
    }

    public function test_replacement_route_throttle_still_applies(): void
    {
        [$application, $secret] = $this->submitted();
        $this->withMiddleware(ThrottleRequests::class);
        for ($i = 0; $i < 5; $i++) $this->replace($application, $secret, ['KTP' => $this->image()])->assertUnprocessable();
        $this->replace($application, $secret, ['KTP' => $this->image()])->assertTooManyRequests();
    }

    // ---- Retensi ----

    /** @return array<string, Application> */
    private function aged(): array
    {
        $set = [];
        foreach (['old_completed' => ['COMPLETED', 31], 'old_rejected' => ['REJECTED', 40], 'recent_completed' => ['COMPLETED', 29], 'old_processing' => ['PROCESSING', 400]] as $name => [$status, $days]) {
            [$application] = $this->submitted();
            DB::table('applications')->where('id', $application->id)->update(['status' => $status, 'updated_at' => now()->subDays($days)]);
            $set[$name] = $application->fresh();
        }

        return $set;
    }

    private function activeCount(Application $application): int
    {
        return DB::table('application_attachments')->where('application_id', $application->id)->whereNull('purged_at')->count();
    }

    public function test_attachment_purge_dry_run_then_purge_with_default_thirty_days(): void
    {
        $this->assertSame(30, config('retention.attachment_days'));
        $set = $this->aged();
        $files = Storage::disk('local')->allFiles('attachments');
        $this->artisan('attachments:purge', ['--dry-run' => true])->expectsOutputToContain('[dry-run] 6 lampiran dari 2 permohonan akan dihapus')->assertSuccessful();
        $this->assertSame($files, Storage::disk('local')->allFiles('attachments'));
        $this->assertSame(0, DB::table('audit_logs')->count());
        $this->assertSame(0, DB::table('application_attachments')->whereNotNull('purged_at')->count());

        $this->artisan('attachments:purge')->expectsOutputToContain('6 lampiran dari 2 permohonan dihapus.')->assertSuccessful();
        foreach (['old_completed', 'old_rejected'] as $name) {
            $this->assertSame(0, $this->activeCount($set[$name]));
            $this->assertSame([], Storage::disk('local')->allFiles('attachments/'.$set[$name]->id));
            $this->assertSame(0, DB::table('application_attachments')->where('application_id', $set[$name]->id)->whereNotNull('path')->count());
        }
        foreach (['recent_completed', 'old_processing'] as $name) {
            $this->assertSame(3, $this->activeCount($set[$name]));
            $this->assertCount(3, Storage::disk('local')->allFiles('attachments/'.$set[$name]->id));
        }
        $audits = DB::table('audit_logs')->where('action', 'attachment.purged')->get();
        $this->assertCount(6, $audits);
        $this->assertSame(['attachment'], $audits->pluck('subject_type')->unique()->values()->all());
        $this->assertSame([null], $audits->pluck('user_id')->unique()->values()->all());
        // Data permohonan tidak dianonimkan oleh perintah ini; respons publik tidak lagi melaporkan lampiran.
        $this->assertSame('Warga Fiktif', $set['old_completed']->fresh()->nama);
        // Idempoten.
        $this->artisan('attachments:purge')->expectsOutputToContain('0 lampiran dari 0 permohonan dihapus.')->assertSuccessful();
        $this->assertCount(6, DB::table('audit_logs')->where('action', 'attachment.purged')->get());
    }

    public function test_attachment_purge_can_be_disabled_or_rejects_invalid_values(): void
    {
        $this->aged();
        foreach (['0', 0, '', null] as $value) {
            config(['retention.attachment_days' => $value]);
            $this->artisan('attachments:purge')->expectsOutputToContain('Retensi lampiran mati')->assertSuccessful();
        }
        config(['retention.attachment_days' => 'tiga puluh']);
        $this->artisan('attachments:purge')->assertFailed();
        config(['retention.attachment_days' => '-5']);
        $this->artisan('attachments:purge')->assertFailed();
        $this->assertSame(0, DB::table('application_attachments')->whereNotNull('purged_at')->count());
        $this->assertCount(12, Storage::disk('local')->allFiles('attachments'));
        config(['retention.attachment_days' => '60']);
        $this->artisan('attachments:purge')->expectsOutputToContain('0 lampiran dari 0 permohonan dihapus.')->assertSuccessful();
    }

    public function test_application_purge_also_removes_attachments(): void
    {
        config(['retention.attachment_days' => 0, 'retention.application_days' => 365]);
        [$application] = $this->submitted();
        DB::table('applications')->where('id', $application->id)->update(['status' => 'COMPLETED', 'updated_at' => now()->subDays(400)]);
        $this->artisan('applications:purge', ['--dry-run' => true])->expectsOutputToContain('+ 3 lampiran')->assertSuccessful();
        $this->assertSame(3, $this->activeCount($application));
        $this->artisan('applications:purge')->assertSuccessful();
        $this->assertSame(0, $this->activeCount($application));
        $this->assertSame([], Storage::disk('local')->allFiles('attachments'));
        $this->assertSame(3, DB::table('audit_logs')->where('action', 'attachment.purged')->count());
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'application.purged')->count());
    }

    public function test_attachment_purge_rolls_back_rows_when_audit_fails(): void
    {
        config(['retention.application_days' => 365]);
        [$application] = $this->submitted();
        DB::table('applications')->where('id', $application->id)->update(['status' => 'COMPLETED', 'updated_at' => now()->subDays(400)]);
        $this->failInsertsInto('audit_logs');
        try {
            $this->artisan('attachments:purge')->run();
            $this->fail('Purge seharusnya gagal.');
        } catch (QueryException) {
        }
        $this->restoreInsertsInto('audit_logs');
        $this->assertSame(3, $this->activeCount($application));
        $this->assertCount(3, Storage::disk('local')->allFiles('attachments'));
    }
}
