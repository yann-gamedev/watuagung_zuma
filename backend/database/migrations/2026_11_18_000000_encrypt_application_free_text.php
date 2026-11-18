<?php

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public $withinTransaction = false;

    private const COLUMNS = [
        'applications' => [
            'keperluan', 'isi_keterangan', 'isi_keterangan_awal', 'barang_hilang',
            'pekerjaan', 'pendidikan', 'catatan',
        ],
        'application_events' => ['note'],
        'letter_numbers' => ['void_reason'],
    ];

    private const LENGTHS = ['pendidikan' => 60, 'pekerjaan' => 60, 'barang_hilang' => 200];

    // Run in maintenance with workers/schedulers stopped: no concurrent writers during data or DDL changes.
    public function up(): void {
        // MySQL DDL commits independently; widening is safe to repeat after a failed data transaction.
        $this->changeSchema(function (Blueprint $table) {
            foreach (self::LENGTHS as $column => $length) {
                $table->text($column)->nullable()->change();
            }
        });

        $this->rewrite(true);
    }

    public function down(): void {
        $this->rewrite(false);

        $this->changeSchema(function (Blueprint $table) {
            foreach (self::LENGTHS as $column => $length) {
                $table->string($column, $length)->nullable()->change();
            }
        });
    }

    private function changeSchema(Closure $callback): void {
        // SQLite rebuilds this referenced table; toggle FKs outside transactions to preserve child rows.
        if (DB::getDriverName() === 'sqlite') {
            Schema::withoutForeignKeyConstraints(fn () => Schema::table('applications', $callback));
        } else {
            Schema::table('applications', $callback);
        }
    }

    private function rewrite(bool $encrypt): void {
        DB::transaction(function () use ($encrypt) {
            $encrypted = $this->preflight(! $encrypt);

            // A committed rewrite can outlive failed MySQL DDL (or migration bookkeeping).
            // Only a uniform state across ALL tables is retryable; never skip individual plaintext cells.
            if ($encrypted === null || $encrypted === $encrypt) {
                return;
            }

            foreach (self::COLUMNS as $table => $columns) {
                DB::table($table)->select(['id', ...$columns])->chunkById(500, function ($rows) use ($table, $columns, $encrypt) {
                    foreach ($rows as $row) {
                        $values = [];
                        foreach ($columns as $column) {
                            if ($row->$column !== null) {
                                $values[$column] = $encrypt
                                    ? Crypt::encryptString($row->$column)
                                    : Crypt::decryptString($row->$column);
                            }
                        }
                        if ($values !== []) {
                            DB::table($table)->where('id', $row->id)->update($values);
                        }
                    }
                });
            }
        });
    }

    private function preflight(bool $shrinking): ?bool {
        $encrypted = null;

        foreach (self::COLUMNS as $table => $columns) {
            DB::table($table)->select(['id', ...$columns])->chunkById(500, function ($rows) use ($table, $columns, $shrinking, &$encrypted) {
                foreach ($rows as $row) {
                    foreach ($columns as $column) {
                        $value = $row->$column;
                        if ($value === null) {
                            continue;
                        }

                        $plaintext = $this->decryptIfEncrypted($value);
                        $isEncrypted = $plaintext !== null;
                        if ($encrypted !== null && $encrypted !== $isEncrypted) {
                            throw new RuntimeException('Mixed plaintext and ciphertext in free-text columns; restore a consistent state before retrying.');
                        }
                        $encrypted = $isEncrypted;

                        // Validate every restored varchar before ANY writes, including on a rollback retry.
                        if ($shrinking && $table === 'applications' && isset(self::LENGTHS[$column])
                            && mb_strlen($plaintext ?? $value, 'UTF-8') > self::LENGTHS[$column]) {
                            throw new RuntimeException("Cannot restore applications.{$column}: plaintext exceeds its original varchar length.");
                        }
                    }
                }
            });
        }

        return $encrypted;
    }

    private function decryptIfEncrypted(string $value): ?string {
        try {
            return Crypt::decryptString($value);
        } catch (DecryptException) {
            // Do not mistake a Laravel payload with a wrong key/bad MAC for legacy plaintext.
            $payload = json_decode(base64_decode($value, true) ?: '', true);
            if (is_array($payload) && (isset($payload['iv']) || isset($payload['value']) || isset($payload['mac']))) {
                throw new RuntimeException('Unreadable encrypted free-text payload; verify APP_KEY and data integrity before retrying.');
            }

            return null;
        }
    }
};
