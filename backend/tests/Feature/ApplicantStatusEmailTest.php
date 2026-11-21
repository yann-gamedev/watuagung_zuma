<?php

namespace Tests\Feature;

use App\Domain\ApplicationStatusChanged;
use App\Listeners\SendApplicantStatusEmail;
use App\Mail\ApplicantStatusMail;
use App\Models\Application;
use App\Models\User;
use Illuminate\Events\CallQueuedListener;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\LetterPayloads;
use Tests\TestCase;

/** E1: email status ke pemohon. Seluruh identitas, alamat email, dan berkas fiktif. */
class ApplicantStatusEmailTest extends TestCase
{
    use RefreshDatabase, LetterPayloads;

    private const EMAIL = 'warga.fiktif@example.test';

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
        $this->head = User::factory()->create(['role' => 'village_head', 'name' => 'Kepala Desa Fiktif']);
    }

    /** @return array{0: Application, 1: string} aplikasi + kode akses */
    private function submit(array $overrides = ['email' => self::EMAIL, 'email_consent' => '1']): array
    {
        $receipt = $this->submitLetter(self::letterPayload('DOMISILI', $overrides))->assertCreated();

        return [Application::where('request_id', $receipt->json('request_id'))->firstOrFail(), $receipt->json('lookup_secret')];
    }

    private function move(Application $application, string $status, User $user, ?string $note = null): void
    {
        Sanctum::actingAs($user, $user->abilities());
        $this->patchJson("/api/v1/staff/applications/{$application->request_id}/status", ['status' => $status, 'catatan' => $note])->assertOk();
    }

    private function toApproved(Application $application): void
    {
        foreach (['VERIFIED', 'PROCESSING', 'WAITING_APPROVAL'] as $status) $this->move($application, $status, $this->staff);
        $this->move($application, 'APPROVED', $this->head);
    }

    /** @return list<string> */
    private function sentSubjects(): array
    {
        return Mail::sent(ApplicantStatusMail::class)->map(fn (ApplicantStatusMail $mail) => $mail->envelope()->subject)->values()->all();
    }

    public function test_staff_transition_scan_upload_and_first_download_all_email_the_applicant(): void
    {
        [$application, $secret] = $this->submit();
        Mail::assertNothingSent();

        $this->toApproved($application);
        Sanctum::actingAs($this->staff, $this->staff->abilities());
        $this->uploadScan($application->request_id)->assertOk();
        $this->postJson('/api/v1/applications/letter', ['request_id' => $application->request_id, 'lookup_secret' => $secret])->assertOk();
        // Unduhan ulang bukan perubahan status.
        $this->postJson('/api/v1/applications/letter', ['request_id' => $application->request_id, 'lookup_secret' => $secret])->assertOk();

        $id = $application->request_id;
        $this->assertSame([
            "Status permohonan $id: Diverifikasi",
            "Status permohonan $id: Diproses",
            "Status permohonan $id: Menunggu persetujuan",
            "Status permohonan $id: Siap diunduh",
            "Status permohonan $id: Selesai",
        ], $this->sentSubjects());
        Mail::assertSent(ApplicantStatusMail::class, fn (ApplicantStatusMail $mail) => $mail->hasTo(self::EMAIL));
        Mail::assertSent(ApplicantStatusMail::class, fn (ApplicantStatusMail $mail) => $mail->statusLabel === 'Siap diunduh'
            && str_contains($mail->statusLine, 'sampai '.now()->addDays(7)->timezone('Asia/Jakarta')->day.' '));
    }

    public function test_expire_downloads_command_emails_the_applicant(): void
    {
        [$application] = $this->submit();
        $this->toApproved($application);
        Sanctum::actingAs($this->staff, $this->staff->abilities());
        $this->uploadScan($application->request_id)->assertOk();
        DB::table('letters')->where('application_id', $application->id)->update(['ready_at' => now()->subDays(8)]);

        $this->artisan('letters:expire-downloads')->assertSuccessful();

        $this->assertSame('COMPLETED', $application->fresh()->status);
        $this->assertSame("Status permohonan {$application->request_id}: Selesai", last($this->sentSubjects()));
    }

    public function test_listener_is_queued_only_when_applicant_can_be_notified(): void
    {
        Queue::fake();
        [$withEmail] = $this->submit();
        [$withoutEmail] = $this->submit([]);

        $this->move($withEmail, 'VERIFIED', $this->staff);
        $this->move($withoutEmail, 'VERIFIED', $this->staff);

        Queue::assertPushed(CallQueuedListener::class, 1);
        Queue::assertPushed(CallQueuedListener::class, function (CallQueuedListener $job) use ($withEmail) {
            $event = $job->data[0];

            // Payload antrean hanya ID dan kode status: tanpa email/catatan polos di tabel jobs.
            return $job->class === SendApplicantStatusEmail::class && $event instanceof ApplicationStatusChanged
                && $event->applicationId === $withEmail->id && $event->toStatus === 'VERIFIED'
                && ! str_contains(serialize($job), self::EMAIL);
        });
    }

    public function test_no_email_without_address_consent_or_after_unsubscribe(): void
    {
        [$none] = $this->submit([]);
        $this->assertNull($none->email);
        $this->assertNull($none->email_consent_at);
        $this->move($none, 'VERIFIED', $this->staff);

        [$unsubscribed] = $this->submit();
        $unsubscribed->forceFill(['email_unsubscribed_at' => now()])->save();
        $this->move($unsubscribed, 'VERIFIED', $this->staff);

        [$noConsent] = $this->submit();
        $noConsent->forceFill(['email_consent_at' => null])->save();
        $this->move($noConsent, 'VERIFIED', $this->staff);

        Mail::assertNothingSent();
    }

    public function test_submission_validates_email_and_requires_consent(): void
    {
        $this->submitLetter(self::letterPayload('DOMISILI', ['email' => self::EMAIL]))
            ->assertUnprocessable()->assertJsonPath('errors.email_consent.0', 'Centang persetujuan menerima email pemberitahuan, atau kosongkan email.');
        $this->submitLetter(self::letterPayload('DOMISILI', ['email' => self::EMAIL, 'email_consent' => '0']))
            ->assertUnprocessable()->assertJsonValidationErrors('email_consent');
        foreach (['bukan-email', str_repeat('a', 110).'@example.test'] as $email) {
            $this->submitLetter(self::letterPayload('DOMISILI', ['email' => $email, 'email_consent' => '1']))
                ->assertUnprocessable()->assertJsonValidationErrors('email');
        }
        // Centang tanpa email diabaikan, bukan galat.
        $receipt = $this->submitLetter(self::letterPayload('DOMISILI', ['email' => '', 'email_consent' => '1']))->assertCreated();
        $this->assertNull(Application::where('request_id', $receipt->json('request_id'))->first()->email_consent_at);
    }

    public function test_email_column_is_encrypted_and_never_returned(): void
    {
        [$application, $secret] = $this->submit();
        $raw = DB::table('applications')->where('id', $application->id)->value('email');
        $this->assertNotSame(self::EMAIL, $raw);
        $this->assertStringNotContainsString('example.test', $raw);
        $this->assertSame(self::EMAIL, Crypt::decryptString($raw));
        $this->assertNotNull($application->email_consent_at);

        $status = $this->postJson('/api/v1/applications/status', ['request_id' => $application->request_id, 'lookup_secret' => $secret])->assertOk();
        $this->assertStringNotContainsString(self::EMAIL, $status->getContent());
        Sanctum::actingAs($this->staff, $this->staff->abilities());
        foreach (["/api/v1/staff/applications/{$application->request_id}", '/api/v1/staff/applications'] as $url) {
            $this->assertStringNotContainsString(self::EMAIL, $this->getJson($url)->assertOk()->getContent());
        }
        $this->assertArrayNotHasKey('email', $application->toArray());
    }

    public function test_email_content_is_minimal_and_carries_note_for_revision(): void
    {
        [$application, $secret] = $this->submit();
        $this->move($application, 'NEED_REVISION', $this->staff, 'Foto KK fiktif buram, unggah ulang.');

        Mail::assertSent(ApplicantStatusMail::class, function (ApplicantStatusMail $mail) use ($application, $secret) {
            $html = $mail->render();
            $mail->assertSeeInHtml('Perlu perbaikan');
            $mail->assertSeeInHtml('Foto KK fiktif buram, unggah ulang.');
            $mail->assertSeeInHtml('Surat keterangan domisili');
            $mail->assertSeeInHtml('Jangan bagikan kode akses Anda', false);
            $mail->assertSeeInHtml('https://desa.example.test/pelayanan/status/?id='.$application->request_id, false);
            $mail->assertSeeInHtml('https://desa.example.test/berhenti-email/?id='.$application->request_id, false);
            foreach (['0000000000001234', '0000000000005678', 'Alamat fiktif', '08000000000', $secret, 'lookup_secret', 'letter.pdf'] as $forbidden) {
                $this->assertStringNotContainsString($forbidden, $html, "Email memuat data terlarang: $forbidden");
            }

            return true;
        });
    }

    public function test_rejected_email_carries_note_and_other_statuses_do_not(): void
    {
        [$application] = $this->submit();
        $this->move($application, 'VERIFIED', $this->staff, 'Catatan internal fiktif');
        $this->move($application, 'REJECTED', $this->staff, 'Persyaratan fiktif tidak lengkap.');

        $mails = Mail::sent(ApplicantStatusMail::class)->values();
        $this->assertNull($mails[0]->note);
        $this->assertSame('Persyaratan fiktif tidak lengkap.', $mails[1]->note);
    }

    public function test_unsubscribe_link_from_email_stops_notifications_and_clears_address(): void
    {
        [$application] = $this->submit();
        $this->move($application, 'VERIFIED', $this->staff);
        $link = Mail::sent(ApplicantStatusMail::class)->first()->unsubscribeUrl;
        $this->assertStringStartsWith('https://desa.example.test/berhenti-email/?', $link);
        $query = parse_url($link, PHP_URL_QUERY);

        // Halaman E2 meneruskan query yang sama ke API.
        $this->postJson('/api/v1/applications/unsubscribe?'.$query)->assertOk()
            ->assertJsonPath('message', 'Anda tidak akan menerima email pemberitahuan lagi untuk permohonan ini.');
        $fresh = $application->fresh();
        $this->assertNull($fresh->email);
        $this->assertNotNull($fresh->email_unsubscribed_at);
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'application.email_unsubscribed')->where('subject_id', $application->id)->count());

        // Idempoten, tidak mencatat audit ganda.
        $this->postJson('/api/v1/applications/unsubscribe?'.$query)->assertOk();
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'application.email_unsubscribed')->count());

        $this->move($application, 'PROCESSING', $this->staff);
        Mail::assertSent(ApplicantStatusMail::class, 1);
    }

    public function test_unsubscribe_rejects_missing_or_tampered_signature(): void
    {
        [$application] = $this->submit();
        [$other] = $this->submit();
        $this->move($application, 'VERIFIED', $this->staff);
        parse_str(parse_url(Mail::sent(ApplicantStatusMail::class)->first()->unsubscribeUrl, PHP_URL_QUERY), $params);

        $this->postJson('/api/v1/applications/unsubscribe?id='.$application->request_id)->assertForbidden()
            ->assertJsonPath('message', 'Tautan berhenti berlangganan tidak valid. Gunakan tautan terbaru dari email.');
        $this->postJson('/api/v1/applications/unsubscribe?'.http_build_query(['id' => $other->request_id, 'signature' => $params['signature']]))->assertForbidden();
        $this->getJson('/api/v1/applications/unsubscribe?'.http_build_query($params))->assertStatus(405);
        $this->assertSame(self::EMAIL, $other->fresh()->email);
        $this->assertSame(self::EMAIL, $application->fresh()->email);
    }

    public function test_retention_purge_clears_email(): void
    {
        [$application] = $this->submit();
        $this->move($application, 'REJECTED', $this->staff, 'Alasan fiktif');
        DB::table('applications')->where('id', $application->id)->update(['updated_at' => now()->subDays(400)]);
        config(['retention.application_days' => '365']);

        $this->artisan('applications:purge')->assertSuccessful();

        $fresh = $application->fresh();
        $this->assertNull($fresh->email);
        $this->assertNull($fresh->email_consent_at);
        $this->assertNull(DB::table('applications')->where('id', $application->id)->value('email'));
    }

    public function test_send_failure_is_logged_masked_and_does_not_affect_status(): void
    {
        [$application] = $this->submit();
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP fiktif mati'));
        Log::spy();

        $this->move($application, 'VERIFIED', $this->staff);

        $this->assertSame('VERIFIED', $application->fresh()->status);
        Log::shouldHaveReceived('warning')->once()->withArgs(function (string $message, array $context) use ($application) {
            return $message === 'Email status pemohon gagal dikirim.'
                && $context['request_id'] === $application->request_id && $context['to_status'] === 'VERIFIED'
                && $context['email'] === 'w•••@example.test' && ! str_contains(json_encode($context), self::EMAIL);
        });
    }

    public function test_rolled_back_transition_sends_nothing(): void
    {
        [$application] = $this->submit();
        // Lompat tahap ditolak 422; tidak ada event.
        Sanctum::actingAs($this->staff, $this->staff->abilities());
        $this->patchJson("/api/v1/staff/applications/{$application->request_id}/status", ['status' => 'APPROVED'])->assertUnprocessable();
        // Gagal menulis riwayat membatalkan transaksi; event after-commit tidak terkirim.
        $this->failInsertsInto('application_events');
        $this->patchJson("/api/v1/staff/applications/{$application->request_id}/status", ['status' => 'VERIFIED'])->assertServerError();
        $this->restoreInsertsInto('application_events');

        $this->assertSame('SUBMITTED', $application->fresh()->status);
        Mail::assertNothingSent();
    }
}
