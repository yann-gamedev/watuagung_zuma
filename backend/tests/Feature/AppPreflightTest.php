<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/** Domain, akun, dan rahasia di sini fiktif. */
class AppPreflightTest extends TestCase
{
    use RefreshDatabase;

    private const APP_KEY = 'base64:UHJlZmxpZ2h0S3VuY2lGaWt0aWZUaWRha0JvbGVoVGFtcGlsPT0=';

    private const DB_PASSWORD = 'sandi-db-fiktif-9f3k';

    private const SMTP_PASSWORD = 'sandi-smtp-fiktif-7q2w';

    private ?string $pendingDir = null;

    protected function setUp(): void
    {
        parent::setUp();
        // Konfigurasi produksi aman; domain fiktif (bukan "example", yang ditolak sebagai placeholder).
        config([
            'app.env' => 'production',
            'app.debug' => false,
            'app.key' => self::APP_KEY,
            'app.url' => 'https://desa-fiktif.test',
            'app.site_url' => 'https://desa-fiktif.test',
            'letters.verify_url' => 'https://desa-fiktif.test/verifikasi/',
            'cors.allowed_origins' => ['https://desa-fiktif.test'],
            'filesystems.disks.public.url' => 'https://desa-fiktif.test/storage',
            'letters.download_days' => 7,
            'letters.validity_days' => 7,
            'letters.neighborhood_approval' => false,
            'mail.default' => 'smtp',
            'mail.mailers.smtp.password' => self::SMTP_PASSWORD,
            'mail.from.address' => 'notifikasi@desa-fiktif.test',
            'queue.default' => 'database',
            'database.connections.'.config('database.default').'.password' => self::DB_PASSWORD,
        ]);
        // Batas PHP lokal (mis. 2M) tidak dapat diubah saat runtime; nilai produksi disuntikkan.
        $this->app->instance('preflight.ini', fn (string $key) => ['upload_max_filesize' => '20M', 'post_max_size' => '20M'][$key]);
        User::factory()->create(['username' => 'admin-fiktif', 'role' => 'admin']);
    }

    protected function tearDown(): void
    {
        if ($this->pendingDir) File::deleteDirectory($this->pendingDir);
        parent::tearDown();
    }

    private function preflight(): array
    {
        $code = Artisan::call('app:preflight', ['--production' => true]);
        return [$code, Artisan::output()];
    }

    public function test_safe_production_configuration_passes(): void
    {
        [$code, $output] = $this->preflight();

        $this->assertSame(0, $code, $output);
        $this->assertStringContainsString('0 GAGAL', $output);
        $this->assertStringContainsString('URL efektif disk public: https://desa-fiktif.test/storage', $output);
        $this->assertStringNotContainsString('[GAGAL]', $output);
    }

    public function test_output_never_contains_secrets(): void
    {
        [, $output] = $this->preflight();
        config(['app.key' => '']);
        [, $failing] = $this->preflight();

        foreach ([$output, $failing] as $text) {
            $this->assertStringNotContainsString(self::APP_KEY, $text);
            $this->assertStringNotContainsString('UHJlZmxpZ2h0', $text);
            $this->assertStringNotContainsString(self::DB_PASSWORD, $text);
            $this->assertStringNotContainsString(self::SMTP_PASSWORD, $text);
        }
        $this->assertStringContainsString('APP_KEY terisi', $output);
        $this->assertStringContainsString('APP_KEY kosong', $failing);
    }

    public function test_debug_true_fails(): void
    {
        config(['app.debug' => true]);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('[GAGAL]      APP_DEBUG true', $output);
    }

    public function test_localhost_url_fails(): void
    {
        config(['app.site_url' => 'http://localhost:3000', 'letters.verify_url' => 'https://127.0.0.1/verifikasi/']);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('SITE_URL http://localhost:3000 bukan https', $output);
        $this->assertStringContainsString('LETTER_VERIFY_URL https://127.0.0.1/verifikasi/ menunjuk localhost', $output);
    }

    public function test_placeholder_domain_fails(): void
    {
        config(['cors.allowed_origins' => ['https://<domain>']]);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('masih berisi placeholder', $output);
    }

    public function test_different_hosts_fail(): void
    {
        config(['cors.allowed_origins' => ['https://lain-fiktif.test']]);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('Host URL berbeda', $output);
    }

