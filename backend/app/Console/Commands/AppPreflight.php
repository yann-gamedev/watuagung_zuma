<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Pemeriksaan konfigurasi sebelum/sesudah deploy. Hanya membaca: tidak menulis file, database, atau cache.
 * Nilai rahasia (APP_KEY, kata sandi database/SMTP) tidak pernah dicetak, hanya "terisi"/"kosong".
 *
 * Tanpa --production, pemeriksaan khusus produksi (lingkungan, URL https, batas unggah, antrean) dilaporkan
 * sebagai PERINGATAN; kegagalan dasar (APP_KEY, database, migration, folder, GD, admin) tetap GAGAL.
 */
class AppPreflight extends Command
{
    protected $signature = 'app:preflight {--production : Terapkan aturan produksi; GAGAL bila konfigurasi tidak aman}';

    protected $description = 'Periksa konfigurasi server sebelum/sesudah deploy (hanya membaca)';

    /** Tugas harian di routes/console.php yang wajib terjadwal (Hostinger: dipasang langsung sebagai cron). */
    private const SCHEDULED = ['applications:purge', 'attachments:purge', 'letters:expire-downloads', 'media:prune', 'sanctum:prune-expired'];

    /** Lampiran 3 dokumen ≤ 5 MB per file; lihat deploy/hostinger.md § C. */
    private const MIN_UPLOAD = 6 * 1024 * 1024;

    private const MIN_POST = 20 * 1024 * 1024;

    private array $counts = ['OK' => 0, 'PERINGATAN' => 0, 'GAGAL' => 0];

    private bool $production = false;

    public function handle(): int
    {
        $this->production = (bool) $this->option('production');
        $this->line('Pemeriksaan pra-rilis'.($this->production ? ' (mode produksi)' : ' (tanpa --production: aturan produksi hanya PERINGATAN)'));

        $this->checkEnvironment();
        $appHost = $this->checkUrls();
        $this->checkMedia($appHost);
        $databaseOk = $this->checkDatabase();
        $this->checkDirectories();
        $this->checkGd();
        $this->checkPhpLimits();
        $this->checkLetters();
        $this->checkMail($appHost);
        $this->checkQueue($databaseOk);
        if ($databaseOk) $this->checkAccounts();
        $this->checkSchedule();

        $this->newLine();
        $this->line(sprintf('Ringkasan: %d OK, %d PERINGATAN, %d GAGAL.', $this->counts['OK'], $this->counts['PERINGATAN'], $this->counts['GAGAL']));
        if ($this->counts['GAGAL'] > 0) {
            $this->error('Ada pemeriksaan GAGAL. Jangan buka situs ke warga sebelum semuanya diperbaiki.');
            return self::FAILURE;
        }
        return self::SUCCESS;
    }

    private function checkEnvironment(): void
    {
        $env = (string) config('app.env');
        $env === 'production'
            ? $this->ok('APP_ENV production.')
            : $this->prodFailLine("APP_ENV $env, bukan production.");

        config('app.debug')
            ? $this->prodFailLine('APP_DEBUG true: detail galat dan path server terlihat publik.')
            : $this->ok('APP_DEBUG false.');

        // Hanya status, tidak pernah nilainya.
        filled(config('app.key'))
            ? $this->ok('APP_KEY terisi.')
            : $this->failLine('APP_KEY kosong. Pada server lama, pulihkan kunci asli dari password manager; jangan key:generate.');
    }

