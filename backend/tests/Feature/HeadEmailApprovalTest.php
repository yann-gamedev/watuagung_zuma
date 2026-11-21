<?php

namespace Tests\Feature;

use App\Listeners\SendHeadApprovalLinks;
use App\Mail\HeadApprovalMail;
use App\Mail\ApplicantStatusMail;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use App\Mail\PinLockedMail;
use App\Models\Application;
use App\Models\User;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\LetterPayloads;
use Tests\TestCase;

/** E3: persetujuan kepala desa lewat email dengan PIN. Semua akun, alamat email, dan data pemohon fiktif. */
class HeadEmailApprovalTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    private const PIN = '482915';

    private User $staff;
    private User $head;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        config(['app.site_url' => 'https://desa.example.test']);
        Mail::fake();
        Storage::fake('local');
        $this->staff = User::factory()->create(['role' => 'staff', 'name' => 'Petugas Fiktif']);
        $this->head = $this->makeHead('kades@example.test');
    }

    private function makeHead(string $email, array $overrides = []): User
    {
        return User::factory()->create(['role' => 'village_head', 'name' => 'Kepala Desa Fiktif'])->forceFill($overrides + [
            'notification_email' => $email, 'notification_email_verified_at' => now(),
            'approval_pin_hash' => Hash::make(self::PIN), 'approval_pin_set_at' => now(),
        ]);
    }

    private function move(Application $application, string $status, User $user, ?string $note = null): void
    {
        Sanctum::actingAs($user, $user->abilities());
        $this->patchJson("/api/v1/staff/applications/{$application->request_id}/status", ['status' => $status, 'catatan' => $note])->assertOk();
    }

    private function waiting(): Application
    {
        $receipt = $this->submitLetter(self::letterPayload())->assertCreated();
        $application = Application::where('request_id', $receipt->json('request_id'))->firstOrFail();
        foreach (['VERIFIED', 'PROCESSING', 'WAITING_APPROVAL'] as $status) $this->move($application, $status, $this->staff);

        return $application->fresh();
    }

    private function tokenFor(Application $application, ?User $head = null): string
    {
        $head ??= $this->head;
        $mail = Mail::sent(HeadApprovalMail::class)->filter(fn (HeadApprovalMail $m) => $m->requestId === $application->request_id && $m->hasTo($head->notification_email))->last();
        $this->assertNotNull($mail, 'Email persetujuan tidak terkirim.');
        parse_str(parse_url($mail->reviewUrl, PHP_URL_QUERY), $query);

        return $query['t'];
    }

    private function decide(string $token, string $decision = 'approve', string $pin = self::PIN, ?string $note = null)
    {
        return $this->postJson('/api/v1/approvals/decide', array_filter(compact('token', 'pin', 'decision', 'note'), fn ($v) => $v !== null));
    }

    public function test_waiting_approval_emails_only_eligible_heads_with_review_links(): void
    {
        $unverified = $this->makeHead('belum@example.test', ['notification_email_verified_at' => null]);
        $noPin = $this->makeHead('tanpapin@example.test', ['approval_pin_hash' => null]);
        $inactive = $this->makeHead('nonaktif@example.test', ['is_active' => false]);
        $admin = User::factory()->create(['role' => 'admin'])->forceFill(['notification_email' => 'admin@example.test', 'notification_email_verified_at' => now(), 'approval_pin_hash' => Hash::make(self::PIN)]);
        $admin->save();
        foreach ([$this->head, $unverified, $noPin, $inactive] as $user) $user->save();

        $application = $this->waiting();

        Mail::assertSent(HeadApprovalMail::class, 1);
        $mail = Mail::sent(HeadApprovalMail::class)->first();
        $this->assertTrue($mail->hasTo('kades@example.test'));
        $this->assertSame("Perlu persetujuan: Surat keterangan domisili — {$application->request_id}", $mail->envelope()->subject);
        $token = $this->tokenFor($application);
        $this->assertSame('https://desa.example.test/persetujuan/?t='.$token, $mail->reviewUrl);
        $this->assertSame($mail->reviewUrl.'&pilih=setuju', $mail->approveUrl);
        $this->assertSame($mail->reviewUrl.'&pilih=tolak', $mail->rejectUrl);
        $this->assertSame('Petugas Fiktif', $mail->verifierName);
        $html = $mail->render();
        foreach (['0000000000001234', '0000000000005678', 'Alamat fiktif', '08000000000'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $html);
        }
        $this->assertStringContainsString('Warga Fiktif', $html);
        $this->assertStringContainsString('surat ber-QR langsung dirilis', $html);
        $this->assertStringNotContainsString('tanda tangan basah', $html);

        // Hanya hash yang tersimpan.
        $link = DB::table('approval_links')->sole();
        $this->assertSame(hash('sha256', $token), $link->token_hash);
        $this->assertSame($this->head->id, $link->user_id);
        $this->assertSame(0, DB::table('approval_links')->where('token_hash', $token)->count());
        $this->assertStringNotContainsString($token, json_encode(DB::table('approval_links')->get()).json_encode(DB::table('audit_logs')->get()));
    }

    public function test_queued_listener_payload_never_holds_a_token(): void
    {
        $this->head->save();
        Queue::fake();
        $receipt = $this->submitLetter(self::letterPayload())->assertCreated();
        $application = Application::where('request_id', $receipt->json('request_id'))->firstOrFail();
        foreach (['VERIFIED', 'PROCESSING', 'WAITING_APPROVAL'] as $status) $this->move($application, $status, $this->staff);

        Queue::assertPushed(CallQueuedListener::class, fn (CallQueuedListener $job) => $job->class === SendHeadApprovalLinks::class);
        // Token baru dibuat saat job berjalan.
        $this->assertSame(0, DB::table('approval_links')->count());
    }

    public function test_no_link_when_no_head_is_eligible(): void
    {
        $this->head->forceFill(['approval_pin_hash' => null])->save();
        $this->waiting();
        Mail::assertNotSent(HeadApprovalMail::class);
        $this->assertSame(0, DB::table('approval_links')->count());
    }

    public function test_scanners_and_preview_never_change_status(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);

        // Pemindai tautan memakai GET: tidak ada rute GET.
        foreach (['preview', 'decide', 'draft'] as $path) $this->get("/api/v1/approvals/$path?token=$token")->assertStatus(405);
        $preview = $this->postJson('/api/v1/approvals/preview', ['token' => $token])->assertOk()
            ->assertJsonPath('request_id', $application->request_id)->assertJsonPath('nama', 'Warga Fiktif')
            ->assertJsonPath('verified_by', 'Petugas Fiktif')->assertJsonPath('pin_attempts_left', 5)
            ->assertJsonPath('jenis_surat_label', 'Surat keterangan domisili');
        $this->assertStringNotContainsString('0000000000001234', $preview->getContent());
        $this->assertNotNull($preview->json('letter_number'));
        $draft = $this->postJson('/api/v1/approvals/draft', ['token' => $token])->assertOk();
        $this->assertSame('application/pdf', $draft->headers->get('Content-Type'));
        $this->assertStringContainsString('no-store', $draft->headers->get('Cache-Control'));

        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertNull(DB::table('approval_links')->value('used_at'));
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'letter.draft_viewed')->where('user_id', $this->head->id)->count());
    }

    public function test_approval_by_email_matches_panel_approval(): void
    {
        $this->head->save();
        $byPanel = $this->waiting();
        $byEmail = $this->waiting();
        $this->move($byPanel, 'APPROVED', $this->head);

        $response = $this->decide($this->tokenFor($byEmail))->assertOk()
            ->assertJsonPath('status', 'READY_FOR_PICKUP')->assertJsonPath('message', 'Permohonan disetujui.');

        foreach ([$byPanel, $byEmail] as $application) {
            $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
            $letter = DB::table('letters')->where('application_id', $application->id)->sole();
            $this->assertSame($this->head->id, $letter->approved_by);
            $this->assertNotNull($letter->path, 'PDF final dibuat sama seperti panel.');
            $this->assertSame('system', $letter->source);
            $this->assertSame($letter->approved_at, $letter->ready_at);
            $this->assertSame(now()->parse($letter->ready_at)->addDays(7)->format('Y-m-d H:i:s'), $letter->valid_until);
            $this->assertStringStartsWith('%PDF-', Crypt::decryptString(Storage::disk('local')->get($letter->path)));
            $this->assertSame('issued', DB::table('letter_numbers')->where('application_id', $application->id)->value('status'));
        }
        $this->assertSame(DB::table('letter_numbers')->where('application_id', $byEmail->id)->value('number'), $response->json('letter_number'));
        $panelEvent = DB::table('application_events')->where('application_id', $byPanel->id)->where('to_status', 'READY_FOR_PICKUP')->sole();
        $emailEvent = DB::table('application_events')->where('application_id', $byEmail->id)->where('to_status', 'READY_FOR_PICKUP')->sole();
        $this->assertNull($panelEvent->via);
        $this->assertSame('email', $emailEvent->via);
        $this->assertSame($this->head->id, $emailEvent->user_id);
        $this->assertNotNull(DB::table('approval_links')->where('application_id', $byEmail->id)->value('used_at'));
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'application.approved_via_email')->count());

        // Riwayat panel menampilkan asalnya.
        Sanctum::actingAs($this->staff, $this->staff->abilities());
        $history = collect($this->getJson("/api/v1/staff/applications/{$byEmail->request_id}")->assertOk()->json('history'));
        $this->assertSame('email', $history->firstWhere('to_status', 'READY_FOR_PICKUP')['via']);
    }

    public function test_email_approval_sends_one_final_applicant_email_and_replacement_sends_none(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $application->forceFill(['email' => 'warga@example.test', 'email_consent_at' => now()])->save();
        $this->decide($this->tokenFor($application), note: 'Catatan email fiktif')->assertOk()->assertJsonPath('status', 'READY_FOR_PICKUP');
        Mail::assertSent(ApplicantStatusMail::class, 1);
        Mail::assertSent(ApplicantStatusMail::class, fn ($mail) => $mail->statusLabel === 'Siap diunduh');
        $event = DB::table('application_events')->where('application_id', $application->id)->where('to_status', 'READY_FOR_PICKUP')->sole();
        $this->assertSame('Disetujui dan dirilis: Catatan email fiktif', Crypt::decryptString($event->note));
        Sanctum::actingAs($this->staff, $this->staff->abilities());
        $this->uploadScan($application->request_id)->assertOk();
        Mail::assertSent(ApplicantStatusMail::class, 1);
    }

    public function test_email_inner_transition_failure_rolls_back_release_and_cleans_file(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);
        $this->failInsertsInto('application_events');
        $this->decide($token)->assertServerError();
        $this->restoreInsertsInto('application_events');
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertDatabaseCount('letters', 0);
        $this->assertNull(DB::table('approval_links')->value('used_at'));
        $this->assertSame([], Storage::disk('local')->allFiles('letters'));
        Mail::assertNotSent(ApplicantStatusMail::class);
    }

    public function test_email_outer_transaction_failure_rolls_back_release_and_cleans_file(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);
        $application->forceFill(['email' => 'warga@example.test', 'email_consent_at' => now()])->save();
        $this->failInsertsInto('audit_logs');
        $this->decide($token)->assertServerError();
        $this->restoreInsertsInto('audit_logs');
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertDatabaseCount('letters', 0);
        $this->assertNull(DB::table('approval_links')->value('used_at'));
        $this->assertSame(0, DB::table('application_events')->where('to_status', 'READY_FOR_PICKUP')->count());
        $this->assertSame([], Storage::disk('local')->allFiles('letters'));
        Mail::assertNotSent(ApplicantStatusMail::class);
    }

    public function test_reject_requires_reason_and_voids_letter_number(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);

        $this->decide($token, 'reject')->assertUnprocessable()->assertJsonPath('errors.note.0', 'Alasan penolakan wajib diisi.');
        $this->assertSame(0, DB::table('approval_links')->value('failed_pin_attempts'));
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);

        $this->decide($token, 'reject', note: 'Syarat fiktif belum lengkap.')->assertOk()->assertJsonPath('status', 'REJECTED')->assertJsonPath('letter_number', null);
        $this->assertSame('REJECTED', $application->fresh()->status);
        $this->assertSame('void', DB::table('letter_numbers')->where('application_id', $application->id)->value('status'));
        $this->assertSame('email', DB::table('application_events')->where('to_status', 'REJECTED')->value('via'));
    }

    public function test_wrong_pin_counts_down_then_locks_link_and_warns_head(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);

        foreach ([4, 3, 2, 1] as $left) {
            $this->decide($token, pin: '000001')->assertUnprocessable()->assertJsonPath('pin_attempts_left', $left)
                ->assertJsonPath('message', "PIN salah. Sisa $left percobaan.");
        }
        $this->decide($token, pin: '000001')->assertStatus(423)->assertJsonPath('pin_attempts_left', 0);
        Mail::assertSent(PinLockedMail::class, fn (PinLockedMail $mail) => $mail->hasTo('kades@example.test') && $mail->requestId === $application->request_id);
        $this->assertNotNull(DB::table('approval_links')->value('locked_at'));

        $this->decide($token)->assertStatus(410);
        $this->postJson('/api/v1/approvals/preview', ['token' => $token])->assertStatus(410);
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertSame(4, DB::table('audit_logs')->where('action', 'approval_link.pin_failed')->count());
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'approval_link.locked')->count());
    }

    public function test_link_is_single_use_and_expires(): void
    {
        $this->head->save();
        $used = $this->waiting();
        $token = $this->tokenFor($used);
        $this->decide($token)->assertOk();
        $this->decide($token)->assertStatus(410)->assertJsonPath('message', 'Tautan sudah tidak berlaku. Buka panel admin untuk memutuskan permohonan ini.');

        $expired = $this->waiting();
        $old = $this->tokenFor($expired);
        $this->travel(72)->hours();
        $this->postJson('/api/v1/approvals/preview', ['token' => $old])->assertStatus(410);
        $this->decide($old)->assertStatus(410);
        $this->assertSame('WAITING_APPROVAL', $expired->fresh()->status);

        $this->postJson('/api/v1/approvals/preview', ['token' => 'tidak-dikenal'])->assertStatus(410);
        $this->postJson('/api/v1/approvals/preview', [])->assertUnprocessable();
    }

    public function test_status_change_in_panel_kills_link_and_reentry_issues_new_one(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $old = $this->tokenFor($application);

        $this->move($application, 'NEED_REVISION', $this->head, 'Perbaiki data fiktif.');
        $this->assertNotNull(DB::table('approval_links')->value('revoked_at'));
        $this->postJson('/api/v1/approvals/preview', ['token' => $old])->assertStatus(410);

        foreach (['VERIFIED', 'PROCESSING', 'WAITING_APPROVAL'] as $status) $this->move($application, $status, $this->staff);
        $new = $this->tokenFor($application);
        $this->assertNotSame($old, $new);
        $this->decide($old)->assertStatus(410);
        $this->decide($new)->assertOk();
    }

    public function test_link_dies_when_head_loses_eligibility(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);

        $this->head->forceFill(['is_active' => false])->save();
        $this->decide($token)->assertStatus(410);
        $this->head->forceFill(['is_active' => true, 'notification_email_verified_at' => null])->save();
        $this->decide($token)->assertStatus(410);
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
    }

    public function test_link_throttle_limits_guessing_per_link(): void
    {
        $this->head->save();
        $application = $this->waiting();
        $token = $this->tokenFor($application);
        $this->withMiddleware(ThrottleRequests::class);
        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.40']);
        for ($i = 0; $i < 10; $i++) $this->postJson('/api/v1/approvals/preview', ['token' => $token])->assertOk();
        $this->postJson('/api/v1/approvals/preview', ['token' => $token])->assertStatus(429);
    }
}