    public function test_panel_subdomain_origin_passes(): void
    {
        config(['cors.allowed_origins' => ['https://desa-fiktif.test', 'https://panel.desa-fiktif.test']]);
        [$code, $output] = $this->preflight();

        $this->assertSame(0, $code, $output);
        $this->assertStringContainsString('FRONTEND_ORIGINS[2] https://panel.desa-fiktif.test.', $output);
        $this->assertStringContainsString('atau subdomain langsungnya', $output);
    }

    /** @return array<string, array{string}> */
    public static function foreignOrigins(): array
    {
        return [
            'akhiran domain asing' => ['https://desa-fiktif.test.evil.test'],
            'host asing' => ['https://evil.test'],
            'subdomain dua tingkat' => ['https://a.panel.desa-fiktif.test'],
            'awalan tanpa titik' => ['https://evildesa-fiktif.test'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('foreignOrigins')]
    public function test_foreign_origin_fails(string $origin): void
    {
        config(['cors.allowed_origins' => ['https://desa-fiktif.test', $origin]]);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code, $output);
        $this->assertStringContainsString('Host URL berbeda', $output);
    }

    public function test_panel_origin_must_be_https(): void
    {
        config(['cors.allowed_origins' => ['https://desa-fiktif.test', 'http://panel.desa-fiktif.test']]);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('FRONTEND_ORIGINS[2] http://panel.desa-fiktif.test bukan https', $output);
    }

    public function test_site_url_on_subdomain_still_fails(): void
    {
        config(['app.site_url' => 'https://panel.desa-fiktif.test']);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('Host URL berbeda', $output);
    }

    public function test_media_url_on_other_host_fails(): void
    {
        config(['filesystems.disks.public.url' => 'https://cdn-fiktif.test/media']);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('URL media tidak sehost dengan APP_URL', $output);
    }

    public function test_pending_migration_fails(): void
    {
        $this->pendingDir = storage_path('framework/testing/preflight-'.uniqid());
        File::ensureDirectoryExists($this->pendingDir);
        File::put($this->pendingDir.'/2099_01_01_000000_preflight_pending_fiktif.php',
            "<?php\nuse Illuminate\\Database\\Migrations\\Migration;\nreturn new class extends Migration { public function up(): void {} public function down(): void {} };\n");
        $this->app->make('migrator')->path($this->pendingDir);

        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('1 migration belum dijalankan (mis. 2099_01_01_000000_preflight_pending_fiktif)', $output);
    }

    public function test_low_upload_limit_and_missing_admin_fail(): void
    {
        $this->app->instance('preflight.ini', fn (string $key) => ['upload_max_filesize' => '2M', 'post_max_size' => '8M'][$key]);
        User::query()->update(['is_active' => false]);
        [$code, $output] = $this->preflight();

        $this->assertSame(1, $code);
        $this->assertStringContainsString('upload_max_filesize 2M, minimal 6M', $output);
        $this->assertStringContainsString('post_max_size 8M, minimal 20M', $output);
        $this->assertStringContainsString('Tidak ada admin aktif', $output);
    }

    public function test_warnings_do_not_fail(): void
    {
        config(['letters.download_days' => 30, 'letters.neighborhood_approval' => true, 'mail.default' => 'log', 'mail.from.address' => 'x@lain-fiktif.test']);
        User::factory()->create(['username' => 'kades-fiktif', 'role' => 'village_head']);
        \Illuminate\Support\Facades\DB::table('failed_jobs')->insert(['uuid' => 'uuid-fiktif', 'connection' => 'database', 'queue' => 'default', 'payload' => '{}', 'exception' => 'fiktif', 'failed_at' => now()]);
        [$code, $output] = $this->preflight();

        $this->assertSame(0, $code, $output);
        $this->assertStringContainsString('LETTER_DOWNLOAD_DAYS 30, bukan 7', $output);
        $this->assertStringContainsString('LETTER_NEIGHBORHOOD_APPROVAL true', $output);
        $this->assertStringContainsString('MAIL_MAILER log: email notifikasi tidak terkirim', $output);
        $this->assertStringContainsString('MAIL_FROM_ADDRESS bukan domain APP_URL', $output);
        $this->assertStringContainsString('1 kepala desa aktif belum memverifikasi email/membuat PIN', $output);
        $this->assertStringContainsString('1 job gagal', $output);
    }

    public function test_without_production_flag_production_rules_only_warn(): void
    {
        config(['app.env' => 'local', 'app.debug' => true, 'app.url' => 'http://localhost:8000']);
        $code = Artisan::call('app:preflight');
        $output = Artisan::output();

        $this->assertSame(0, $code, $output);
        $this->assertStringContainsString('[PERINGATAN] APP_DEBUG true', $output);
    }
}