    /** @return string|null host APP_URL bila valid, untuk pembanding pemeriksaan lain */
    private function checkUrls(): ?string
    {
        $urls = [
            'APP_URL' => (string) config('app.url'),
            'SITE_URL' => (string) config('app.site_url'),
            'LETTER_VERIFY_URL' => (string) config('letters.verify_url'),
        ];
        $origins = (array) config('cors.allowed_origins');
        if ($origins === []) $this->prodFailLine('FRONTEND_ORIGINS kosong.');
        foreach (array_values($origins) as $i => $origin) $urls['FRONTEND_ORIGINS'.(count($origins) > 1 ? '['.($i + 1).']' : '')] = (string) $origin;

        $hosts = [];
        foreach ($urls as $name => $url) {
            if (($problem = $this->urlProblem($url)) !== null) {
                $this->prodFailLine("$name ".$this->safeUrl($url)." $problem.");
                continue;
            }
            $hosts[$name] = $this->host($url);
            $this->ok("$name ".$this->safeUrl($url).'.');
        }

        if (count(array_unique($hosts)) > 1) {
            $list = implode(', ', array_map(fn ($name, $host) => "$name=$host", array_keys($hosts), $hosts));
            $this->prodFailLine("Host URL berbeda satu sama lain ($list); semuanya harus domain yang sama.");
        } elseif (count($hosts) === count($urls)) {
            $this->ok('Semua URL memakai host yang sama ('.reset($hosts).').');
        }

        $verify = $urls['LETTER_VERIFY_URL'];
        str_ends_with((string) parse_url($verify, PHP_URL_PATH), '/verifikasi/')
            ? $this->ok('LETTER_VERIFY_URL berakhiran /verifikasi/.')
            : $this->prodFailLine('LETTER_VERIFY_URL harus berakhiran /verifikasi/ (QR surat menambahkan ?kode=).');

        return $hosts['APP_URL'] ?? null;
    }

    private function checkMedia(?string $appHost): void
    {
        $url = (string) config('filesystems.disks.public.url');
        // env() kosong saat config di-cache; bandingkan dengan bentuk bawaan di config/filesystems.php.
        $source = $url === rtrim((string) config('app.url'), '/').'/storage' ? 'APP_URL/storage (MEDIA_URL kosong)' : 'MEDIA_URL';
        $this->line("      URL efektif disk public: ".$this->safeUrl($url)." dari $source.");
        if (($problem = $this->urlProblem($url)) !== null) {
            $this->prodFailLine("URL media $problem.");
        } elseif ($appHost !== null && $this->host($url) !== $appHost) {
            $this->prodFailLine('URL media tidak sehost dengan APP_URL.');
        } else {
            $this->ok('URL media https dan sehost dengan APP_URL.');
        }

        $root = (string) config('filesystems.disks.public.root');
        is_dir($root) && is_readable($root)
            ? $this->ok('Folder disk public ada dan terbaca (storage/app/public).')
            : $this->failLine('Folder disk public (storage/app/public) tidak ada atau tidak terbaca; media publik tidak tampil.');
        $this->line('      Pastikan public_html/storage (Hostinger) atau alias Nginx /storage/ menunjuk folder itu.');
    }

    private function checkDatabase(): bool
    {
        try {
            DB::connection()->getPdo();
        } catch (Throwable $e) {
            // Pesan driver bisa memuat host/user; cukup kode galat.
            $code = $e instanceof \PDOException || $e instanceof \Illuminate\Database\QueryException ? ' (kode '.$e->getCode().')' : '';
            $this->failLine('Koneksi database gagal'.$code.'. Periksa DB_* di .env.');
            return false;
        }
        $this->ok('Koneksi database ('.DB::connection()->getDriverName().') berhasil.');

        try {
            $migrator = $this->laravel->make('migrator');
            if (! $migrator->repositoryExists()) {
                $this->failLine('Tabel migrations belum ada; jalankan php artisan migrate --force.');
                return true;
            }
            $files = $migrator->getMigrationFiles(array_merge([database_path('migrations')], $migrator->paths()));
            $pending = array_diff(array_keys($files), $migrator->getRepository()->getRan());
            $pending === []
                ? $this->ok('Semua migration sudah dijalankan.')
                : $this->failLine(count($pending).' migration belum dijalankan (mis. '.reset($pending).'); jalankan php artisan migrate --force.');
        } catch (Throwable) {
            $this->failLine('Status migration tidak dapat dibaca.');
        }
        return true;
    }

    private function checkDirectories(): void
    {
        $bad = [];
        foreach (['storage', 'storage/app/private', 'storage/app/public', 'storage/framework/cache', 'storage/framework/views', 'storage/logs', 'bootstrap/cache'] as $dir) {
            $path = base_path($dir);
            if (! is_dir($path) || ! is_writable($path)) $bad[] = $dir;
        }
        $bad === []
            ? $this->ok('Folder storage dan bootstrap/cache dapat ditulis.')
            : $this->failLine('Folder tidak ada/tidak dapat ditulis: '.implode(', ', $bad).'.');
    }

