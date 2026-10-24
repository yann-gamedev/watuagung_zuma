<?php

// Standalone PostgreSQL check, deliberately outside PHPUnit's Unit/Feature suites.
use App\Domain\LetterType;
use App\Http\Controllers\Api\StaffController;
use App\Models\Application;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

require dirname(__DIR__, 2).'/vendor/autoload.php';

function check(bool $condition, string $message): void
{
    if (! $condition) {
        // Only caller-supplied diagnostics, never SQL bindings, credentials or applicant data.
        fwrite(STDERR, "FAIL: {$message}\n");
        throw new RuntimeException('Check failed');
    }
}

$children = [];
$schemaCreated = false;
$exit = 0;
$phase = 'bootstrap';
$started = microtime(true);
$worker = $argv[1] ?? null;

try {
    check($worker === null || ($worker === '--worker' && count($argv) === 4), 'Usage: php tests/Concurrency/letter-number.php');
    $schema = $worker ? $argv[2] : 'concurrency_'.bin2hex(random_bytes(8));
    check((bool) preg_match('/\Aconcurrency_[a-f0-9]{16}\z/', $schema), 'Invalid test schema');
    $index = $worker ? filter_var($argv[3], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 30]]) : null;
    check(! $worker || $index !== false, 'Invalid worker index');

    $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
    check(! $app->configurationIsCached(), 'Clear cached configuration first');
    check(is_file($app->basePath('.env.testing.pgsql')), 'Prepare .env.testing.pgsql first');
    $app->loadEnvironmentFrom('.env.testing.pgsql');
    $kernel = $app->make(Kernel::class);
    $kernel->bootstrap();
    config(['app.debug' => false, 'logging.default' => 'null']);
    check($app->environment('testing'), 'APP_ENV must be testing');
    check(config('database.default') === 'pgsql', 'PostgreSQL is required');
    check(filled(config('app.key')), 'Inherit the existing local APP_KEY; do not generate one');
    check(function_exists('proc_open'), 'proc_open must be enabled');
    check(in_array(config('database.connections.pgsql.host'), ['localhost', '127.0.0.1', '::1'], true)
        && config('database.connections.pgsql.database') === 'watuagung_test'
        && empty(config('database.connections.pgsql.url')), 'Only local watuagung_test without DB_URL is allowed');

    // No public fallback: migrations and workers can only see this run's schema.
    config(['database.connections.pgsql.search_path' => $schema]);
    DB::purge();
    check(DB::selectOne('select current_database() as name')->name === 'watuagung_test', 'Unexpected database');
    DB::statement("SET statement_timeout = '60s'");
    DB::statement("SET lock_timeout = '60s'");
    // Fixed fictional date keeps every worker in the same year, even across midnight/New Year.
    Carbon::setTestNow(Carbon::parse('2026-10-24 12:00:00', 'Asia/Jakarta'));

    if ($worker) {
        $phase = 'worker transition';
        $application = Application::where('request_id', 'REQ-2026-CONCURRENT'.$index)->firstOrFail();
        $user = User::where('username', 'concurrent-'.$index)->firstOrFail();
        $request = Request::create('/concurrency-check', 'PATCH', ['status' => 'WAITING_APPROVAL']);
        $request->setUserResolver(fn () => $user);
        // Call the real status transaction; do not duplicate or wrap its numbering logic.
        $response = $app->make(StaffController::class)->update($request, $application);
        check($response->getStatusCode() === 200 && $response->getData()->status === 'WAITING_APPROVAL', 'Worker transition must succeed');
    } else {
        $phase = 'isolated schema and fixtures';
        $version = DB::selectOne('show server_version')->server_version;
        DB::statement('CREATE SCHEMA "'.$schema.'"');
        $schemaCreated = true;
        check($kernel->call('migrate', ['--force' => true]) === 0, 'Schema migrations must succeed');
        check(DB::selectOne('select current_schema() as name')->name === $schema, 'Schema isolation must hold');
        foreach (range(1, 30) as $i) {
            User::create([
                'name' => 'Petugas Fiktif '.$i, 'username' => 'concurrent-'.$i,
                'password' => bin2hex(random_bytes(16)), 'role' => 'staff',
            ]);
            Application::create([
                'request_id' => 'REQ-2026-CONCURRENT'.$i,
                'lookup_secret_hash' => hash('sha256', 'kode-fiktif'),
                'jenis_surat' => LetterType::cases()[($i - 1) % 4]->value, 'nama' => 'Pemohon Fiktif',
                'nik' => '0000000000000001', 'no_kk' => '0000000000000002',
                'tempat_lahir' => 'Tempat Fiktif', 'tanggal_lahir' => '2000-01-02',
                'jenis_kelamin' => 'Perempuan', 'alamat' => 'Alamat fiktif',
                'rt' => '001', 'rw' => '002', 'telepon' => '08000000000',
                'keperluan' => 'Uji konkurensi fiktif', 'status' => 'PROCESSING',
            ]);
        }
        check(Application::where('status', 'PROCESSING')->count() === 30, 'Exactly 30 PROCESSING fixtures');
        check(DB::table('letter_number_counters')->count() === 0, 'Counter must initially be absent');

        $phase = 'parallel barrier';
        // Hold only the counter table, not application rows. All 30 real transactions must
        // reach their first counter write before releasing them to race on an absent counter.
        DB::beginTransaction();
        DB::statement('LOCK TABLE letter_number_counters IN ACCESS EXCLUSIVE MODE');
        foreach (range(1, 30) as $i) {
            $process = new Process([PHP_BINARY, __FILE__, '--worker', $schema, (string) $i], $app->basePath());
            $process->setTimeout(90);
            $process->start();
            $children[] = $process;
        }
        $pids = array_map(fn (Process $process) => $process->getPid(), $children);
        check(count(array_unique($pids)) === 30 && ! in_array(null, $pids, true), '30 distinct PHP child processes');
        $deadline = microtime(true) + 45;
        do {
            foreach ($children as $process) {
                check($process->isRunning(), 'No worker may exit before the barrier releases');
            }
            $blocked = (int) DB::selectOne(
                'select count(distinct pid) as total from pg_locks where relation = ?::regclass and not granted',
                [$schema.'.letter_number_counters'],
            )->total;
            if ($blocked === 30) {
                break;
            }
            usleep(20000);
        } while (microtime(true) < $deadline);
        check($blocked === 30, 'All 30 PostgreSQL sessions must contend on the counter table within 45s');
        DB::commit();
        echo "PostgreSQL {$version}: 30 PHP processes, 30 blocked database sessions released together\n";

        $phase = 'worker completion';
        foreach ($children as $i => $process) {
            check($process->wait() === 0, 'Worker '.($i + 1).' failed (output withheld to protect sensitive data)');
        }

        $phase = 'numbering assertions';
        $numbers = DB::table('letter_numbers')->orderBy('sequence')->get();
        check($numbers->count() === 30 && $numbers->pluck('number')->unique()->count() === 30, 'Exactly 30 unique numbers');
        check($numbers->pluck('sequence')->map(fn ($value) => (int) $value)->all() === range(1, 30), 'Sequence must be 1..30 without gaps');
        check($numbers->pluck('year')->unique()->map(fn ($value) => (int) $value)->values()->all() === [2026], 'All numbers must belong to the test year');
        check($numbers->pluck('application_id')->unique()->count() === 30 && $numbers->every(fn ($row) => $row->status === 'issued'), 'One issued number per application');
        check(DB::table('letter_number_counters')->count() === 1
            && (int) DB::table('letter_number_counters')->where('year', 2026)->value('sequence') === 30, 'One counter for the year, ending at 30');
        check(Application::where('status', 'WAITING_APPROVAL')->count() === 30, 'All 30 transitions must persist');
        $events = DB::table('application_events')->get();
        check($events->count() === 30 && $events->pluck('application_id')->unique()->count() === 30
            && $events->pluck('user_id')->unique()->count() === 30
            && $events->every(fn ($event) => $event->from_status === 'PROCESSING' && $event->to_status === 'WAITING_APPROVAL'), 'All 30 staff transitions must have an event');
        check(DB::table('letter_numbers as numbers')->join('application_events as events', 'events.application_id', '=', 'numbers.application_id')
            ->whereColumn('numbers.issued_by', 'events.user_id')->count() === 30, 'Issuers must match event actors');
    }
} catch (Throwable $e) {
    // Exception messages/traces may contain SQL values or environment secrets.
    fwrite(STDERR, 'FAIL during '.$phase.': '.get_class($e).' (code '.$e->getCode().")\n");
    $exit = 1;
} finally {
    try {
        foreach ($children as $process) {
            if ($process->isRunning()) {
                $process->stop(0);
            }
        }
        if ($schemaCreated) {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            DB::statement('DROP SCHEMA "'.$schema.'" CASCADE');
            echo "Temporary test schema removed; public schema untouched\n";
        }
    } catch (Throwable $e) {
        fwrite(STDERR, 'FAIL: cleanup '.get_class($e).'; inspect temporary schema '.$schema." manually\n");
        $exit = 1;
    }
}

if (! $worker && $exit === 0) {
    printf("PASS: 30 unique numbers; sequence 1..30; one 2026 counter = 30; 30 transitions/events (%.2fs)\n", microtime(true) - $started);
}
exit($exit);
