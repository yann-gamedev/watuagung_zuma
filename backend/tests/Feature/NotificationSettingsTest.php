<?php

namespace Tests\Feature;

use App\Mail\NotificationEmailVerificationMail;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** E3: email notifikasi akun dan PIN persetujuan. Akun dan alamat fiktif. */
class NotificationSettingsTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'kata-sandi-fiktif-123';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
        config(['app.site_url' => 'https://desa.example.test']);
        Mail::fake();
    }

    private function actingAsRole(string $role): User
    {
        $user = User::factory()->create(['role' => $role, 'password' => self::PASSWORD, 'name' => 'Akun Fiktif']);
        Sanctum::actingAs($user, $user->abilities());

        return $user;
    }

    /** @return string query bertanda tangan dari email verifikasi terakhir */
    private function verificationQuery(): string
    {
        $mail = Mail::sent(NotificationEmailVerificationMail::class)->last();
        $this->assertStringStartsWith('https://desa.example.test/verifikasi-email/?', $mail->verifyUrl);

        return parse_url($mail->verifyUrl, PHP_URL_QUERY);
    }

    public function test_requires_login(): void
    {
        $this->getJson('/api/v1/staff/me/notifications')->assertUnauthorized();
        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'a@example.test'])->assertUnauthorized();
        $this->putJson('/api/v1/staff/me/notifications/pin', [])->assertUnauthorized();
    }

    public function test_any_panel_role_can_set_and_verify_email(): void
    {
        $user = $this->actingAsRole('staff');
        $this->getJson('/api/v1/staff/me/notifications')->assertOk()->assertExactJson([
            'notification_email' => null, 'notification_email_verified' => false, 'approval_by_email_available' => false,
            'approval_pin_set' => false, 'approval_pin_set_at' => null, 'approval_by_email_active' => false,
        ]);

        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'petugas@example.test'])->assertOk()
            ->assertJsonPath('notification_email', 'petugas@example.test')->assertJsonPath('notification_email_verified', false);
        $raw = DB::table('users')->where('id', $user->id)->value('notification_email');
        $this->assertStringNotContainsString('example.test', $raw);
        $this->assertSame('petugas@example.test', Crypt::decryptString($raw));
        Mail::assertSent(NotificationEmailVerificationMail::class, fn ($mail) => $mail->hasTo('petugas@example.test'));
        $this->assertArrayNotHasKey('notification_email', $user->fresh()->toArray());

        $query = $this->verificationQuery();
        $this->postJson('/api/v1/notifications/verify?'.$query)->assertOk()->assertJsonPath('message', 'Email notifikasi terverifikasi.');
        $this->assertNotNull($user->fresh()->notification_email_verified_at);
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'account.notification_email_verified')->count());
    }

    public function test_verification_link_is_signed_expires_and_dies_when_email_changes(): void
    {
        $user = $this->actingAsRole('village_head');
        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'lama@example.test'])->assertOk();
        $old = $this->verificationQuery();

        parse_str($old, $params);
        $this->postJson('/api/v1/notifications/verify?'.http_build_query(['user' => $params['user'] + 1] + $params))->assertForbidden();
        $this->postJson('/api/v1/notifications/verify?user='.$user->id)->assertForbidden();

        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'baru@example.test'])->assertOk();
        $this->postJson('/api/v1/notifications/verify?'.$old)->assertStatus(410);
        $this->assertNull($user->fresh()->notification_email_verified_at);

        $new = $this->verificationQuery();
        $this->travel(25)->hours();
        $this->postJson('/api/v1/notifications/verify?'.$new)->assertForbidden();
    }

    public function test_email_validation_and_clearing(): void
    {
        $user = $this->actingAsRole('staff');
        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'bukan-email'])->assertUnprocessable()
            ->assertJsonPath('errors.email.0', 'Format email tidak valid. Contoh: nama@contoh.com.');
        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'a@example.test'])->assertOk();
        $this->putJson('/api/v1/staff/me/notifications', ['email' => null])->assertOk()->assertJsonPath('notification_email', null);
        $this->assertNull($user->fresh()->notification_email);
        Mail::assertSent(NotificationEmailVerificationMail::class, 1);
    }

    public function test_pin_is_only_for_village_head_and_requires_account_password(): void
    {
        $this->actingAsRole('admin');
        $this->putJson('/api/v1/staff/me/notifications/pin', ['pin' => '482915', 'pin_confirmation' => '482915', 'password' => self::PASSWORD])
            ->assertForbidden()->assertJsonPath('message', 'PIN persetujuan hanya untuk Kepala Desa.');

        $head = $this->actingAsRole('village_head');
        $cases = [
            [['pin' => '12345', 'pin_confirmation' => '12345'], 'PIN harus 6 digit angka.'],
            [['pin' => '48291a', 'pin_confirmation' => '48291a'], 'PIN harus 6 digit angka.'],
            [['pin' => '482915', 'pin_confirmation' => '482916'], 'Konfirmasi PIN tidak sama.'],
            [['pin' => '111111', 'pin_confirmation' => '111111'], 'PIN terlalu mudah ditebak. Hindari angka sama atau berurutan.'],
            [['pin' => '123456', 'pin_confirmation' => '123456'], 'PIN terlalu mudah ditebak. Hindari angka sama atau berurutan.'],
            [['pin' => '987654', 'pin_confirmation' => '987654'], 'PIN terlalu mudah ditebak. Hindari angka sama atau berurutan.'],
        ];
        foreach ($cases as [$input, $message]) {
            $this->putJson('/api/v1/staff/me/notifications/pin', $input + ['password' => self::PASSWORD])->assertUnprocessable()->assertJsonPath('errors.pin.0', $message);
        }
        $this->putJson('/api/v1/staff/me/notifications/pin', ['pin' => '482915', 'pin_confirmation' => '482915', 'password' => 'salah'])
            ->assertUnprocessable()->assertJsonPath('errors.password.0', 'Kata sandi akun tidak cocok.');
        $this->assertNull($head->fresh()->approval_pin_hash);

        $this->putJson('/api/v1/staff/me/notifications/pin', ['pin' => '482915', 'pin_confirmation' => '482915', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('approval_pin_set', true)->assertJsonPath('approval_by_email_active', false);
        $hash = $head->fresh()->approval_pin_hash;
        $this->assertNotSame('482915', $hash);
        $this->assertTrue(Hash::check('482915', $hash));
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'account.approval_pin_set')->count());

        // Aktif setelah email juga terverifikasi.
        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'kades@example.test'])->assertOk();
        $this->postJson('/api/v1/notifications/verify?'.$this->verificationQuery())->assertOk();
        // Request sungguhan memuat ulang akun; actingAs memakai objek di memori.
        Sanctum::actingAs($head->fresh(), $head->abilities());
        $this->getJson('/api/v1/staff/me/notifications')->assertOk()->assertJsonPath('approval_by_email_active', true)
            ->assertJsonPath('approval_by_email_available', true);
    }

    public function test_changing_email_revokes_open_approval_links(): void
    {
        $head = $this->actingAsRole('village_head');
        $head->forceFill(['notification_email' => 'lama@example.test', 'notification_email_verified_at' => now(), 'approval_pin_hash' => Hash::make('482915')])->save();
        $application = Application::create([
            'request_id' => 'REQ-2026-FIKTIF1', 'jenis_surat' => 'DOMISILI', 'nama' => 'Warga Fiktif', 'nik' => '0000000000001234',
            'no_kk' => '0000000000005678', 'tempat_lahir' => 'Fiktif', 'tanggal_lahir' => '2000-01-01', 'jenis_kelamin' => 'Perempuan',
            'alamat' => 'Alamat fiktif', 'rt' => '1', 'rw' => '2', 'telepon' => '08000000000', 'keperluan' => 'Fiktif',
            'lookup_secret_hash' => 'x', 'status' => 'WAITING_APPROVAL',
        ]);
        DB::table('approval_links')->insert(['application_id' => $application->id, 'user_id' => $head->id, 'token_hash' => hash('sha256', 'fiktif'), 'expires_at' => now()->addDay(), 'created_at' => now()]);

        $this->putJson('/api/v1/staff/me/notifications', ['email' => 'baru@example.test'])->assertOk();

        $this->assertNotNull(DB::table('approval_links')->value('revoked_at'));
        $this->postJson('/api/v1/approvals/preview', ['token' => 'fiktif'])->assertStatus(410);
    }
}