    private function checkGd(): void
    {
        if (! extension_loaded('gd') || ! function_exists('imagecreatefromstring')) {
            $this->failLine('Ekstensi GD tidak terpasang; unggah foto dan lampiran gambar gagal.');
            return;
        }
        $this->ok('Ekstensi GD terpasang.');
        function_exists('imagewebp') && (gd_info()['WebP Support'] ?? false)
            ? $this->ok('GD mendukung WebP.')
            : $this->warnLine('GD tanpa WebP; foto disimpan sebagai JPEG.');
    }

    private function checkPhpLimits(): void
    {
        $read = $this->laravel->bound('preflight.ini') ? $this->laravel->make('preflight.ini') : 'ini_get';
        foreach (['upload_max_filesize' => self::MIN_UPLOAD, 'post_max_size' => self::MIN_POST] as $key => $min) {
            $raw = (string) $read($key);
            $bytes = $this->bytes($raw);
            // post_max_size 0 = tanpa batas.
            $enough = ($key === 'post_max_size' && $bytes === 0) || $bytes >= $min;
            $enough
                ? $this->ok("$key $raw.")
                : $this->prodFailLine("$key $raw, minimal ".($min / 1048576).'M (lampiran 3 dokumen).');
        }
        $this->line('      Batas di atas milik PHP CLI; cek juga PHP web di hPanel → PHP Configuration.');
    }

    private function checkLetters(): void
    {
        foreach (['LETTER_DOWNLOAD_DAYS' => 'letters.download_days', 'LETTER_VALIDITY_DAYS' => 'letters.validity_days'] as $name => $key) {
            $value = (string) config($key);
            $value === '7'
                ? $this->ok("$name 7.")
                : $this->warnLine("$name $value, bukan 7 sesuai keputusan desa.");
        }
        filter_var(config('letters.neighborhood_approval'), FILTER_VALIDATE_BOOLEAN)
            ? $this->warnLine('LETTER_NEIGHBORHOOD_APPROVAL true: persetujuan RT/RW aktif, bukan alur bawaan desa.')
            : $this->ok('LETTER_NEIGHBORHOOD_APPROVAL false.');
    }

    private function checkMail(?string $appHost): void
    {
        $mailer = (string) config('mail.default');
        if (in_array($mailer, ['log', 'array'], true)) {
            $this->production
                ? $this->warnLine("MAIL_MAILER $mailer: email notifikasi tidak terkirim.")
                : $this->ok("MAIL_MAILER $mailer.");
        } else {
            $this->ok("MAIL_MAILER $mailer.");
            if ($mailer === 'smtp') {
                filled(config('mail.mailers.smtp.password'))
                    ? $this->ok('Kata sandi SMTP terisi.')
                    : $this->warnLine('Kata sandi SMTP kosong.');
            }
        }

        $from = (string) config('mail.from.address');
        $domain = strtolower(substr(strrchr($from, '@') ?: '', 1));
        if ($appHost === null) return;
        $domain !== '' && in_array($appHost, [$domain, "www.$domain"], true)
            ? $this->ok("MAIL_FROM_ADDRESS memakai domain $domain.")
            : $this->warnLine('MAIL_FROM_ADDRESS bukan domain APP_URL ('.($domain ?: 'kosong')."); email mudah masuk spam.");
    }

    private function checkQueue(bool $databaseOk): void
    {
        $queue = (string) config('queue.default');
        $queue === 'database'
            ? $this->ok('QUEUE_CONNECTION database.')
            : $this->prodFailLine("QUEUE_CONNECTION $queue, bukan database.");
        if (! $databaseOk) return;

        $jobs = (string) config('queue.connections.database.table', 'jobs');
        Schema::hasTable($jobs)
            ? $this->ok("Tabel $jobs ada.")
            : $this->failLine("Tabel $jobs tidak ada; jalankan migration.");

        $failedTable = (string) config('queue.failed.table', 'failed_jobs');
        if (! Schema::hasTable($failedTable)) {
            $this->warnLine("Tabel $failedTable tidak ada.");
            return;
        }
        $failed = DB::table($failedTable)->count();
        $failed === 0
            ? $this->ok('Tidak ada job gagal.')
            : $this->warnLine("$failed job gagal di $failedTable; periksa log sebelum queue:retry/queue:flush.");
    }

