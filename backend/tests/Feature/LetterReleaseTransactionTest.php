<?php

namespace Tests\Feature;

use App\Domain\ApplicationTransition;
use App\Models\Application;
use App\Models\User;
use Illuminate\Database\Events\TransactionBeginning;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use PDOException;
use Tests\LetterPayloads;
use Tests\TestCase;

class LetterReleaseTransactionTest extends TestCase
{
    use DatabaseMigrations, LetterPayloads;

    public function test_real_outer_transaction_rollback_removes_nested_release_file(): void
    {
        Storage::fake('local');
        Mail::fake();
        $application = Application::create(self::letterPayload('DOMISILI') + [
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'kode-fiktif'), 'status' => 'WAITING_APPROVAL',
            'email' => 'warga@example.test', 'email_consent_at' => now(),
        ]);
        $head = User::factory()->create(['role' => 'village_head']);
        $this->assertSame(0, DB::transactionLevel());
        try {
            DB::transaction(function () use ($application, $head) {
                ApplicationTransition::apply($application, 'APPROVED', $head, null, 'email');
                $this->assertCount(1, Storage::disk('local')->allFiles('letters'));
                throw new \RuntimeException('Outer transaction fiktif gagal');
            });
            $this->fail('Outer transaction must fail.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Outer transaction fiktif gagal', $error->getMessage());
        }
        $this->assertSame(0, DB::transactionLevel());
        $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
        $this->assertDatabaseCount('letters', 0);
        $this->assertDatabaseCount('application_events', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('letters'));
        Mail::assertNothingSent();
    }

    public function test_root_commit_failure_rolls_back_and_removes_release_file(): void
    {
        Storage::fake('local');
        Mail::fake();
        $application = Application::create(self::letterPayload('DOMISILI') + [
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'kode-fiktif'), 'status' => 'WAITING_APPROVAL',
            'email' => 'warga@example.test', 'email_consent_at' => now(),
        ]);
        $head = User::factory()->create(['role' => 'village_head']);
        $connection = DB::connection();
        $pdo = $connection->getPdo();
        // Proxy every operation to the real driver except COMMIT: Laravel must handle that failure itself.
        $proxy = Mockery::mock($pdo);
        $proxy->shouldReceive('commit')->once()->andReturnUsing(function () use ($pdo) {
            $this->assertTrue($pdo->inTransaction());
            $this->assertCount(1, Storage::disk('local')->allFiles('letters'));
            throw new PDOException('Commit fiktif gagal');
        });
        $this->assertSame(0, $connection->transactionLevel());
        $connection->setPdo($proxy);
        $written = [];
        try {
            try {
                ApplicationTransition::apply($application, 'APPROVED', $head, null, 'email', $written);
                $this->fail('Root commit must fail.');
            } catch (PDOException $error) {
                $this->assertSame('Commit fiktif gagal', $error->getMessage());
            }
            $this->assertCount(1, $written);
            $this->assertSame(0, $connection->transactionLevel());
            $this->assertFalse($pdo->inTransaction());
            $this->assertSame('WAITING_APPROVAL', $application->fresh()->status);
            $this->assertDatabaseCount('letters', 0);
            $this->assertDatabaseCount('application_events', 0);
            Storage::disk('local')->assertMissing($written[0]);
            Mail::assertNothingSent();
        } finally {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $connection->setPdo($pdo);
        }
    }

    public function test_after_commit_exception_preserves_committed_release_file(): void
    {
        Storage::fake('local');
        Mail::fake();
        $application = Application::create(self::letterPayload('DOMISILI') + [
            'request_id' => 'REQ-2026-'.Str::upper((string) Str::ulid()),
            'lookup_secret_hash' => hash('sha256', 'kode-fiktif'), 'status' => 'WAITING_APPROVAL',
            'email' => 'warga@example.test', 'email_consent_at' => now(),
        ]);
        $head = User::factory()->create(['role' => 'village_head']);
        $this->assertSame(0, DB::transactionLevel());
        $registered = false;
        Event::listen(TransactionBeginning::class, function (TransactionBeginning $event) use (&$registered) {
            if (! $registered && $event->connection->transactionLevel() === 1) {
                $registered = true;
                $event->connection->afterCommit(function () {
                    $this->assertFalse(DB::getPdo()->inTransaction());
                    throw new \RuntimeException('After commit fiktif gagal');
                });
            }
        });
        $written = [];
        try {
            ApplicationTransition::apply($application, 'APPROVED', $head, null, 'email', $written);
            $this->fail('After commit callback must fail.');
        } catch (\RuntimeException $error) {
            $this->assertSame('After commit fiktif gagal', $error->getMessage());
        }
        $this->assertSame(0, DB::transactionLevel());
        $this->assertFalse(DB::getPdo()->inTransaction());
        $this->assertSame('READY_FOR_PICKUP', $application->fresh()->status);
        $this->assertDatabaseCount('letters', 1);
        $this->assertDatabaseCount('application_events', 1);
        $this->assertCount(1, $written);
        $this->assertSame($written[0], DB::table('letters')->where('application_id', $application->id)->value('path'));
        Storage::disk('local')->assertExists($written[0]);
    }
}
