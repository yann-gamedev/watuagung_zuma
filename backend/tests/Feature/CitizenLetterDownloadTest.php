<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\LetterPayloads;
use Tests\TestCase;

/** Alur online: persetujuan merilis PDF, warga mengunduh. Seluruh identitas dan berkas fiktif. */
class CitizenLetterDownloadTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        Storage::fake('local');
        $this->staff = User::factory()->create(['role' => 'staff', 'name' => 'Petugas Fiktif']);
    }

    /** @return array{0: Application, 1: string} */
    private function approved(): array
    {
        $receipt = $this->submitLetter(self::letterPayload())->assertCreated();
        $application = Application::where('request_id', $receipt->json('request_id'))->firstOrFail();
        $head = User::factory()->create(['role' => 'village_head']);
        $application->update(['status' => 'WAITING_APPROVAL']);
        $this->actAs($head);
        $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => 'APPROVED'])
            ->assertOk()->assertJsonPath('status', 'READY_FOR_PICKUP');

        return [$application->fresh(), $receipt->json('lookup_secret')];
    }

    /** @return array{0: Application, 1: string} */
    private function ready(): array
    {
        [$application, $secret] = $this->approved();
        $this->actAs($this->staff);

        return [$application->fresh(), $secret];
    }

    private function actAs(User $user, array $abilities = ['panel', 'applications:manage']): void
    {
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($user, $abilities);
    }

    private function download(Application $application, string $secret)
    {
        $this->app['auth']->forgetGuards();

        return $this->post('/api/v1/applications/letter', ['request_id' => $application->request_id, 'lookup_secret' => $secret], ['Accept' => 'application/json']);
    }

    private function lookup(Application $application, string $secret)
    {
        return $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => $secret]);
    }

    private function letter(Application $application): object
    {
        return DB::table('letters')->where('application_id', $application->id)->first();
    }

    /** @return list<array{from: ?string, to: string, note: ?string, user: ?int}> */
    private function events(Application $application): array
    {
        return DB::table('application_events')->where('application_id', $application->id)->orderBy('id')->get()
            ->map(fn ($e) => ['from' => $e->from_status, 'to' => $e->to_status, 'note' => $e->note === null ? null : Crypt::decryptString($e->note), 'user' => $e->user_id === null ? null : (int) $e->user_id])->all();
    }

    private function lastEvent(Application $application): ?array
    {
        $events = $this->events($application);

        return $events === [] ? null : $events[array_key_last($events)];
    }

    // ---- Unggah scan ----

    public function test_approval_releases_system_pdf_without_upload(): void
    {
        [$application, $secret] = $this->ready();
        $letter = $this->letter($application);
        $this->assertSame('system', $letter->source);
        $this->assertSame($letter->approved_at, $letter->ready_at);
        $this->assertSame(Carbon::parse($letter->ready_at)->addDays(7)->format('Y-m-d H:i:s'), $letter->valid_until);
        $this->assertSame('READY_FOR_PICKUP', $application->status);
        $this->assertSame(['from' => 'WAITING_APPROVAL', 'to' => 'READY_FOR_PICKUP', 'note' => 'Disetujui dan dirilis', 'user' => $letter->approved_by], $this->lastEvent($application));
        $this->lookup($application, $secret)->assertOk()->assertJsonPath('letter_available', true)
            ->assertJsonPath('letter_available_until', Carbon::parse($letter->ready_at)->addDays(7)->toISOString());
        $this->assertStringStartsWith('%PDF-', $this->download($application, $secret)->assertOk()->getContent());
    }

    public function test_replacement_audit_failure_preserves_original_bytes_and_cleans_new_file(): void
    {
        [$application] = $this->ready();
        $first = $this->letter($application);
        $bytes = Storage::disk('local')->get($first->path);
        $files = Storage::disk('local')->allFiles('letters');
        $this->failInsertsInto('audit_logs');
        $this->uploadScan($application->request_id)->assertStatus(500);
        $this->restoreInsertsInto('audit_logs');
        $this->assertSame($first->path, $this->letter($application)->path);
        $this->assertSame($first->sha256, $this->letter($application)->sha256);
        $this->assertSame($bytes, Storage::disk('local')->get($first->path));
        $this->assertEqualsCanonicalizing($files, Storage::disk('local')->allFiles('letters'));
        $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
        $this->assertCount(2, $this->events($application));
    }

    public function test_replacement_preserves_status_release_deadlines_and_history(): void
    {
        [$application, $secret] = $this->ready();
        foreach (['READY_FOR_PICKUP', 'COMPLETED'] as $status) {
            $application->update(['status' => $status]);
            $first = $this->letter($application);
            $events = $this->events($application);
            $this->travel(1)->days();
            $this->actAs($this->staff);
            $this->uploadScan($application->request_id, "%PDF-1.4\n% scan kedua fiktif $status\n%%EOF\n")
                ->assertOk()->assertJsonPath('status', $status)->assertJsonPath('letter.source', 'uploaded');
            $second = $this->letter($application);
            foreach (['ready_at', 'approved_at', 'valid_until', 'verification_code'] as $field) $this->assertSame($first->$field, $second->$field);
            $this->assertNotSame($first->sha256, $second->sha256);
            $this->assertSame($events, $this->events($application));
        }
        $this->assertSame(2, DB::table('audit_logs')->where('action', 'letter.uploaded')->count());
        $this->assertSame("%PDF-1.4\n% scan kedua fiktif COMPLETED\n%%EOF\n", $this->download($application, $secret)->assertOk()->getContent());
    }

    public function test_replacement_validity_boundary_is_inclusive_and_never_extends_deadline(): void
    {
        [$application] = $this->ready();
        $first = $this->letter($application);
        $until = Carbon::parse($first->valid_until);
        $this->travelTo($until);
        $this->uploadScan($application->request_id)->assertOk();
        $replacement = $this->letter($application);
        $this->assertSame($first->ready_at, $replacement->ready_at);
        $this->assertSame($first->valid_until, $replacement->valid_until);
        $this->travelTo($until->copy()->addSecond());
        $this->uploadScan($application->request_id)->assertUnprocessable();
        $this->assertSame($replacement->path, $this->letter($application)->path);
        $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
    }

    public function test_upload_rejected_in_other_statuses_and_for_other_roles(): void
    {
        [$application] = $this->approved();
        $this->actAs($this->staff);
        foreach (['SUBMITTED', 'VERIFIED', 'PROCESSING', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'NEED_REVISION'] as $status) {
            $application->update(['status' => $status]);
            $this->uploadScan($application->request_id)->assertUnprocessable();
            $this->assertSame($status, $application->fresh()->status);
        }
        $application->update(['status' => 'APPROVED']);
        foreach (['village_head', 'rt_head', 'rw_head'] as $role) {
            $this->actAs(User::factory()->create(['role' => $role, 'rt' => '001', 'rw' => '002']));
            $this->assertContains($this->uploadScan($application->request_id)->status(), [401, 403]);
        }
        // KIM: token sebenarnya tanpa ability, lalu token bocor dengan ability pelayanan.
        $kim = User::factory()->create(['role' => 'kim']);
        $this->actAs($kim, ['panel', 'media:manage']);
        $this->uploadScan($application->request_id)->assertForbidden();
        $this->actAs($kim, ['panel', 'applications:manage', 'media:manage', 'site:manage']);
        $this->uploadScan($application->request_id)->assertForbidden();
        $this->assertSame('APPROVED', $application->fresh()->status);
        $this->assertNotNull($this->letter($application)->ready_at);
    }

    public function test_manual_ready_transition_is_gone_and_legacy_approved_is_not_actionable(): void
    {
        [$application] = $this->approved();
        $application->update(['status' => 'APPROVED']); // Legacy queue entry stays non-downloadable.
        foreach (['staff', 'admin'] as $role) {
            $this->actAs(User::factory()->create(['role' => $role]));
            $this->patchJson('/api/v1/staff/applications/'.$application->request_id.'/status', ['status' => 'READY_FOR_PICKUP'])->assertUnprocessable();
            $this->getJson('/api/v1/staff/applications/'.$application->request_id)->assertOk()->assertJsonPath('allowed_transitions', []);
            $this->getJson('/api/v1/staff/summary')->assertOk()->assertJsonPath('my_queue', 0);
            $this->getJson('/api/v1/staff/applications?my_queue=1')->assertOk()->assertJsonPath('total', 0);
        }
        $this->actAs(User::factory()->create(['role' => 'village_head']));
        $this->getJson('/api/v1/staff/summary')->assertOk()->assertJsonPath('my_queue', 0);
        $this->assertSame('APPROVED', $application->fresh()->status);
    }

    // ---- Unduhan warga ----

    public function test_citizen_download_completes_on_first_download_and_allows_repeat(): void
    {
        [$application, $secret] = $this->ready();
        $response = $this->download($application, $secret)->assertOk();
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertSame('attachment; filename="Surat-'.$application->request_id.'.pdf"', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        $this->assertSame('COMPLETED', $application->fresh()->status);
        $this->assertSame(['from' => 'READY_FOR_PICKUP', 'to' => 'COMPLETED', 'note' => 'Surat diunduh pemohon', 'user' => null], $this->lastEvent($application));

        $this->download($application, $secret)->assertOk();
        $this->assertSame('COMPLETED', $application->fresh()->status);
        $this->assertCount(3, $this->events($application)); // SUBMITTED, unggah, unduhan pertama
        $audits = DB::table('audit_logs')->where('action', 'letter.downloaded')->get();
        $this->assertCount(2, $audits);
        foreach ($audits as $audit) {
            $this->assertNull($audit->user_id);
            $this->assertSame('application', $audit->subject_type);
            $this->assertSame($application->id, (int) $audit->subject_id);
        }
        $this->lookup($application, $secret)->assertOk()->assertJsonPath('status', 'COMPLETED')->assertJsonPath('letter_available', true);
    }

    public function test_staff_letter_summary_counts_only_citizen_downloads_for_this_application(): void
    {
        $this->travelTo(now()->startOfSecond());
        [$application, $secret] = $this->ready();
        $detailUrl = '/api/v1/staff/applications/'.$application->request_id;
        $this->getJson($detailUrl)->assertOk()->assertJsonPath('letter.download_count', 0)->assertJsonPath('letter.last_downloaded_at', null);

        $this->download($application, $secret)->assertOk();
        $firstDownload = now()->toISOString();
        $this->actAs($this->staff);
        $this->getJson($detailUrl)->assertOk()->assertJsonPath('letter.download_count', 1)->assertJsonPath('letter.last_downloaded_at', $firstDownload);

        $this->travel(1)->minutes();
        $this->download($application, $secret)->assertOk();
        $lastDownload = now()->toISOString();
        $this->actAs($this->staff);
        $this->getJson($detailUrl)->assertOk()->assertJsonPath('letter.download_count', 2)->assertJsonPath('letter.last_downloaded_at', $lastDownload);

        $this->travel(1)->minutes();
        $this->get('/api/v1/staff/applications/'.$application->request_id.'/letter.pdf')->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'letter.downloaded', 'subject_id' => $application->id, 'user_id' => $this->staff->id]);
        [$other, $otherSecret] = $this->ready();
        $this->download($other, $otherSecret)->assertOk();
        DB::table('audit_logs')->insert([
            ['action' => 'letter.downloaded', 'subject_type' => 'other', 'subject_id' => $application->id, 'user_id' => null, 'created_at' => now()],
            ['action' => 'letter.uploaded', 'subject_type' => 'application', 'subject_id' => $application->id, 'user_id' => null, 'created_at' => now()],
        ]);
        $this->actAs($this->staff);
        $this->getJson($detailUrl)->assertOk()->assertJsonPath('letter.download_count', 2)->assertJsonPath('letter.last_downloaded_at', $lastDownload);
        $this->lookup($application, $secret)->assertOk()->assertJsonMissingPath('download_count')->assertJsonMissingPath('last_downloaded_at')
            ->assertJsonMissingPath('letter.download_count')->assertJsonMissingPath('letter.last_downloaded_at');
    }

    public function test_wrong_code_shares_lockout_with_status_lookup(): void
    {
        [$application, $secret] = $this->ready();
        for ($i = 0; $i < 3; $i++) $this->download($application, 'WAD-0000-0000')->assertNotFound();
        for ($i = 0; $i < 2; $i++) $this->lookup($application, 'WAD-0000-0000')->assertNotFound();
        $this->download($application, $secret)->assertTooManyRequests();
        $this->lookup($application, $secret)->assertTooManyRequests();
        $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'letter.downloaded')->count());
        $this->post('/api/v1/applications/letter', [], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['request_id', 'lookup_secret']);
        $this->travel(16)->minutes();
        $this->download($application, $secret)->assertOk();
    }

    public function test_drafts_generated_pdfs_and_legacy_letters_are_not_downloadable(): void
    {
        [$application, $secret] = $this->approved();
        foreach (['SUBMITTED', 'PROCESSING', 'WAITING_APPROVAL', 'APPROVED', 'NEED_REVISION', 'REJECTED'] as $status) {
            $application->update(['status' => $status]);
            $this->download($application, $secret)->assertNotFound()->assertJsonPath('message', 'Surat belum tersedia untuk diunduh.');
            $this->lookup($application, $secret)->assertOk()->assertJsonPath('letter_available', false)->assertJsonPath('letter_available_until', null);
        }
        // PDF otomatis sistem (bukan scan bertanda tangan), termasuk data lama yang dipindah manual ke READY.
        DB::table('letters')->where('application_id', $application->id)->update(['path' => 'letters/'.$application->id.'-generated.pdf', 'source' => 'generated']);
        Storage::disk('local')->put('letters/'.$application->id.'-generated.pdf', Crypt::encryptString('%PDF-1.4 sistem'));
        foreach (['READY_FOR_PICKUP', 'COMPLETED'] as $status) {
            $application->update(['status' => $status]);
            $this->download($application, $secret)->assertNotFound();
        }
        // Scan lama tanpa ready_at (sebelum fitur ini) tidak otomatis dibuka untuk warga.
        DB::table('letters')->where('application_id', $application->id)->update(['source' => 'uploaded', 'ready_at' => null]);
        $this->download($application, $secret)->assertNotFound();
        $this->assertSame(0, DB::table('audit_logs')->where('action', 'letter.downloaded')->count());
        $this->assertSame('COMPLETED', $application->fresh()->status);
    }

    public static function downloadSources(): array
    {
        return [['system'], ['uploaded']];
    }

    #[DataProvider('downloadSources')]
    public function test_download_window_expires(string $source): void
    {
        [$application, $secret] = $this->ready();
        if ($source === 'uploaded') $this->uploadScan($application->request_id)->assertOk();
        $until = Carbon::parse($this->letter($application)->ready_at)->addDays(7);
        $this->travelTo($until);
        $this->download($application, $secret)->assertOk();
        $this->travelTo($until->copy()->addSecond());
        $this->download($application, $secret)->assertStatus(410)->assertJsonPath('message', 'Masa unduh sudah berakhir. Ajukan ulang bila surat masih diperlukan.');
        $this->lookup($application, $secret)->assertOk()->assertJsonPath('letter_available', false)->assertJsonPath('letter_available_until', $until->toISOString());
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'letter.downloaded')->count());
    }

    public function test_download_days_are_configurable_and_purged_file_is_gone(): void
    {
        config(['letters.download_days' => 7]);
        [$application, $secret] = $this->ready();
        $this->travel(8)->days();
        $this->download($application, $secret)->assertStatus(410);
        $this->travelBack();
        config(['letters.download_days' => 30]);
        DB::table('letters')->where('application_id', $application->id)->update(['path' => null, 'file_purged_at' => now()]);
        $this->download($application, $secret)->assertStatus(410);
        $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
    }

    public function test_audit_failure_withholds_letter_and_keeps_status(): void
    {
        [$application, $secret] = $this->ready();
        $this->failInsertsInto('audit_logs');
        $response = $this->download($application, $secret);
        $this->assertSame(500, $response->status());
        $this->assertStringNotContainsString('scan surat fiktif', $response->getContent());
        $this->restoreInsertsInto('audit_logs');
        $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
    }

    public function test_route_ip_throttle_applies(): void
    {
        [$application, $secret] = $this->ready();
        $this->withMiddleware(ThrottleRequests::class);
        for ($i = 0; $i < 10; $i++) $this->download($application, $secret)->assertOk();
        $this->download($application, $secret)->assertTooManyRequests();
    }

    // ---- Masa unduh berakhir dan retensi ----

    public function test_expire_command_completes_unclaimed_letters_only(): void
    {
        [$old] = $this->ready();
        [$recent] = $this->ready();
        [$downloaded, $secret] = $this->ready();
        $this->download($downloaded, $secret)->assertOk();
        DB::table('letters')->whereIn('application_id', [$old->id, $downloaded->id])->update(['ready_at' => now()->subDays(8)]);
        $this->artisan('letters:expire-downloads', ['--dry-run' => true])->expectsOutputToContain('[dry-run] 1 permohonan akan diselesaikan')->assertSuccessful();
        $this->assertSame('READY_FOR_PICKUP', $old->fresh()->status);

        $this->artisan('letters:expire-downloads')->expectsOutputToContain('1 permohonan diselesaikan')->assertSuccessful();
        $this->assertSame('COMPLETED', $old->fresh()->status);
        $this->assertSame(['from' => 'READY_FOR_PICKUP', 'to' => 'COMPLETED', 'note' => 'Masa unduh berakhir', 'user' => null], $this->lastEvent($old));
        $this->assertSame('READY_FOR_PICKUP', $recent->fresh()->status);
        $this->assertCount(3, $this->events($downloaded));
        // Berkas tidak dihapus; petugas masih bisa mengunduh.
        $this->assertTrue(Storage::disk('local')->exists($this->letter($old)->path));
        $this->artisan('letters:expire-downloads')->expectsOutputToContain('0 permohonan diselesaikan')->assertSuccessful();
        $this->assertContains('letters:expire-downloads', collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())->map(fn ($e) => trim(Str::after($e->command, 'artisan'), " '\""))->all());
    }

    public function test_retention_never_deletes_letter_inside_download_window(): void
    {
        config(['retention.application_days' => 1, 'retention.attachment_days' => 1]);
        [$application, $secret] = $this->ready();
        $this->download($application, $secret)->assertOk();
        // Permohonan sudah lama COMPLETED menurut updated_at, tetapi surat dirilis dua hari lalu.
        DB::table('applications')->where('id', $application->id)->update(['updated_at' => now()->subDays(60)]);
        DB::table('letters')->where('application_id', $application->id)->update(['ready_at' => now()->subDays(2)]);
        $path = $this->letter($application)->path;
        $this->artisan('attachments:purge')->assertSuccessful();
        $this->artisan('applications:purge')->expectsOutputToContain('0 permohonan dianonimkan')->assertSuccessful();
        $this->assertTrue(Storage::disk('local')->exists($path));
        $this->assertNull($application->fresh()->purged_at);
        $this->download($application, $secret)->assertOk();

        DB::table('applications')->where('id', $application->id)->update(['updated_at' => now()->subDays(60)]);
        DB::table('letters')->where('application_id', $application->id)->update(['ready_at' => now()->subDays(8)]);
        $this->artisan('applications:purge')->expectsOutputToContain('1 permohonan dianonimkan')->assertSuccessful();
        $this->assertFalse(Storage::disk('local')->exists($path));
        $this->download($application, $secret)->assertStatus(410);
    }
}