    private function checkAccounts(): void
    {
        try {
            $admins = User::query()->where('role', 'admin')->where('is_active', true)->count();
            $heads = User::query()->where('role', 'village_head')->where('is_active', true)->get();
        } catch (Throwable) {
            $this->failLine('Tabel users tidak dapat dibaca.');
            return;
        }
        $admins > 0
            ? $this->ok("$admins admin aktif.")
            : $this->failLine('Tidak ada admin aktif; buat dengan php artisan staff:create <username> --role=admin.');

        if ($heads->isEmpty()) {
            $this->warnLine('Tidak ada kepala desa aktif; permohonan tidak dapat disetujui.');
            return;
        }
        $notReady = $heads->reject(fn (User $user) => $user->canApproveByEmail())->count();
        $notReady === 0
            ? $this->ok('Kepala desa aktif sudah memverifikasi email dan membuat PIN.')
            : $this->warnLine("$notReady kepala desa aktif belum memverifikasi email/membuat PIN; persetujuan lewat email belum bisa dipakai.");
    }

    private function checkSchedule(): void
    {
        try {
            $commands = array_map(fn ($event) => (string) $event->command, $this->laravel->make(Schedule::class)->events());
        } catch (Throwable) {
            $this->warnLine('Jadwal tidak dapat dibaca.');
            return;
        }
        $missing = array_values(array_filter(self::SCHEDULED,
            fn (string $name) => ! array_filter($commands, fn (string $command) => str_contains($command, $name))));
        $missing === []
            ? $this->ok('Jadwal memuat '.implode(', ', self::SCHEDULED).'.')
            : $this->warnLine('Jadwal tidak memuat: '.implode(', ', $missing).'.');
        $this->line('      Hostinger tidak memakai schedule:run; pastikan tugas yang sama terpasang di hPanel Cron Jobs.');
    }

    private function urlProblem(string $url): ?string
    {
        $parts = parse_url($url);
        if ($url === '' || $parts === false || empty($parts['host'])) return 'kosong atau tidak valid';
        if (strtolower($parts['scheme'] ?? '') !== 'https') return 'bukan https';
        $host = strtolower($parts['host']);
        if (in_array($host, ['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0'], true) || str_ends_with($host, '.localhost')) return 'menunjuk localhost';
        foreach (['<domain>', '[domain]', 'example'] as $placeholder) {
            if (str_contains(strtolower(rawurldecode($url)), $placeholder)) return 'masih berisi placeholder/contoh';
        }
        return null;
    }

    private function host(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_HOST));
    }

    /** URL tanpa user:password bila ada. */
    private function safeUrl(string $url): string
    {
        return $url === '' ? '(kosong)' : (string) preg_replace('#^([a-z][a-z0-9+.-]*://)[^/@]*@#i', '$1', $url);
    }

    private function bytes(string $value): int
    {
        $value = trim($value);
        if ($value === '' || ! preg_match('/^(\d+)\s*([kmg]?)/i', $value, $m)) return 0;
        return (int) $m[1] * match (strtolower($m[2])) { 'g' => 1073741824, 'm' => 1048576, 'k' => 1024, default => 1 };
    }

    private function ok(string $message): void
    {
        $this->counts['OK']++;
        $this->line("<info>[OK]</info>         $message");
    }

    private function warnLine(string $message): void
    {
        $this->counts['PERINGATAN']++;
        $this->line("<comment>[PERINGATAN]</comment> $message");
    }

    /** Selalu GAGAL, juga tanpa --production. */
    private function failLine(string $message): void
    {
        $this->counts['GAGAL']++;
        $this->line("<error>[GAGAL]</error>      $message");
    }

    /** GAGAL dengan --production, PERINGATAN tanpa. */
    private function prodFailLine(string $message): void
    {
        $this->production ? $this->failLine($message) : $this->warnLine($message);
    }
}
